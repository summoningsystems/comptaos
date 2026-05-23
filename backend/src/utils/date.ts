/** Formate une date JS en YYYY-MM-DD */
export function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}
