import { describe, expect, it } from 'vitest';
import { nextOccurrence, describeRecurrence, recurrenceBadge, occurrencesWithin, sameRecurrence } from '../lib/recurrence';
import type { Recurrence } from '../types';

/** Reference day: Wednesday 14 October 2026. */
const WED = '2026-10-14';

describe('nextOccurrence — daily', () => {
  it('advances by one day', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, WED)).toBe('2026-10-15');
  });

  it('advances by the interval', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 3 }, WED)).toBe('2026-10-17');
  });

  it('crosses a month boundary', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-10-31')).toBe('2026-11-01');
  });

  it('crosses a year boundary', () => {
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-12-31')).toBe('2027-01-01');
  });

  it('survives a DST transition without drifting a day', () => {
    // 29 March 2026 is the US spring-forward date.
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-03-28')).toBe('2026-03-29');
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-03-29')).toBe('2026-03-30');
    expect(nextOccurrence({ freq: 'daily', interval: 1 }, '2026-03-30')).toBe('2026-03-31');
  });
});

describe('nextOccurrence — weekdays', () => {
  it('from Wednesday skips to Thursday', () => {
    expect(nextOccurrence({ freq: 'weekdays', interval: 1 }, WED)).toBe('2026-10-15');
  });

  it('from Friday jumps over the weekend to Monday', () => {
    expect(nextOccurrence({ freq: 'weekdays', interval: 1 }, '2026-10-16')).toBe('2026-10-19');
  });

  it('from Saturday jumps to Monday', () => {
    expect(nextOccurrence({ freq: 'weekdays', interval: 1 }, '2026-10-17')).toBe('2026-10-19');
  });

  it('from Sunday jumps to Monday', () => {
    expect(nextOccurrence({ freq: 'weekdays', interval: 1 }, '2026-10-18')).toBe('2026-10-19');
  });
});

describe('nextOccurrence — weekly', () => {
  it('repeats on the same weekday when no days are pinned', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1 }, WED)).toBe('2026-10-21');
  });

  it('respects a pinned Monday', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [1] }, WED)).toBe('2026-10-19');
  });

  it('picks the earliest of several pinned days in the current window', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }, WED)).toBe('2026-10-16');
  });

  it('skips to the next window once this one is exhausted', () => {
    // Monday is the only pinned day and it has already passed this week.
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [1] }, '2026-10-19')).toBe('2026-10-26');
  });

  it('handles a two-week interval', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 2 }, WED)).toBe('2026-10-28');
  });

  it('handles Sunday as day 0', () => {
    // Day 0 is Sunday; the week is anchored on Monday, so Sunday is offset 6.
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [0] }, WED)).toBe('2026-10-18');
  });

  it('handles Saturday as day 6', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [6] }, WED)).toBe('2026-10-17');
  });

  it('handles a Sunday-only rule across the week boundary', () => {
    expect(nextOccurrence({ freq: 'weekly', interval: 1, daysOfWeek: [0] }, '2026-10-19')).toBe('2026-10-25');
  });
});

describe('nextOccurrence — monthly and yearly', () => {
  it('advances one month', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, WED)).toBe('2026-11-14');
  });

  it('clamps to the end of a shorter month', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, '2026-01-31')).toBe('2026-02-28');
  });

  it('handles a leap-year February', () => {
    expect(nextOccurrence({ freq: 'monthly', interval: 1 }, '2028-01-31')).toBe('2028-02-29');
  });

  it('advances one year', () => {
    expect(nextOccurrence({ freq: 'yearly', interval: 1 }, WED)).toBe('2027-10-14');
  });

  it('clamps 29 February onto 28 February in a common year', () => {
    expect(nextOccurrence({ freq: 'yearly', interval: 1 }, '2028-02-29')).toBe('2029-02-28');
  });
});

describe('occurrencesWithin', () => {
  it('lists the next occurrences inside the horizon', () => {
    const days = occurrencesWithin({ freq: 'daily', interval: 1 }, WED, 4);
    expect(days).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });

  it('returns nothing when the first occurrence is past the horizon', () => {
    expect(occurrencesWithin({ freq: 'daily', interval: 1 }, WED, 0)).toEqual([]);
  });

  it('lists weekdays and skips the weekend', () => {
    // Friday 16 Oct plus a 4-day horizon: Mon 19 and Tue 20 only.
    const days = occurrencesWithin({ freq: 'weekdays', interval: 1 }, '2026-10-16', 4);
    expect(days).toEqual(['2026-10-19', '2026-10-20']);
  });

  it('keeps every occurrence up to the horizon distance', () => {
    // An occurrence exactly `horizonDays` away is still included.
    const days = occurrencesWithin({ freq: 'daily', interval: 1 }, WED, 3);
    expect(days).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
  });
});

describe('labels', () => {
  it('describes and badges the common frequencies', () => {
    expect(describeRecurrence({ freq: 'daily', interval: 1 })).toBe('Every day');
    expect(recurrenceBadge({ freq: 'daily', interval: 1 })).toBe('d');
    expect(describeRecurrence({ freq: 'weekdays', interval: 1 })).toBe('Every weekday');
    expect(describeRecurrence({ freq: 'weekly', interval: 2 })).toBe('Every 2 weeks');
    expect(recurrenceBadge({ freq: 'weekly', interval: 2 })).toBe('2w');
    expect(recurrenceBadge({ freq: 'weekly', interval: 1, daysOfWeek: [1, 3] })).toBe('Mo,We');
  });

  it('compares recurrences structurally', () => {
    const a: Recurrence = { freq: 'weekly', interval: 1, daysOfWeek: [3, 1] };
    const b: Recurrence = { freq: 'weekly', interval: 1, daysOfWeek: [1, 3] };
    expect(sameRecurrence(a, b)).toBe(true);
    expect(sameRecurrence(a, { freq: 'weekly', interval: 2 })).toBe(false);
    expect(sameRecurrence(null, null)).toBe(true);
    expect(sameRecurrence(null, b)).toBe(false);
  });
});
