/**
 * Exact decimal money helpers (README §19).
 *
 * Monetary columns are PostgreSQL NUMERIC(12,2), transported as strings.
 * All arithmetic is performed on integer cents so no binary float ever
 * touches a fee amount. `formatMoney` is presentation-only.
 */

const TWO_DP = /^-?\d+(\.\d{1,2})?$/

/** Parse a NUMERIC-backed string into integer cents. Throws on bad input. */
export function toCents(amount: string): number {
  const value = amount.trim()
  if (!TWO_DP.test(value)) {
    throw new Error(`Invalid money value: ${amount}`)
  }
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction = ''] = unsigned.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return negative ? -cents : cents
}

/** Convert integer cents back to a 2-decimal-place money string. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

/** Sum any number of money strings exactly. */
export function sumMoney(...amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0))
}

/** a - b in money strings. */
export function subtractMoney(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b))
}

/** Multiply a unit amount by an integer quantity exactly. */
export function multiplyMoney(amount: string, quantity: number): string {
  if (!Number.isInteger(quantity)) {
    throw new Error('quantity must be an integer')
  }
  return fromCents(toCents(amount) * quantity)
}

/** Presentation formatter; defaults to the school's seeded currency. */
export function formatMoney(
  amount: string | number | null | undefined,
  currency = 'NGN',
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '—'
  }
  const value = typeof amount === 'number' ? amount : Number(amount)
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}
