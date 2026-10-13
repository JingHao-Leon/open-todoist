import { describe, expect, it } from 'vitest';
import { parseInput, previewChips } from '../lib/nlp';

/** Wednesday 14 October 2026, 10:00 local. Every expectation below is anchored here. */
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const p = (input: string) => parseInput(input, { now: NOW });

describe('parseInput — relative dates', () => {
  it('parses today', () => {
    const r = p('Standup today');
    expect(r.due).toEqual({ date: '2026-10-14' });
    expect(r.title).toBe('Standup');
  });

  it('parses tomorrow', () => {
    expect(p('Call bank tomorrow').due).toEqual({ date: '2026-10-15' });
  });

  it('parses tonight as today at 20:00', () => {
    expect(p('Review PR tonight').due).toEqual({ date: '2026-10-14', time: '20:00' });
  });

  it('parses the tmrw abbreviation', () => {
    expect(p('Ship it tmrw').due).toEqual({ date: '2026-10-15' });
  });

  it('parses "next week" as the Monday of next week', () => {
    expect(p('Sprint review next week').due).toEqual({ date: '2026-10-19' });
  });

  it('parses "next month" as the 1st of next month', () => {
    expect(p('Renew passport next month').due).toEqual({ date: '2026-11-01' });
  });

  it('parses "next year" as 1 January', () => {
    expect(p('Plan 2027 next year').due).toEqual({ date: '2027-01-01' });
  });

  it('parses "next monday" as the Monday of next week', () => {
    expect(p('Retro next monday').due).toEqual({ date: '2026-10-19' });
  });

  it('parses a bare weekday as the coming one', () => {
    expect(p('Pay rent fri').due).toEqual({ date: '2026-10-16' });
  });

  it('parses a bare weekday matching today as today', () => {
    expect(p('Team sync wednesday').due).toEqual({ date: '2026-10-14' });
  });

  it('parses "in 2 weeks"', () => {
    expect(p('Dentist in 2 weeks').due).toEqual({ date: '2026-10-28' });
  });

  it('parses "in a week" as seven days', () => {
    expect(p('Water plants in a week').due).toEqual({ date: '2026-10-21' });
  });

  it('parses spelled-out counts in "in three days"', () => {
    expect(p('Follow up in three days').due).toEqual({ date: '2026-10-17' });
  });

  it('parses "in 2 months"', () => {
    expect(p('Renew lease in 2 months').due).toEqual({ date: '2026-12-14' });
  });

  it('parses compact offsets like 3d', () => {
    expect(p('Pick parcel 3d').due).toEqual({ date: '2026-10-17' });
  });

  it('parses compact offsets like 2w', () => {
    expect(p('Grocery run 2w').due).toEqual({ date: '2026-10-28' });
  });
});

describe('parseInput — absolute dates', () => {
  it('parses ISO dates', () => {
    expect(p('Flight 2026-12-24').due).toEqual({ date: '2026-12-24' });
  });

  it('parses "jan 5" and rolls into next year when it has passed', () => {
    expect(p('Gift shopping jan 5').due).toEqual({ date: '2027-01-05' });
  });

  it('parses "dec 25" in the current year when still ahead', () => {
    expect(p('Christmas dec 25').due).toEqual({ date: '2026-12-25' });
  });

  it('parses ordinal suffixes', () => {
    expect(p('Deadline oct 21st').due).toEqual({ date: '2026-10-21' });
  });

  it('parses "5 jan" day-first form', () => {
    expect(p('Deadline 5 dec').due).toEqual({ date: '2026-12-05' });
  });

  it('parses slash dates as month/day', () => {
    expect(p('Conference 11/03').due).toEqual({ date: '2026-11-03' });
  });
});

describe('parseInput — times', () => {
  it('parses "at 14:00"', () => {
    expect(p('Deploy at 14:00 today').due).toEqual({ date: '2026-10-14', time: '14:00' });
  });

  it('parses 24-hour times attached to a weekday', () => {
    expect(p('Deploy at 09:30 friday').due).toEqual({ date: '2026-10-16', time: '09:30' });
  });

  it('parses "9am"', () => {
    expect(p('Gym 9am tomorrow').due).toEqual({ date: '2026-10-15', time: '09:00' });
  });

  it('parses "7:30pm"', () => {
    expect(p('Dinner 7:30pm today').due).toEqual({ date: '2026-10-14', time: '19:30' });
  });

  it('parses noon', () => {
    expect(p('Lunch noon today').due).toEqual({ date: '2026-10-14', time: '12:00' });
  });

  it('leaves a standalone time in the title instead of guessing today', () => {
    const r = p('Read at 14:00');
    expect(r.due).toBeNull();
    expect(r.title).toBe('Read at 14:00');
  });

  it('attaches a bare time to the first recurrence date', () => {
    expect(p('Standup every mon 9am').due).toEqual({ date: '2026-10-19', time: '09:00' });
  });

  it('rejects impossible clock values', () => {
    const r = p('Thing at 99:00');
    expect(r.title).toContain('at 99:00');
  });
});

describe('parseInput — recurrence', () => {
  it('parses "every day"', () => {
    expect(p('Water plants every day').recurrence).toEqual({ freq: 'daily', interval: 1 });
  });

  it('parses "every weekday"', () => {
    expect(p('Standup every weekday').recurrence).toEqual({ freq: 'weekdays', interval: 1 });
  });

  it('parses "every monday"', () => {
    expect(p('Team sync every monday').recurrence).toEqual({
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [1],
    });
  });

  it('parses "every mon,wed,fri"', () => {
    expect(p('Gym every mon,wed,fri').recurrence).toEqual({
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5],
    });
  });

  it('parses "every 2 weeks"', () => {
    expect(p('Backup every 2 weeks').recurrence).toEqual({ freq: 'weekly', interval: 2 });
  });

  it('parses "every other week"', () => {
    expect(p('Backup every other week').recurrence).toEqual({ freq: 'weekly', interval: 2 });
  });

  it('parses "daily"', () => {
    expect(p('Journal daily').recurrence).toEqual({ freq: 'daily', interval: 1 });
  });

  it('parses "weekly"', () => {
    expect(p('Review weekly').recurrence).toEqual({ freq: 'weekly', interval: 1 });
  });

  it('parses "monthly"', () => {
    expect(p('Rent monthly').recurrence).toEqual({ freq: 'monthly', interval: 1 });
  });

  it('parses "every weekend" as Saturday and Sunday', () => {
    expect(p('Chores every weekend').recurrence).toEqual({
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [0, 6],
    });
  });
});

describe('parseInput — priority, project, labels', () => {
  it('parses p1', () => {
    expect(p('Fix outage p1').priority).toBe(1);
  });

  it('parses p4', () => {
    expect(p('Someday idea p4').priority).toBe(4);
  });

  it('ignores an out-of-range priority', () => {
    expect(p('Task p5').priority).toBeNull();
    expect(p('Task p5').title).toBe('Task p5');
  });

  it('parses a latin project', () => {
    const r = p('Write spec #Roadmap');
    expect(r.project).toBe('Roadmap');
    expect(r.title).toBe('Write spec');
  });

  it('parses a CJK project', () => {
    const r = p('写周报 #工作');
    expect(r.project).toBe('工作');
    expect(r.title).toBe('写周报');
  });

  it('parses labels', () => {
    const r = p('Fix login @bug @urgent');
    expect(r.labels).toEqual(['bug', 'urgent']);
    expect(r.title).toBe('Fix login');
  });

  it('does not treat #p1 as a priority', () => {
    const r = p('Task #p1');
    expect(r.project).toBe('p1');
    expect(r.priority).toBeNull();
  });

  it('de-duplicates repeated labels', () => {
    expect(p('Task @home @home').labels).toEqual(['home']);
  });
});

describe('parseInput — combined input', () => {
  it('parses date, time, repeat, priority, project and labels together', () => {
    const r = p('Draft #Report @urgent @q4 every monday at 9am p1 tomorrow');
    expect(r.title).toBe('Draft');
    expect(r.project).toBe('Report');
    expect(r.labels).toEqual(['urgent', 'q4']);
    expect(r.priority).toBe(1);
    expect(r.recurrence).toEqual({ freq: 'weekly', interval: 1, daysOfWeek: [1] });
    expect(r.due).toEqual({ date: '2026-10-15', time: '09:00' });
  });

  it('parses a token-dense line with no title left', () => {
    const r = p('#Home');
    expect(r.project).toBe('Home');
    expect(r.title).toBe('#Home');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('keeps only the first date and warns', () => {
    const r = p('Task tomorrow next friday');
    expect(r.due).toEqual({ date: '2026-10-15' });
    expect(r.warnings.join(' ')).toMatch(/more than one date/i);
  });
});

describe('parseInput — conservatism', () => {
  it('leaves an ambiguous bare month name in the title', () => {
    const r = p('You may want to check this');
    expect(r.due).toBeNull();
    expect(r.title).toBe('You may want to check this');
  });

  it('leaves the ambiguous "mar" in the title', () => {
    const r = p('Fix the mar floor');
    expect(r.due).toBeNull();
    expect(r.title).toBe('Fix the mar floor');
  });

  it('does not read "in" at the start of an unrelated word', () => {
    const r = p('Training in the morning');
    expect(r.due).toBeNull();
  });

  it('does not treat "morning" as a time', () => {
    const r = p('Morning run');
    expect(r.due).toBeNull();
    expect(r.title).toBe('Morning run');
  });

  it('returns an empty result for whitespace', () => {
    const r = p('   ');
    expect(r.title).toBe('');
    expect(r.due).toBeNull();
  });

  it('handles CJK text without mangling it', () => {
    const r = p('明天开会 #工作 p2');
    expect(r.title).toBe('开会');
    expect(r.due).toEqual({ date: '2026-10-15' });
    expect(r.project).toBe('工作');
    expect(r.priority).toBe(2);
  });
});

describe('parseInput — Chinese tokens', () => {
  it('parses 明天 as tomorrow', () => {
    expect(p('明天交周报').due).toEqual({ date: '2026-10-15' });
  });

  it('parses 今天 and 今晚', () => {
    expect(p('今天体检').due).toEqual({ date: '2026-10-14' });
    expect(p('今晚复盘').due).toEqual({ date: '2026-10-14', time: '20:00' });
  });

  it('parses 后天 and 大后天', () => {
    expect(p('后天面试').due).toEqual({ date: '2026-10-16' });
    expect(p('大后天出差').due).toEqual({ date: '2026-10-17' });
  });

  it('parses 周三 as the coming Wednesday', () => {
    expect(p('周三汇报').due).toEqual({ date: '2026-10-14' });
  });

  it('parses 下周三 as next week Wednesday', () => {
    expect(p('下周三汇报').due).toEqual({ date: '2026-10-21' });
  });

  it('parses 下周 as next Monday', () => {
    expect(p('下周出差').due).toEqual({ date: '2026-10-19' });
  });

  it('parses 三天后', () => {
    expect(p('三天后回复').due).toEqual({ date: '2026-10-17' });
  });

  it('parses 每天 as a daily repeat', () => {
    expect(p('每天吃药').recurrence).toEqual({ freq: 'daily', interval: 1 });
  });

  it('parses 每周五 as a weekly Friday repeat', () => {
    expect(p('每周五复盘').recurrence).toEqual({
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [5],
    });
  });

  it('parses 每个工作日 as weekdays', () => {
    expect(p('每个工作日通勤').recurrence).toEqual({ freq: 'weekdays', interval: 1 });
  });

  it('parses 下午3点半 as 15:30 and attaches it to the date', () => {
    // A bare clock time is never attached to an invented "today" — it needs a date.
    expect(p('下午3点半面试 今天').due).toEqual({ date: '2026-10-14', time: '15:30' });
    expect(p('下午3点半面试 今天').title).toBe('面试');
  });

  it('parses the Chinese numeral form 三点半 as 03:30', () => {
    expect(p('面试 三点半 今天').due).toEqual({ date: '2026-10-14', time: '03:30' });
  });

  it('leaves a bare Chinese clock time in the title', () => {
    const r = p('面试 下午三点半');
    expect(r.due).toBeNull();
    expect(r.title).toBe('面试 下午三点半');
  });

  it('does not read 点头 as a time', () => {
    expect(p('会议点头记录').due).toBeNull();
  });
});

describe('previewChips', () => {
  it('renders one chip per recognised token in priority order', () => {
    const r = p('Draft #Report @urgent p1 every monday tomorrow at 9am');
    const chips = previewChips(r, (k) => k);
    expect(chips.map((c) => c.type)).toEqual([
      'date',
      'recurrence',
      'priority',
      'project',
      'label',
    ]);
    expect(chips[0].text).toBe('2026-10-15 at 09:00');
    expect(chips[2].text).toContain('p1');
  });

  it('returns no chips for a plain title', () => {
    expect(previewChips(p('Just a title'), (k) => k)).toEqual([]);
  });
});
