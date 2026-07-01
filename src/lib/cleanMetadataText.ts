const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

// PLOS and other JATS-sourced records often carry markup (<jats:italic>, <i>, HTML
// entities) straight through into title/abstract fields from OpenAlex and CrossRef.
export function cleanMetadataText(input: string | null | undefined): string | null {
  if (!input) return null

  const withoutTags = input.replace(/<\/?[a-z][a-z0-9:]*[^>]*>/gi, "")

  const withoutEntities = withoutTags.replace(
    /&(#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (match, _whole, dec, hex, name) => {
      if (dec) return String.fromCodePoint(parseInt(dec, 10))
      if (hex) return String.fromCodePoint(parseInt(hex, 16))
      const replacement = name ? NAMED_ENTITIES[name.toLowerCase()] : undefined
      return replacement ?? match
    }
  )

  const collapsed = withoutEntities.replace(/\s+/g, " ").trim()
  return collapsed || null
}
