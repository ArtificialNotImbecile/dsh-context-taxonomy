/** Text projection helpers shared by the logical-request classifier. */

/**
 * Estimate composition tokens without claiming provider accounting.
 * @param text - sanitized text to estimate.
 * @returns a CJK-aware, deliberately approximate token count.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu) ?? []).length
  const other = Math.max(0, text.length - cjk)
  return Math.max(1, cjk + Math.ceil(other / 4))
}
/**
 * Collapse sanitized text into one bounded list preview.
 * @param text - source text.
 * @returns whitespace-normalized preview.
 */
export function previewText(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  return normalized.length > 240 ? `${normalized.slice(0, 237)}…` : normalized
}
