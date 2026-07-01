const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY

// OpenAlex bills per call beyond a modest daily free quota; a free API key
// raises that quota. Appends it when configured, no-op otherwise.
export function withOpenAlexApiKey(url: string): string {
  if (!OPENALEX_API_KEY) return url
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${OPENALEX_API_KEY}`
}
