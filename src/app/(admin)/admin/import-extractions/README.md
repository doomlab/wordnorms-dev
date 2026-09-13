# Import Extractions — manual LLM workflow

Used when the automated pipeline (`pipeline/extract.py` / `extract_local.py`, which use
Groq/Ollama) got a paper's metadata wrong or skipped it, and you want to run that PDF
through a stronger model by hand instead. Read a PDF, prompt a large model for
structured metadata, then paste the result into `/admin/import-extractions` to upsert
it into the paper's `PaperExtraction` row.

## 1. Prompt

Feed this alongside the PDF to any strong long-document model (Claude Opus, GPT-5,
etc.):

```
You are extracting structured metadata from a psycholinguistic/psychology norming
study PDF for a research database. Read the full paper carefully, including
supplementary/appendix sections, and return ONLY a single JSON object (no markdown
fences, no commentary) matching exactly this shape:

{
  "language": ["English"],                 // languages the norms were collected in
  "participantCount": 120,                 // total N, or null if not reported
  "participantType": "undergraduate students",  // who the participants were
  "participantLevelData": false,           // true only if raw per-participant data is shared/available
  "stimuliType": ["words"],                // e.g. "words", "images", "sentences", "pseudowords"
  "stimuliCount": 500,                     // number of items normed, or null
  "normsCollected": ["valence", "arousal"],// which norm dimensions were collected
  "instructions": "Participants rated each word on a 1-9 scale for how positive or negative...",
                                            // brief paraphrase of the task instructions given to participants
  "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",  // license the norms/data are released under, or null
  "dataUrl": "https://osf.io/abc123/",     // where the raw norms/stimuli data can actually be downloaded (Data Availability
                                            // statement, supplementary materials link, OSF/Figshare/GitHub repo) — distinct
                                            // from licenseUrl, which is what license it's released under, or null
  "dataSource": "human",                   // "human" or "ai" — were the norms collected from people or generated/rated by a model
  "reliabilities": [
    { "norm": "valence", "value": 0.87, "metric": "cronbach_alpha" }
  ],                                        // metric one of: cronbach_alpha, split_half, icc, pearson_r, kappa
  "confidence": 0.92,                       // your own confidence (0-1) in the overall extraction
  "sourceSnippets": {
    "participantCount": "\"A total of 120 undergraduates (mean age = 20.3)...\"",
    "normsCollected": "\"...norms for valence, arousal, and concreteness...\""
  }                                          // short verbatim quotes backing each non-obvious field, for a human reviewer to spot-check
}

Rules:
- If a field genuinely isn't reported in the paper, use null (or [] for array fields) —
  do not guess.
- confidence should reflect the whole extraction, not any one field; use <0.6 if you
  had to infer several fields rather than read them directly.
- Always include sourceSnippets for participantCount, stimuliCount, normsCollected,
  and reliabilities, since those are the easiest to hallucinate.
```

Optionally, if you also want the paper's full extracted text stored (useful for
future reprocessing or search — not shown in any admin UI), have the model or your
PDF-to-text step include a top-level `"paperText"` string field alongside the object
above; it isn't part of the JSON structure the model needs to reason about, so it's
fine to attach it after the fact.

## 2. Import template

Each paper is one JSON object. Add `paperId` (visible in the URL of
`/admin/metadata/[id]` or `/admin/papers/[id]`) or `doi` so it can be matched to an
existing `Paper` row — `paperId` is tried first, `doi` is the fallback. Collect one
object per paper into a `[ ... ]` array, or paste a single object.

```json
[
  {
    "paperId": 1234,
    "doi": "10.xxxx/xxxxx",
    "extractedBy": "claude-opus-4.6-manual",
    "language": ["English"],
    "participantCount": 120,
    "participantType": "undergraduate students",
    "participantLevelData": false,
    "stimuliType": ["words"],
    "stimuliCount": 500,
    "normsCollected": ["valence", "arousal"],
    "instructions": "Participants rated each word on a 1-9 scale for valence and arousal.",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "dataUrl": "https://osf.io/abc123/",
    "dataSource": "human",
    "reliabilities": [
      { "norm": "valence", "value": 0.87, "metric": "cronbach_alpha" }
    ],
    "confidence": 0.92,
    "sourceSnippets": {
      "participantCount": "\"A total of 120 undergraduates (mean age = 20.3)...\"",
      "normsCollected": "\"...norms for valence, arousal, and concreteness...\""
    }
  }
]
```

`extractedBy` is optional (defaults to `"manual-llm-import"`) — set it to the actual
model name/version you used for provenance, so it's obvious later which extractions
came from the automated pipeline vs. a manual run.

## 3. Importing

Go to `/admin/import-extractions` (linked from the admin dashboard), paste the JSON
(single object or array), and click **Import**. Each row is reported as:

| Status | Meaning |
|---|---|
| `created` | Paper had no extraction yet — one was created |
| `updated` | Paper already had an extraction — it was overwritten with this data |
| `skipped` | No paper matched the given `paperId`/`doi` |
| `error` | Something else went wrong (shown in the message column) |

Check **"Mark all as verified"** before importing if you've already reviewed the
output and want it to skip the `/admin/metadata` review queue. Otherwise it's flagged
`needsReview` the same way the automated pipeline does: `true` whenever `confidence`
is missing or below `0.6`.

Re-running an import with corrected data is safe — it's an upsert keyed on the
paper, so pasting the same `paperId` again just overwrites the previous extraction.

## Implementation

- `bulkImportExtractions.ts` (mutation) — validates entries, resolves `paperId`/`doi`
  to a `Paper`, upserts `PaperExtraction`.
- `ImportExtractionsForm.tsx` — paste-JSON-or-choose-file UI, renders the results
  table.
- `page.tsx` — route wrapper.
