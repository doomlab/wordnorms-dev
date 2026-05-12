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
- confidence: your confidence in the extraction as a float from 0.0 to 1.0

Paper text:
{text}"""


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_path, max_pages=20):
    """Extract text from a PDF file, capped at max_pages to avoid token bloat."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
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
    return PROMPT_TEMPLATE.format(text=trim_text(text))


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

def save_extraction(conn, paper_id, data, extracted_by):
    if data is None:
        return False

    confidence = data.get("confidence")
    needs_review = confidence is not None and confidence < 0.6

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO "PaperExtraction" (
            "createdAt", "updatedAt", "paperId",
            language, "participantCount", "participantType",
            "stimuliType", "stimuliCount", "normsCollected",
            instructions, confidence, "needsReview",
            "extractedBy", "extractedAt"
        ) VALUES (
            NOW(), NOW(), %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, NOW()
        )
        ON CONFLICT ("paperId") DO UPDATE SET
            "updatedAt"       = NOW(),
            language          = EXCLUDED.language,
            "participantCount" = EXCLUDED."participantCount",
            "participantType" = EXCLUDED."participantType",
            "stimuliType"     = EXCLUDED."stimuliType",
            "stimuliCount"    = EXCLUDED."stimuliCount",
            "normsCollected"  = EXCLUDED."normsCollected",
            instructions      = EXCLUDED.instructions,
            confidence        = EXCLUDED.confidence,
            "needsReview"     = EXCLUDED."needsReview",
            "extractedBy"     = EXCLUDED."extractedBy",
            "extractedAt"     = NOW()
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
            confidence,
            needs_review,
            extracted_by,
        ),
    )
    return True
