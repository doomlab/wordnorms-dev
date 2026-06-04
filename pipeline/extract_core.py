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

def _area_to_text(area):
    """Convert a pdfplumber page/crop to text using word-level extraction.

    extract_words() detects gaps between character bboxes and inserts spaces
    explicitly, which fixes PDFs where extract_text() joins words without spaces.
    Falls back to extract_text() if no words are detected.
    """
    words = area.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
    if not words:
        return (area.extract_text() or "").strip()
    lines = []
    cur_line: list[str] = []
    cur_top = None
    for w in words:
        top = round(w["top"] / 4)  # bucket into ~4px rows
        if cur_top is None or top == cur_top:
            cur_line.append(w["text"])
            cur_top = top
        else:
            lines.append(" ".join(cur_line))
            cur_line = [w["text"]]
            cur_top = top
    if cur_line:
        lines.append(" ".join(cur_line))
    return "\n".join(lines)


def _find_column_gap(page):
    """Return the x-coordinate of the column gap, or None if single-column page.

    Looks for the longest horizontal strip with no words in the middle 60% of
    page width. Only returns a split point if the gap is at least 8px wide.
    """
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if len(words) < 20:
        return None
    w = page.width
    lo, hi = int(w * 0.2), int(w * 0.8)
    occ = [0] * (int(w) + 2)
    for word in words:
        for x in range(int(word["x0"]), int(word["x1"]) + 1):
            if 0 <= x < len(occ):
                occ[x] += 1
    best_start, best_len, cur_start, cur_len = lo, 0, lo, 0
    for x in range(lo, hi):
        if occ[x] == 0:
            if cur_len == 0:
                cur_start = x
            cur_len += 1
            if cur_len > best_len:
                best_len, best_start = cur_len, cur_start
        else:
            cur_len = 0
    if best_len >= 8:
        return best_start + best_len // 2
    return None


def _extract_page_columns(page):
    """Extract text, splitting at the actual column gap if one exists."""
    split_x = _find_column_gap(page)
    if split_x is None:
        return _area_to_text(page)
    h = page.height
    left = _area_to_text(page.crop((0, 0, split_x, h)))
    right = _area_to_text(page.crop((split_x, 0, page.width, h)))
    if len(right) > 100:
        return left + "\n\n" + right
    return _area_to_text(page)


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


def _fix_llm_json(raw):
    """Fix common LLM JSON mistakes before parsing."""
    # Replace inline arithmetic: "stimuliCount": 146 + 49  ->  195
    def _sum(m):
        try:
            return str(int(m.group(1)) + int(m.group(2)))
        except Exception:
            return m.group(0)
    raw = re.sub(r"(\d+)\s*\+\s*(\d+)", _sum, raw)
    # Replace set-like array items {"valence"} -> "valence"
    raw = re.sub(r'\{"([^"{}]+)"\}', r'"\1"', raw)
    return raw


def parse_response(raw):
    """Extract JSON from model response, stripping any markdown fences or prose."""
    raw = raw.strip()
    # strip ```json ... ``` fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = _fix_llm_json(raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # fall back: find the outermost { ... } block in case of leading/trailing prose
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
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


def _to_int(val):
    """Coerce LLM output to int (handles strings like 'over 8,000', '~200')."""
    if val is None:
        return None
    if isinstance(val, int):
        return val
    m = re.search(r"\d[\d,]*", str(val))
    return int(m.group().replace(",", "")) if m else None


def _to_str(val):
    """Coerce LLM output to a plain string; dicts/lists become JSON strings."""
    if val is None:
        return None
    if isinstance(val, str):
        return val
    return json.dumps(val)


def _to_str_list(val):
    """Coerce LLM output to a list of plain strings."""
    if not val:
        return []
    if not isinstance(val, list):
        val = [val]
    return [_to_str(v) for v in val if v is not None and v != "null"]


def _get(data, snake, camel=None):
    """Get value by snake_case key, falling back to camelCase if model used that instead."""
    v = data.get(snake)
    if v is None and camel:
        v = data.get(camel)
    return v


def save_extraction(conn, paper_id, data, extracted_by, paper_text=None):
    if data is None:
        return False

    confidence = data.get("confidence")
    needs_review = confidence is not None and confidence < 0.6

    participant_level_data = bool(_get(data, "participant_level_data", "participantLevelData") or False)
    reliabilities = _get(data, "reliabilities") or []
    if not isinstance(reliabilities, list):
        reliabilities = []

    raw_snippets = _get(data, "source_snippets", "sourceSnippets") or {}
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
            _to_str_list(_get(data, "language")),
            _to_int(_get(data, "participant_count", "participantCount")),
            _to_str(_get(data, "participant_type", "participantType")),
            _to_str_list(_get(data, "stimuli_type", "stimuliType")),
            _to_int(_get(data, "stimuli_count", "stimuliCount")),
            _to_str_list(_get(data, "norms_collected", "normsCollected")),
            _to_str(_get(data, "instructions")),
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
