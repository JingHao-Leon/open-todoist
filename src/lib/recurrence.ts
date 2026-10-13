import type { Recurrence } from '../types';
import {
  addDays,
  addMonths,
  addYears,
  compareKeys,
  startOfWeek,
  toKey,
  weekdayOf,
  type CalendarDate,
} from './date';

/**
 * Recurrence engine.
 *
 * `nextOccurrence` is always *strictly after* `after`, so completing a daily
 * task today schedules tomorrow rather than looping on today.
 */

const MAX_LOOKAHEAD_YEARS = 8;

/** Short, stable label for the UI. */
export function describeRecurrence(rec: Recurrence): string {
  const every = rec.interval === 1 ? 'Every' : `Every ${rec.interval}`;
  switch (rec.freq) {
    case 'daily':
      return rec.interval === 1 ? 'Every day' : `${every} days`;
    case 'weekdays':
      return 'Every weekday';
    case 'weekly': {
      if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
        const names = [...rec.daysOfWeek]
          .sort((a, b) => a - b)
          .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
          .join(', ');
        const label = rec.interval === 1 ? `Every ${names}` : `${every} ${rec.interval} weeks on ${names}`;
        return label;
      }
      return rec.interval === 1 ? 'Every week' : `${every} weeks`;
    }
    case 'monthly':
      return rec.interval === 1 ? 'Every month' : `${every} months`;
    case 'yearly':
      return rec.interval === 1 ? 'Every year' : `${every} years`;
  }
}

/** Compact badge text, e.g. `2w`, `weekdays`, `Mon,Wed`. */
export function recurrenceBadge(rec: Recurrence): string {
  const n = rec.interval === 1 ? '' : `${rec.interval}`;
  switch (rec.freq) {
    case 'daily':
      return `${n}d`;
    case 'weekdays':
      return 'weekdays';
    case 'weekly':
      return rec.daysOfWeek && rec.daysOfWeek.length > 0
        ? rec.daysOfWeek
            .slice()
            .sort((a, b) => a - b)
            .map((d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d])
            .join(',')
        : `${n}w`;
    case 'monthly':
      return `${n}mo`;
    case 'yearly':
      return `${n}y`;
  }
}

function asDate(date: CalendarDate | string): CalendarDate {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('-').map((p) => Number.parseInt(p, 10));
    return { y, m, d };
  }
  return date;
}

/**
 * The next date strictly after `after` (default today) on which the recurrence
 * fires. Returns a `YYYY-MM-DD` key.
 */
export function nextOccurrence(
  rec: Recurrence,
  after: CalendarDate | string,
): string {
  const base = asDate(after);

  switch (rec.freq) {
    case 'daily': {
      return toKey(addDays(base, rec.interval));
    }

    case 'weekdays': {
      // Mon-Fri only; step one day until we land on a weekday.
      let cur = addDays(base, 1);
      for (let i = 0; i < 7; i += 1) {
        const wd = weekdayOf(cur);
        if (wd >= 1 && wd <= 5) return toKey(cur);
        cur = addDays(cur, 1);
      }
      return toKey(cur);
    }

    case 'weekly': {
      const days =
        rec.daysOfWeek && rec.daysOfWeek.length > 0
          ? rec.daysOfWeek
          : [weekdayOf(base)];

      // Walk interval-sized week windows forward from the week containing base.
      const weekStart = startOfWeek(base);
      for (let window = 0; window <= MAX_LOOKAHEAD_YEARS * 2; window += 1) {
        const anchor = addDays(weekStart, window * 7 * rec.interval);
        let best: CalendarDate | null = null;
        for (const d of days) {
          // Monday-based week: Monday=1 … Sunday=0 maps to offset 6.
          const offset = d === 0 ? 6 : d - 1;
          const candidate = addDays(anchor, offset);
          // CalendarDate is a plain object: it must be compared through its
          // YYYY-MM-DD key, never with the relational operators.
          if (compareKeys(toKey(candidate), toKey(base)) <= 0) continue;
          if (best === null || compareKeys(toKey(candidate), toKey(best)) < 0) {
            best = candidate;
          }
        }
        if (best) return toKey(best);
      }
      return toKey(addDays(base, 7 * rec.interval));
    }

    case 'monthly': {
      return toKey(addMonths(base, rec.interval));
    }

    case 'yearly': {
      return toKey(addYears(base, rec.interval));
    }
  }
}

/** All future fire dates within `horizonDays`. Used by the Upcoming view. */
export function occurrencesWithin(
  rec: Recurrence,
  from: CalendarDate | string,
  horizonDays = 365,
): string[] {
  const out: string[] = [];
  let cursor = asDate(from);
  let guard = 0;
  const startKey = toKey(cursor);
  while (guard < 400) {
    const next = nextOccurrence(rec, cursor);
    if (!next) break;
    if (diffKeys(next, startKey) > horizonDays) break;
    out.push(next);
    cursor = asDate(next);
    guard += 1;
  }
  return out;
}

function diffKeys(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  );
}

/** Structural equality, used by the parser tests and import validation. */
export function sameRecurrence(a: Recurrence | null, b: Recurrence | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.freq !== b.freq || a.interval !== b.interval) return false;
  const ad = 'daysOfWeek' in a && a.daysOfWeek ? [...a.daysOfWeek].sort() : null;
  const bd = 'daysOfWeek' in b && b.daysOfWeek ? [...b.daysOfWeek].sort() : null;
  if (ad === null || bd === null) return ad === bd;
  return ad.length === bd.length && ad.every((v, i) => v === bd[i]);
}
