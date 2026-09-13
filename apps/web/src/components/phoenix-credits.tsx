const PHOENIX_LOCALE = 'en-CH'

export function PhoenixCredits({ value }: { value: number | null | undefined }) {
  return <span className="currency">{formatPhoenixCredits(value)}</span>
}

export function formatPhoenixCredits(
  value: number | null | undefined,
  locale = PHOENIX_LOCALE
): string {
  return value == null
    ? '—'
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))} CR`
}
