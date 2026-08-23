import Decimal from 'decimal.js';

// Set precision for currency calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(val: number | string | Decimal | undefined | null): Decimal {
  if (val === undefined || val === null) return new Decimal(0);
  return new Decimal(val);
}

export function round2(val: number | string | Decimal): Decimal {
  return toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function addMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return round2(toDecimal(a).plus(toDecimal(b)));
}

export function subMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return round2(toDecimal(a).minus(toDecimal(b)));
}

export function mulMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return round2(toDecimal(a).times(toDecimal(b)));
}

export function divMoney(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  if (toDecimal(b).isZero()) return new Decimal(0);
  return round2(toDecimal(a).dividedBy(toDecimal(b)));
}

export function calculateGst(
  amount: number | string | Decimal,
  gstPercent: number | string | Decimal
): { gstAmount: Decimal; netAmount: Decimal } {
  const amt = toDecimal(amount);
  const pct = toDecimal(gstPercent);
  const gstAmount = round2(amt.times(pct).dividedBy(100));
  const netAmount = round2(amt.plus(gstAmount));
  return { gstAmount, netAmount };
}

export function toFormattedString(val: number | string | Decimal): string {
  return round2(val).toFixed(2);
}
