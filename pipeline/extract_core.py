"""
Shared extraction logic used by both extract_local.py (Ollama) and
extract.py (Groq). Handles PDF text extraction, prompt construction,
JSON parsing, and DB writes.
"""
import json
import re
import datetime

import pdfplumber

PROMPT_SYSTEM = """You are a research assistant extracting structured metadata
from psychology and linguistics papers about word norms and lexical databases.
Extract only what is explicitly stated. Return null for any field not clearly
reported in the paper. Do not guess or infer."""

PROMPT_TEMPLATE = """Extract the following metadata from this paper and return
valid JSON only — no markdown, no explanation, just the JSON object.

Fields to extract:
- language: list of languages the stimuli are in (e.g. ["English"] or ["French", "English"])
- participant_count: integer number of participants, or null
- participant_type: short description of who the participants were (e.g. "undergraduate students", "MTurk workers", "general population"), or null
- stimuli_type: list of stimulus types used (e.g. ["words"], ["words", "pictures"], ["sentences"])
- stimuli_count: integer number of stimuli/items, or null
- norms_collected: list of dimensions rated (e.g. ["valence", "arousal", "familiarity", "imageability"])
- instructions: the exact or paraphrased instructions given to participants, or null if not reported
- participant_level_data: true if the paper makes raw participant-level response data available (e.g. individual ratings per item per participant), false otherwise
- reliabilities: list of reported reliability or internal consistency statistics, one object per norm dimension — e.g. [{"norm": "valence", "value": 0.87, "metric": "cronbach_alpha"}]. Use null for value if the paper reports a reliability metric but not the number. Common metrics: cronbach_alpha, split_half, icc, pearson_r, kappa. Return an empty list if no reliability statistics are reported.
- confidence: your confidence in the extraction as a float from 0.0 to 1.0
- source_snippets: for each field above (except confidence and participant_level_data), copy the full sentence or sentences from the paper that support the extracted value — do not paraphrase or truncate, include at least one complete sentence. Use null if you could not find a source. Keys must be: language, participantCount, participantType, stimuliType, stimuliCount, normsCollected, instructions, reliabilities.

Paper text:
{text}"""


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def _extract_page_columns(page):
    """Extract text handling two-column layouts by splitting at midpoint."""
    w, h = page.width, page.height
    left = (page.crop((0, 0, w / 2, h)).extract_text() or "").strip()
    right = (page.crop((w / 2, 0, w, h)).extract_text() or "").strip()
    if len(right) > 100:
        return left + "\n\n" + right
    # single column or near-empty right half — fall back to full-page
    return (page.extract_text() or "").strip()


def extract_pdf_text(pdf_path, max_pages=20):
    """Extract text from a PDF file, capped at max_pages to avoid token bloat."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:max_pages]:
            text = _extract_page_columns(page)
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def trim_text(text, max_chars=6000):
    """Keep abstract + methods section where the metadata usually lives."""
    if len(text) <= max_chars:
        return text

    # try to find and prioritize abstract + methods
    lower = text.lower()
    method_start = next(
        (lower.find(h) for h in ("method", "participants", "stimuli") if lower.find(h) != -1),
        -1,
    )
    if method_start != -1:
        # take some from the start (abstract) and the methods section
        head = text[:1500]
        body = text[method_start: method_start + 4500]
        return head + "\n\n" + body

    return text[:max_chars]


# ---------------------------------------------------------------------------
# Prompt and response parsing
# ---------------------------------------------------------------------------

def build_prompt(text):
    return PROMPT_TEMPLATE.replace("{text}", trim_text(text))


def parse_response(raw):
    """Extract JSON from model response, stripping any markdown fences."""
    raw = raw.strip()
    # strip ```json ... ``` fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# DB write
# ---------------------------------------------------------------------------

def save_extraction_failure(conn, paper_id, reason):
    """Write a stub extraction with needsReview=True so bulk runs skip this paper."""
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO "PaperExtraction" (
            "createdAt", "updatedAt", "paperId",
            language, "stimuliType", "normsCollected",
            confidence, "needsReview", "extractedBy", "extractedAt"
        ) VALUES (NOW(), NOW(), %s, %s, %s, %s, NULL, TRUE, %s, NOW())
        ON CONFLICT ("paperId") DO NOTHING
        """,
        (paper_id, [], [], [], reason),
    )


def save_extraction(conn, paper_id, data, extracted_by, paper_text=None):
    if data is None:
        return False

    confidence = data.get("confidence")
    needs_review = confidence is not None and confidence < 0.6

    participant_level_data = bool(data.get("participant_level_data") or False)
    reliabilities = data.get("reliabilities") or []
    if not isinstance(reliabilities, list):
        reliabilities = []

    # source_snippets already uses camelCase keys as requested in the prompt
    raw_snippets = data.get("source_snippets") or {}
    source_snippets = {k: v for k, v in raw_snippets.items() if v is not None} if raw_snippets else None

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO "PaperExtraction" (
            "createdAt", "updatedAt", "paperId",
            language, "participantCount", "participantType",
            "stimuliType", "stimuliCount", "normsCollected",
            instructions, "participantLevelData", reliabilities,
            confidence, "needsReview", "sourceSnippets",
            "paperText", "extractedBy", "extractedAt"
        ) VALUES (
            NOW(), NOW(), %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s::jsonb,
            %s, %s, %s::jsonb,
            %s, %s, NOW()
        )
        ON CONFLICT ("paperId") DO UPDATE SET
            "updatedAt"            = NOW(),
            language               = EXCLUDED.language,
            "participantCount"     = EXCLUDED."participantCount",
            "participantType"      = EXCLUDED."participantType",
            "stimuliType"          = EXCLUDED."stimuliType",
            "stimuliCount"         = EXCLUDED."stimuliCount",
            "normsCollected"       = EXCLUDED."normsCollected",
            instructions           = EXCLUDED.instructions,
            "participantLevelData" = EXCLUDED."participantLevelData",
            reliabilities          = EXCLUDED.reliabilities,
            confidence             = EXCLUDED.confidence,
            "needsReview"          = EXCLUDED."needsReview",
            "sourceSnippets"       = EXCLUDED."sourceSnippets",
            "paperText"            = EXCLUDED."paperText",
            "extractedBy"          = EXCLUDED."extractedBy",
            "extractedAt"          = NOW()
        """,
        (
            paper_id,
            data.get("language") or [],
            data.get("participant_count"),
            data.get("participant_type"),
            data.get("stimuli_type") or [],
            data.get("stimuli_count"),
            data.get("norms_collected") or [],
            data.get("instructions"),
            participant_level_data,
            json.dumps(reliabilities),
            confidence,
            needs_review,
            json.dumps(source_snippets) if source_snippets else None,
            paper_text,
            extracted_by,
        ),
    )
    return True
