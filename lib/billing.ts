// Platform billing: per-active-student pricing with min/max monthly fee and a free trial.

export const TRIAL_DAYS = 30;

export function trialEnd(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 3600 * 1000);
}

export type FeeInput = {
  activeStudents: number;
  pricePerStudentCts: number;
  minCts: number;
  maxCts: number;
  period: string; // YYYY-MM
  trialEndsAt: Date;
};

export type FeeResult = {
  rawCts: number;
  clampedCts: number;
  billableDays: number;
  daysInMonth: number;
  amountCts: number;
  inTrial: boolean; // whole month covered by the trial
};

/**
 * raw     = activeStudents × pricePerStudent
 * clamped = min(max(raw, min), max)
 * amount  = clamped × (days after the trial ends / days in month)
 * A month fully inside the trial costs 0. The month the trial ends in is prorated.
 */
export function monthlyFee(i: FeeInput): FeeResult {
  const [y, m] = i.period.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = Date.UTC(y, m - 1, daysInMonth + 1);
  const rawCts = Math.max(0, i.activeStudents) * i.pricePerStudentCts;
  const clampedCts = Math.min(Math.max(rawCts, i.minCts), Math.max(i.minCts, i.maxCts));

  const t = i.trialEndsAt.getTime();
  let billableDays: number;
  if (t <= start) billableDays = daysInMonth;
  else if (t >= end) billableDays = 0;
  else billableDays = daysInMonth - Math.ceil((t - start) / 86400000);

  const amountCts = Math.round((clampedCts * billableDays) / daysInMonth);
  return { rawCts, clampedCts, billableDays, daysInMonth, amountCts, inTrial: billableDays === 0 };
}

export function trialDaysLeft(trialEndsAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000));
}
