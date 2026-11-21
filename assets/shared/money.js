// Money helpers. All amounts are integer euro cents to avoid float drift.

/** @param {number} cents @param {'el'|'en'} [lang] */
export function eur(cents, lang = 'el') {
  const locale = lang === 'el' ? 'el-GR' : 'en-IE';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Parse "8.50" / "8,50" into integer cents. Returns NaN when invalid. */
export function toCents(input) {
  const s = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}
