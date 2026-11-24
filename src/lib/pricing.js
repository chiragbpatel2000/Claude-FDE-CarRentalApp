export const TAX_RATE = 0.1;

export function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Inclusive day count: same start & end date = 1 day.
export function countDays(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return Math.floor(ms / 86400000) + 1;
}

// Full weeks are charged at the weekly rate, leftover days at the daily rate,
// but the leftover is never more than one extra week.
export function quote(car, days, extrasPerDay = 0) {
  if (days < 1) return null;
  const weeks = Math.floor(days / 7);
  const rem = days % 7;
  const remCost = Math.min(rem * car.dailyRate, car.weeklyRate);
  const base = weeks * car.weeklyRate + remCost;
  const extras = extrasPerDay * days;
  const subtotal = base + extras;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  return {
    weeks,
    rem,
    base,
    extras,
    subtotal,
    tax,
    total: subtotal + tax,
    savings: Math.max(0, days * car.dailyRate - base),
  };
}

export const money = (n) => `$${n.toFixed(2).replace(/\.00$/, '')}`;

export const EXTRAS = [
  { id: 'gps', label: 'GPS navigation', perDay: 8 },
  { id: 'seat', label: 'Child seat', perDay: 6 },
  { id: 'driver', label: 'Additional driver', perDay: 10 },
  { id: 'insurance', label: 'Full insurance cover', perDay: 15 },
];
