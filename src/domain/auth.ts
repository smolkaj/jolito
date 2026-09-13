/**
 * Unwraps a verification token from raw user input, supporting:
 * - Direct 6-digit OTP codes: "123456", "123-456", "123 456"
 * - Domain-bound Apple/W3C verification format: "@joli.to #123456", "@joli.to # 123 456", "@joli.to#123456"
 * - Prefix-only OTP format: "#123456", "# 123456"
 *
 * If domain-bound or prefix OTP syntax is present, returns the extracted 6 digits.
 * Otherwise, returns the input string trimmed.
 */
export function unwrapDomainBoundOtp(input: string): string {
  let trimmed = input.trim()
  if (
    (trimmed.startsWith('<') && trimmed.endsWith('>')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  // Match optional @domain followed by # and exactly 6 digits (optionally separated by whitespace or hyphens)
  const match = /(?:^|\s)(?:@[\w.-]+\s*)?#\s*(\d(?:[\s-]*\d){5})(?!\s*\d)/.exec(
    trimmed,
  )
  if (match?.[1]) {
    return match[1].replace(/[\s-]+/g, '')
  }
  return trimmed
}
