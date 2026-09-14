export type GroupMember = {
  id: number
  title: string
  year: number | null
  status: string
  doi: string | null
  authors: string[]
  journal: string | null
  has_extraction: boolean
  groupkey: string
}

// Repositories/preprint servers that commonly host a copy of a paper alongside its
// eventual journal publication (or multiple copies of themselves) — used to
// auto-suggest merges. Matched by a substring anywhere in the DOI rather than a
// fixed prefix, since e.g. every OSF-family preprint server (PsyArXiv, SocArXiv,
// EdArXiv, ...) has its own DOI registrant prefix but always embeds "osf.io" in
// the DOI itself (10.31234/osf.io/..., 10.31235/osf.io/..., etc.).
const PREPRINT_SOURCES: { key: string; doiSubstrings: string[]; namePattern: RegExp }[] = [
  { key: "figshare", doiSubstrings: ["figshare"], namePattern: /figshare/i },
  { key: "osf", doiSubstrings: ["osf.io"], namePattern: /osf|open science framework/i },
  { key: "arxiv", doiSubstrings: ["48550/arxiv"], namePattern: /arxiv/i },
  { key: "ssrn", doiSubstrings: ["2139/ssrn"], namePattern: /ssrn/i },
  { key: "zenodo", doiSubstrings: ["5281/zenodo"], namePattern: /zenodo/i },
  {
    key: "open-research-europe",
    doiSubstrings: ["12688/openreseurope"],
    namePattern: /open research europe/i,
  },
  // medRxiv shares bioRxiv's "10.1101/" DOI prefix (same platform), so it can only be
  // told apart via the journal name; checked before "biorxiv" so a paper explicitly
  // labeled medRxiv doesn't fall through to the DOI-prefix-only bioRxiv match below.
  { key: "medrxiv", doiSubstrings: [], namePattern: /medrxiv/i },
  { key: "biorxiv", doiSubstrings: ["1101/"], namePattern: /biorxiv/i },
  { key: "techrxiv", doiSubstrings: ["36227/techrxiv"], namePattern: /techrxiv/i },
]

export function detectSource(m: Pick<GroupMember, "doi" | "journal">): string | null {
  const doi = m.doi?.toLowerCase() ?? ""
  for (const source of PREPRINT_SOURCES) {
    if (source.doiSubstrings.some((s) => doi.includes(s))) return source.key
    if (m.journal && source.namePattern.test(m.journal)) return source.key
  }
  return null
}

export function isPreprintSource(m: Pick<GroupMember, "doi" | "journal">) {
  return detectSource(m) !== null
}

function authorKey(a: string) {
  return a.trim().toLowerCase().split(/[\s,]+/).filter(Boolean).pop() ?? ""
}

function sharesAuthor(a: string[], b: string[]) {
  const keys = new Set(a.map(authorKey).filter(Boolean))
  return b.some((x) => keys.has(authorKey(x)))
}

// A group auto-qualifies for one-click merge when exactly one member isn't a known
// preprint/repository host (regardless of whether it has journal metadata filled
// in — the determining factor is just "not a known preprint server"), every other
// member is one, and they share at least one author with that member (sanity check
// against same-title-different-paper false positives).
export function journalMergeCandidate(members: GroupMember[]) {
  const nonPreprintMembers = members.filter((m) => !isPreprintSource(m))
  const preprintMembers = members.filter((m) => isPreprintSource(m))
  if (nonPreprintMembers.length !== 1) return null
  const canonical = nonPreprintMembers[0]!
  if (preprintMembers.length === 0 || preprintMembers.length !== members.length - 1) return null
  if (!preprintMembers.every((p) => sharesAuthor(canonical.authors, p.authors))) return null
  return { canonical, duplicates: preprintMembers }
}

// A group also auto-qualifies when every member comes from the *same* repository
// (e.g. two arXiv copies of the same preprint, one posted before a DOI was minted)
// and exactly one of them has a DOI — that one becomes canonical.
export function sameRepositoryMergeCandidate(members: GroupMember[]) {
  if (members.length < 2) return null
  const sources = members.map(detectSource)
  const source = sources[0]
  if (!source || sources.some((s) => s !== source)) return null
  const withDoi = members.filter((m) => m.doi)
  if (withDoi.length !== 1) return null
  const canonical = withDoi[0]!
  const duplicates = members.filter((m) => m.id !== canonical.id)
  if (!duplicates.every((d) => sharesAuthor(canonical.authors, d.authors))) return null
  return { canonical, duplicates, source }
}
