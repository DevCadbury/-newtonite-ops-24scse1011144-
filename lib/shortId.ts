/**
 * Converts a CUID to a deterministic 5-character uppercase alphanumeric ID.
 *
 * Uses unambiguous characters only (no O/0, I/1, l) so IDs are easy to
 * read aloud and copy without confusion.
 *
 * Example: "cmvdn6mmm0004xcug0d7xsr9g" → "T4K2R"
 *
 * Same input always produces the same output (deterministic hash).
 */
export function shortId(id: string): string {
  // Unambiguous uppercase alphanumeric alphabet (32 chars)
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  // djb2-inspired hash
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 33) ^ id.charCodeAt(i)) >>> 0;
  }

  let result = "";
  for (let i = 0; i < 5; i++) {
    result += CHARS[h % CHARS.length];
    // Mix the bits for each subsequent character
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
  }
  return result;
}
