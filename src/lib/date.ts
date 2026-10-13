/**
 * Calendar-date helpers.
 *
 * Design rule: a task's due day is a *calendar* day (`YYYY-MM-DD`) in the
 * user's own timezone, never an instant. Every conversion therefore goes
 * through the local `Date` getters — `toISOString()` is deliberately avoided
 * anywhere in this file, because it shifts the day for anyone east/west of UTC.
 */

const MS_DAY = 86_400_000;

export const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export interface CalendarDate {
  y: number;
  /** 1-12 */
  m: number;
  /** 1-31 */
  d: number;
}

/** Today in local time. */
export function today(now: Date = new Date()): CalendarDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

export function toKey(date: CalendarDate): string {
  const mm = String(date.m).padStart(2, '0');
  const dd = String(date.d).padStart(2, '0');
  return `${date.y}-${mm}-${dd}`;
}

export function fromKey(key: string): CalendarDate {
  const [y, m, d] = key.split('-').map((p) => Number.parseInt(p, 10));
  return { y, m, d };
}

/** Local midnight `Date` for a calendar date. */
export function toDate(date: CalendarDate): Date {
  return new Date(date.y, date.m - 1, date.d);
}

export function isValidKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = fromKey(key);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = toDate({ y, m, d });
  return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const dt = toDate(date);
  dt.setDate(dt.getDate() + days);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const totalMonth = (date.m - 1) + months;
  const y = date.y + Math.floor(totalMonth / 12);
  const m = ((totalMonth % 12) + 12) % 12 + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export function addYears(date: CalendarDate, years: number): CalendarDate {
  const y = date.y + years;
  return { y, m: date.m, d: Math.min(date.d, daysInMonth(y, date.m)) };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: CalendarDate): number {
  return toDate(date).getDay();
}

/** Monday-based week start, matching the `every weekday` convention. */
export function startOfWeek(date: CalendarDate): CalendarDate {
  const wd = weekdayOf(date);
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(date, delta);
}

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function diffDays(a: CalendarDate, b: CalendarDate): number {
  // Both are local midnights, so a plain difference is exact across DST only
  // after rounding; the calendar-day count is what callers actually want.
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / MS_DAY);
}

/** Inclusive start of the 7-day window starting on `date`. */
export function weekRange(date: CalendarDate): { start: string; end: string } {
  const start = startOfWeek(date);
  return { start: toKey(start), end: toKey(addDays(start, 6)) };
}

export function isToday(key: string, now: Date = new Date()): boolean {
  return key === toKey(today(now));
}

export function isOverdue(key: string, now: Date = new Date()): boolean {
  return key < toKey(today(now));
}

/** Human label used by the task list, e.g. "Today", "Tomorrow", "Mon 20 Oct". */
export function humanDate(key: string, now: Date = new Date()): string {
  if (!isValidKey(key)) return key;
  const t = toKey(today(now));
  if (key === t) return 'Today';
  if (key === toKey(addDays(today(now), 1))) return 'Tomorrow';
  if (key === toKey(addDays(today(now), -1))) return 'Yesterday';

  const d = fromKey(key);
  const thisYear = today(now).y;
  const wd = WEEKDAY_NAMES[weekdayOf(d)];
  const month = MONTH_NAMES[d.m - 1].slice(0, 3);
  const base = `${wd.slice(0, 3)} ${d.d} ${month}`;
  return d.y === thisYear ? base : `${base} ${d.y}`;
}

/** `HH:mm` → minutes since midnight, or `null` when malformed. */
export function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** `YYYY-MM-DD` for an ISO timestamp, read in local time. */
export function isoToLocalKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toKey(today(d));
}
