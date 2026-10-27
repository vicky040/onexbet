import { Prisma } from "@prisma/client";

/**
 * All money is Decimal(14,2) in the database and a plain JSON number on the
 * wire. Arithmetic goes through Prisma.Decimal so repeated commission splits
 * never drift the way floats do.
 */

export type Money = Prisma.Decimal;
export type Numeric = Prisma.Decimal | number | string;

export function D(value: Numeric): Money {
  return new Prisma.Decimal(value);
}

/** Rounds to paise, the precision the column stores. */
export function money(value: Numeric): Money {
  return D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Decimal -> JSON number. */
export function toNumber(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/** `rate` percent of `amount`, e.g. commissionOf(5500, 5.5) -> 302.50. */
export function commissionOf(amount: Numeric, rate: Numeric): Money {
  return money(D(amount).mul(D(rate)).div(100));
}

export function isPositive(value: Numeric): boolean {
  return D(value).greaterThan(0);
}

export function formatInr(value: Numeric | null | undefined): string {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: Numeric | null | undefined): string {
  return `${toNumber(value).toFixed(2)}%`;
}
