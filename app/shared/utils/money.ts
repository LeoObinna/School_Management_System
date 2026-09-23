/**
 * Exact integer money helpers (README §19, D1 Phase 4b).
 *
 * Monetary columns are INTEGER kobo (₦1 = 100 kobo) on D1/SQLite.
 * The server stores, transports and computes money exclusively as
 * integer kobo — no binary float ever touches a fee amount. The UI
 * accepts naira strings from `<input type="text">` and converts to
 * kobo via `parseNairaToKobo` before posting; `koboToNaira` does the
 * reverse for form prefill. `formatMoney` is presentation-only.
 */

const TWO_DP = /^\d+(\.\d{1,2})?$/

/**
 * Parse a naira string (e.g. "50000", "50000.50", "0.05") into
 * integer kobo. Throws on negative, malformed, or >2-dp input.
 */
export function parseNairaToKobo(input: string): number {
  const value = input.trim()
  if (!TWO_DP.test(value)) {
    throw new Error(`Invalid money value: ${input}`)
  }
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Convert integer kobo back to a 2-decimal-place naira string. */
export function koboToNaira(kobo: number): string {
  const abs = Math.abs(kobo)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${whole}.${fraction}`
}

/** Sum any number of integer kobo amounts. */
export function sumKobo(...amounts: number[]): number {
  return amounts.reduce((acc, a) => acc + a, 0)
}

/** Multiply a kobo unit amount by an integer quantity exactly. */
export function multiplyKobo(amount: number, quantity: number): number {
  if (!Number.isInteger(quantity)) {
    throw new Error('quantity must be an integer')
  }
  return amount * quantity
}

/**
 * Presentation formatter: kobo → currency string. Accepts null/empty
 * for "—" placeholder, and string for backward-compatible callers.
 */
export function formatMoney(
  amount: string | number | null | undefined,
  currency = 'NGN',
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '—'
  }
  // Kobo → naira: divide by 100. Inputs are integer kobo (number) or
  // legacy naira strings (rare); strings are parsed as naira for safety.
  const naira =
    typeof amount === 'number'
      ? amount / 100
      : Number(amount)
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(naira)
  } catch {
    return `${currency} ${naira.toFixed(2)}`
  }
}
