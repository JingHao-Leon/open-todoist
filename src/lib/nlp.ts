import type { DueDate, ParseMatch, ParseResult, Priority, Recurrence } from '../types';
import {
  addDays,
  addMonths,
  addYears,
  startOfWeek,
  toKey,
  today,
  weekdayOf,
  type CalendarDate,
} from './date';
import { describeRecurrence, nextOccurrence } from './recurrence';

/**
 * Natural-language quick-add parser.
 *
 * Implemented as one left-to-right scan. At each cursor position the matchers
 * are tried in a fixed order and the first hit consumes its span, so no token
 * can be matched twice or half-matched. The title is then rebuilt from the
 * spans the scan did *not* consume.
 *
 * Deliberate conservatism: when a token is ambiguous — a bare month name such as
 * `may`, or `mar` which could be Tuesday or March — the parser declines to
 * consume it and leaves it in the title. A leftover word is a visible mistake
 * the user can fix; a silently mis-set due date is not.
 */

export interface ParseOptions {
  /** Injectable clock so tests are deterministic. */
  now?: Date;
}

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

const WEEKDAY_FULL = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Abbreviations accepted as standalone weekdays.
 *
 * `mar`, `may`, `jun`, `jul`, `aug`, `sep` and `oct` are deliberately absent:
 * each collides with a month abbreviation and would turn an ordinary word into
 * a bogus due date. Full weekday names always work.
 */
const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const MONTH_ABBR: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const COUNT_ALT = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';

/* Chinese vocabulary. Chinese has no word delimiters, so these are matched as
   literal substrings and are therefore safe from the ambiguity that forces the
   English matcher to be conservative. */

const CJK_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const CJK_WEEKDAY: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

const CJK_NUM_CHARS = '零〇一二两三四五六七八九十';

/* ------------------------------------------------------------------ */
/* Unicode-aware boundary helpers (`\b` is ASCII-only)                 */
/* ------------------------------------------------------------------ */

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** True when `i` begins a token: at a string edge or right after a non-word char. */
function tokenStart(input: string, i: number): boolean {
  return i === 0 || !isWordChar(input[i - 1]);
}

/** True when `j` ends a token: at a string edge or right before a non-word char. */
function tokenEnd(input: string, j: number): boolean {
  return j >= input.length || !isWordChar(input[j]);
}

function normalizeWeekday(raw: string): number {
  const w = raw.toLowerCase().replace(/s$/, '');
  const full = WEEKDAY_FULL.indexOf(w);
  if (full >= 0) return full;
  const abbr = WEEKDAY_ABBR.indexOf(w);
  return abbr; // -1 means "ambiguous or unknown"
}

function parseCount(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const lower = raw.toLowerCase();
  return lower in NUMBER_WORDS ? NUMBER_WORDS[lower] : null;
}

/* ------------------------------------------------------------------ */
/* Scanner context and match shape                                     */
/* ------------------------------------------------------------------ */

type MatchType = ParseMatch['type'];

interface Hit {
  type: MatchType;
  raw: string;
  length: number;
  apply: (ctx: Ctx) => void;
}

interface Ctx {
  today: CalendarDate;
  due: DueDate | null;
  time: string | null;
  /** Index into `matches` of the consumed time span, so it can be given back. */
  timeMatchIndex: number;
  recurrence: Recurrence | null;
  priority: Priority | null;
  project: string | null;
  labels: string[];
  dateCount: number;
  recurrenceCount: number;
  priorityCount: number;
  projectCount: number;
}

/* ------------------------------------------------------------------ */
/* Matchers                                                            */
/* ------------------------------------------------------------------ */

function matchProject(input: string, i: number): Hit | null {
  if (input[i] !== '#' || !tokenStart(input, i)) return null;
  const m = /^#[^\s#@]+/u.exec(input.slice(i));
  if (!m) return null;
  return {
    type: 'project',
    raw: m[0],
    length: m[0].length,
    apply: (ctx) => {
      if (ctx.projectCount === 0) ctx.project = m[0].slice(1);
      ctx.projectCount += 1;
    },
  };
}

function matchLabel(input: string, i: number): Hit | null {
  if (input[i] !== '@' || !tokenStart(input, i)) return null;
  const m = /^@[^\s#@]+/u.exec(input.slice(i));
  if (!m) return null;
  return {
    type: 'label',
    raw: m[0],
    length: m[0].length,
    apply: (ctx) => {
      const name = m[0].slice(1);
      if (!ctx.labels.includes(name)) ctx.labels.push(name);
    },
  };
}

function matchPriority(input: string, i: number): Hit | null {
  if (!tokenStart(input, i)) return null;
  const len = /^p[1-4](?=\W|$)/i.exec(input.slice(i))?.[0].length ?? 0;
  if (len === 0 || !tokenEnd(input, i + len)) return null;
  return {
    type: 'priority',
    raw: input.slice(i, i + len),
    length: len,
    apply: (ctx) => {
      if (ctx.priorityCount === 0) ctx.priority = Number(input[i + 1]) as Priority;
      ctx.priorityCount += 1;
    },
  };
}

/** Parse a Chinese numeral (0-99 is plenty for dates and clock times). */
function cjkNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  let section = 0;
  for (const ch of raw) {
    if (ch === '十') {
      section = (section || 1) * 10;
    } else {
      const d = CJK_DIGITS[ch];
      if (d === undefined) return null;
      section = section + d;
    }
  }
  return section;
}

/**
 * Chinese quick-add tokens: repeat, date and clock time.
 *
 * Chinese carries no word delimiters, so these substrings are unambiguous in a
 * way the English ones are not — which is why 明天 can be a hard date while the
 * English word `may` cannot.
 */
function matchCJK(input: string, i: number, ctx: Ctx): Hit | null {
  if (!tokenStart(input, i)) return null;
  const slice = input.slice(i);

  const dateHit = (raw: string, date: string, time?: string): Hit => ({
    type: 'date',
    raw,
    length: raw.length,
    apply: (c) => {
      if (c.dateCount === 0) c.due = time ? { date, time } : { date };
      c.dateCount += 1;
    },
  });

  /* ---------------- repeat ---------------- */

  let m = new RegExp(
    `^(?:每个|每)(?:(\\d+|[${CJK_NUM_CHARS}]+))?` +
      `(工作日|周末|天|日|周|星期|礼拜|月|年)([一二三四五六日天])?`,
  ).exec(slice);
  if (m) {
    const unit = m[2];
    const n = m[1] ? (cjkNumber(m[1]) ?? 1) : 1;
    let rec: Recurrence;
    if (unit === '工作日') {
      rec = { freq: 'weekdays', interval: 1 };
    } else if (unit === '周末') {
      rec = { freq: 'weekly', interval: n, daysOfWeek: [0, 6] };
    } else if (m[3] !== undefined && CJK_WEEKDAY[m[3]] !== undefined) {
      rec = { freq: 'weekly', interval: n, daysOfWeek: [CJK_WEEKDAY[m[3]]] };
    } else if (unit === '天' || unit === '日') {
      rec = { freq: 'daily', interval: n };
    } else if (unit === '月') {
      rec = { freq: 'monthly', interval: n };
    } else if (unit === '年') {
      rec = { freq: 'yearly', interval: n };
    } else {
      rec = { freq: 'weekly', interval: n };
    }
    return {
      type: 'recurrence',
      raw: m[0],
      length: m[0].length,
      apply: (c) => {
        if (c.recurrenceCount === 0) c.recurrence = rec;
        c.recurrenceCount += 1;
      },
    };
  }

  /* ---------------- date ---------------- */

  if (slice.startsWith('大后天')) {
    return dateHit('大后天', toKey(addDays(ctx.today, 3)));
  }
  if (slice.startsWith('后天')) {
    return dateHit('后天', toKey(addDays(ctx.today, 2)));
  }
  if (slice.startsWith('今晚')) {
    return dateHit('今晚', toKey(ctx.today), '20:00');
  }
  if (slice.startsWith('今天') || slice.startsWith('今日')) {
    return dateHit(slice.slice(0, 2), toKey(ctx.today));
  }
  if (slice.startsWith('明天') || slice.startsWith('明日')) {
    return dateHit(slice.slice(0, 2), toKey(addDays(ctx.today, 1)));
  }

  // 下周三 → next week's Wednesday; 下周 → next Monday
  m = /^下(?:个)?(?:周|星期|礼拜)([一二三四五六日天])?/.exec(slice);
  if (m) {
    // No weekday given means "next week" itself, which anchors on Monday.
    const wd = m[1] !== undefined ? CJK_WEEKDAY[m[1]] : 1;
    if (wd !== undefined) {
      const offset = wd === 0 ? 6 : wd - 1;
      return dateHit(m[0], toKey(addDays(startOfWeek(ctx.today), 7 + offset)));
    }
  }

  const nextMonthKey = slice.startsWith('下个月')
    ? toKey({ y: ctx.today.y, m: ctx.today.m === 12 ? 1 : ctx.today.m + 1, d: 1 })
    : slice.startsWith('下月')
      ? toKey({ y: ctx.today.y, m: ctx.today.m === 12 ? 1 : ctx.today.m + 1, d: 1 })
      : null;
  if (nextMonthKey !== null) {
    return dateHit(slice.startsWith('下个月') ? '下个月' : '下月', nextMonthKey);
  }
  if (slice.startsWith('明年')) {
    return dateHit('明年', toKey({ y: ctx.today.y + 1, m: 1, d: 1 }));
  }

  // 周三 → the coming Wednesday
  m = /^(?:周|星期|礼拜)([一二三四五六日天])/.exec(slice);
  if (m) {
    const wd = CJK_WEEKDAY[m[1]];
    if (wd !== undefined) {
      const delta = (wd - weekdayOf(ctx.today) + 7) % 7;
      return dateHit(m[0], toKey(addDays(ctx.today, delta)));
    }
  }

  // 三天后 / 2个月后
  m = new RegExp(`^(\\d+|[${CJK_NUM_CHARS}]+)(个)?(天|日|周|月|年)(后|以后)`).exec(slice);
  if (m) {
    const n = cjkNumber(m[1]);
    if (n !== null) {
      const unit = m[3];
      const base = ctx.today;
      const date =
        unit === '天' || unit === '日'
          ? toKey(addDays(base, n))
          : unit === '周'
            ? toKey(addDays(base, n * 7))
            : unit === '月'
              ? toKey(addMonths(base, n))
              : toKey(addYears(base, n));
      return dateHit(m[0], date);
    }
  }

  /* ---------------- clock time ---------------- */

  if (ctx.time) return null;
  // The numeral may be typed in either script: 下午3点半 and 下午三点半 both work.
  m = new RegExp(
    `^(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\\s*` +
      `([\\d${CJK_NUM_CHARS}]{1,3})点(半|([\\d${CJK_NUM_CHARS}]{1,3})分)?`,
  ).exec(slice);
  if (m) {
    const period = m[1] ?? '';
    const hour = cjkNumber(m[2]);
    const minutes = m[3] === '半' ? 30 : m[4] !== undefined ? (cjkNumber(m[4]) ?? 0) : 0;
    if (hour !== null && minutes <= 59) {
      let h = hour;
      if (period === '中午') h = 12;
      else if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') && h < 12) h += 12;
      if (period === '' && (h > 23 || minutes > 59)) return null;
      if (h <= 23) {
        const time = `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return {
          type: 'time',
          raw: m[0],
          length: m[0].length,
          apply: (c) => {
            c.time = time;
          },
        };
      }
    }
  }

  return null;
}

function freqFor(unit: string, interval: number): Recurrence {  switch (unit) {
    case 'day':
      return { freq: 'daily', interval };
    case 'week':
      return { freq: 'weekly', interval };
    case 'month':
      return { freq: 'monthly', interval };
    default:
      return { freq: 'yearly', interval };
  }
}

function matchRecurrence(input: string, i: number): Hit | null {
  if (!tokenStart(input, i)) return null;
  const slice = input.slice(i);

  const hit = (type: MatchType, raw: string, rec: Recurrence): Hit => ({
    type,
    raw,
    length: raw.length,
    apply: (ctx) => {
      if (ctx.recurrenceCount === 0) ctx.recurrence = rec;
      ctx.recurrenceCount += 1;
    },
  });

  // "every other week"
  let m = /^every\s+other\s+(day|week|month|year)s?\b/i.exec(slice);
  if (m) return hit('recurrence', m[0], freqFor(m[1].toLowerCase(), 2));

  // "every 2 weeks", "every weekday", "every day"
  m = new RegExp(
    `^every\\s+(?:(\\d+|${COUNT_ALT})\\s+)?(day|week|month|year|weekday|weekend)s?\\b`,
    'i',
  ).exec(slice);
  if (m) {
    const unit = m[2].toLowerCase();
    const n = m[1] ? (parseCount(m[1]) ?? 1) : 1;
    if (unit === 'weekday') {
      return n === 1 ? hit('recurrence', m[0], { freq: 'weekdays', interval: 1 }) : null;
    }
    if (unit === 'weekend') {
      return hit('recurrence', m[0], { freq: 'weekly', interval: n, daysOfWeek: [0, 6] });
    }
    return hit('recurrence', m[0], freqFor(unit, n));
  }

  // "every monday", "every mon,wed,fri"
  m = /^every\s+([a-z]+(?:\s*,\s*[a-z]+)*)s?\b/i.exec(slice);
  if (m) {
    const parts = m[1].split(',').map((p) => normalizeWeekday(p.trim()));
    if (parts.length > 0 && parts.every((p) => p >= 0)) {
      const days = [...new Set(parts as number[])].sort((a, b) => a - b);
      return hit('recurrence', m[0], { freq: 'weekly', interval: 1, daysOfWeek: days });
    }
    return null;
  }

  // "daily", "weekly", "biweekly", "monthly", "yearly", "annually"
  m = /^(daily|weekly|biweekly|fortnightly|monthly|yearly|annually)\b/i.exec(slice);
  if (m) {
    const rec: Recurrence =
      m[1].toLowerCase() === 'daily'
        ? { freq: 'daily', interval: 1 }
        : m[1].toLowerCase() === 'weekly'
          ? { freq: 'weekly', interval: 1 }
          : m[1].toLowerCase() === 'biweekly' || m[1].toLowerCase() === 'fortnightly'
            ? { freq: 'weekly', interval: 2 }
            : m[1].toLowerCase() === 'monthly'
              ? { freq: 'monthly', interval: 1 }
              : { freq: 'yearly', interval: 1 };
    return hit('recurrence', m[0], rec);
  }

  return null;
}

function matchDate(input: string, i: number, ctx: Ctx): Hit | null {
  if (!tokenStart(input, i)) return null;
  const slice = input.slice(i);

  const dateHit = (raw: string, date: string, time?: string): Hit => ({
    type: 'date',
    raw,
    length: raw.length,
    apply: (c) => {
      if (c.dateCount === 0) c.due = time ? { date, time } : { date };
      c.dateCount += 1;
    },
  });

  // "in 2 weeks", "in a week", "in three days"
  let m = new RegExp(
    `^in\\s+(?:(\\d+|${COUNT_ALT})\\s+)?(day|week|month|year)s?\\b`,
    'i',
  ).exec(slice);
  if (m) {
    const n = m[1] ? (parseCount(m[1]) ?? 1) : 1;
    const unit = m[2].toLowerCase();
    const base = ctx.today;
    const date =
      unit === 'day'
        ? toKey(addDays(base, n))
        : unit === 'week'
          ? toKey(addDays(base, n * 7))
          : unit === 'month'
            ? toKey(addMonths(base, n))
            : toKey(addYears(base, n));
    return dateHit(m[0], date);
  }

  // "next week" / "next month" / "next year" — calendar starts, not +1 offsets
  m = /^next\s+(week|month|year)\b/i.exec(slice);
  if (m) {
    const unit = m[1].toLowerCase();
    const date =
      unit === 'week'
        ? toKey(addDays(startOfWeek(ctx.today), 7))
        : unit === 'month'
          ? toKey({
              y: ctx.today.y,
              m: ctx.today.m === 12 ? 1 : ctx.today.m + 1,
              d: 1,
            })
          : toKey({ y: ctx.today.y + 1, m: 1, d: 1 });
    return dateHit(m[0], date);
  }

  // "next monday" — the weekday inside *next* week
  m = /^next\s+([a-z]+)s?\b/i.exec(slice);
  if (m) {
    const wd = normalizeWeekday(m[1]);
    if (wd >= 0) {
      const start = startOfWeek(ctx.today);
      return dateHit(m[0], toKey(addDays(start, 7 + (wd === 0 ? 6 : wd - 1))));
    }
  }

  // "today", "tonight", "tomorrow"
  m = /^(today|tonight|tomorrow|tmrw|tmr|tmw)\b/i.exec(slice);
  if (m) {
    const word = m[1].toLowerCase();
    if (word === 'today') return dateHit(m[0], toKey(ctx.today));
    if (word === 'tonight') return dateHit(m[0], toKey(ctx.today), '20:00');
    return dateHit(m[0], toKey(addDays(ctx.today, 1)));
  }

  // "2026-10-20"
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(slice);
  if (m) return dateHit(m[0], toKey({ y: +m[1], m: +m[2], d: +m[3] }));

  // "jan 5", "january 5th"
  m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(slice);
  if (m) {
    const month = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
    const day = Number(m[2]);
    if (month && day >= 1 && day <= 31) return dateHit(m[0], monthDay(month, day, ctx));
  }

  // "5 jan", "5th of jan"
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/i.exec(slice);
  if (m) {
    const month = MONTH_ABBR[m[2].toLowerCase().slice(0, 3)];
    const day = Number(m[1]);
    if (month && day >= 1 && day <= 31) return dateHit(m[0], monthDay(month, day, ctx));
  }

  // "10/20" — the first number is always read as the month
  m = /^(\d{1,2})\/(\d{1,2})\b/.exec(slice);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return dateHit(m[0], monthDay(month, day, ctx));
    }
  }

  // "3d", "2w", "10m", "1y"
  m = /^(\d{1,3})([dwmy])\b/i.exec(slice);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const base = ctx.today;
    const date =
      unit === 'd'
        ? toKey(addDays(base, n))
        : unit === 'w'
          ? toKey(addDays(base, n * 7))
          : unit === 'm'
            ? toKey(addMonths(base, n))
            : toKey(addYears(base, n));
    return dateHit(m[0], date);
  }

  // Bare weekday: today when it matches, otherwise the coming one
  m = /^([a-z]{3,9})\b/i.exec(slice);
  if (m) {
    const wd = normalizeWeekday(m[1]);
    if (wd >= 0) {
      const delta = (wd - weekdayOf(ctx.today) + 7) % 7;
      return dateHit(m[0], toKey(addDays(ctx.today, delta)));
    }
  }

  return null;
}

/** Bare `jan 5` read in December means next January. */
function monthDay(month: number, day: number, ctx: Ctx): string {
  const thisYear = toKey({ y: ctx.today.y, m: month, d: day });
  if (thisYear < toKey(ctx.today)) {
    return toKey({ y: ctx.today.y + 1, m: month, d: day });
  }
  return thisYear;
}

function matchTime(input: string, i: number, ctx: Ctx): Hit | null {
  if (!tokenStart(input, i)) return null;
  // Only one clock time per task; a second one stays in the title.
  if (ctx.time) return null;
  const slice = input.slice(i);

  const hit = (raw: string, time: string): Hit => ({
    type: 'time',
    raw,
    length: raw.length,
    apply: (c) => {
      c.time = time;
    },
  });

  const toTime = (h: string, min: string | undefined, mer: string | undefined): string | null => {
    let hour = Number(h);
    const minutes = min === undefined ? 0 : Number(min);
    if (minutes > 59) return null;
    if (mer) {
      if (hour < 1 || hour > 12) return null;
      if (mer === 'pm' && hour !== 12) hour += 12;
      if (mer === 'am' && hour === 12) hour = 0;
    } else if (hour > 23) {
      return null;
    }
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  let m = /^at\s+(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?\b/i.exec(slice);
  if (m) {
    const t = toTime(m[1], m[2], m[3]);
    if (t) return hit(m[0], t);
  }

  m = /^at\s+(\d{1,2})\s*(am|pm)\b/i.exec(slice);
  if (m) {
    const t = toTime(m[1], undefined, m[2]);
    if (t) return hit(m[0], t);
  }

  m = /^at\s+(\d{1,2})\b/i.exec(slice);
  if (m) {
    const t = toTime(m[1], undefined, undefined);
    if (t) return hit(m[0], t);
  }

  m = /^(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)\b/i.exec(slice);
  if (m) {
    const t = toTime(m[1], m[2], m[3]);
    if (t) return hit(m[0], t);
  }

  m = /^(\d{1,2})\s*(am|pm)\b/i.exec(slice);
  if (m) {
    const t = toTime(m[1], undefined, m[2]);
    if (t) return hit(m[0], t);
  }

  // Only unambiguous clock words. "morning"/"evening"/"night" are far too
  // common inside ordinary task titles to be treated as times.
  m = /^(noon|midnight)\b/i.exec(slice);
  if (m) return hit(m[0], m[1].toLowerCase() === 'noon' ? '12:00' : '00:00');

  return null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse one line of quick-add text into a structured result.
 * The returned `title` has every consumed token removed.
 */
export function parseInput(input: string, opts: ParseOptions = {}): ParseResult {
  const now = opts.now ?? new Date();
  const ctx: Ctx = {
    today: today(now),
    due: null,
    time: null,
    timeMatchIndex: -1,
    recurrence: null,
    priority: null,
    project: null,
    labels: [],
    dateCount: 0,
    recurrenceCount: 0,
    priorityCount: 0,
    projectCount: 0,
  };

  const matches: ParseMatch[] = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i += 1;
      continue;
    }
    const hit =
      matchProject(input, i) ??
      matchLabel(input, i) ??
      matchPriority(input, i) ??
      matchCJK(input, i, ctx) ??
      matchRecurrence(input, i) ??
      matchDate(input, i, ctx) ??
      matchTime(input, i, ctx);

    if (!hit) {
      i += 1;
      continue;
    }
    if (hit.type === 'time') ctx.timeMatchIndex = matches.length;
    hit.apply(ctx);
    matches.push({ type: hit.type, raw: hit.raw, start: i, end: i + hit.length });
    i += hit.length;
  }

  // A time with neither a date nor a recurrence has nothing to attach to.
  // Rather than silently assume "today", give the text back to the title.
  let due = ctx.due;
  if (ctx.time && !due && !ctx.recurrence) {
    ctx.time = null;
    if (ctx.timeMatchIndex >= 0) matches.splice(ctx.timeMatchIndex, 1);
  }

  // A recurrence implies a first fire date, which lets a bare time attach.
  if (!due && ctx.time && ctx.recurrence) {
    due = { date: nextOccurrence(ctx.recurrence, ctx.today), time: ctx.time };
  }
  if (due && ctx.time && due.time === undefined) {
    due = { ...due, time: ctx.time };
  }

  let title = buildTitle(input, matches);

  const warnings: string[] = [];
  if (ctx.dateCount > 1) warnings.push('More than one date found; kept the first.');
  if (ctx.recurrenceCount > 1) warnings.push('More than one repeat found; kept the first.');
  if (ctx.priorityCount > 1) warnings.push('More than one priority found; kept the first.');
  if (ctx.projectCount > 1) warnings.push('More than one project found; kept the first.');
  if (title === '' && input.trim() !== '') {
    title = input.trim();
    warnings.push('The line held only tokens, so it was kept as the title.');
  }

  return {
    title,
    due,
    recurrence: ctx.recurrence,
    priority: ctx.priority,
    project: ctx.project,
    labels: ctx.labels,
    matches,
    warnings,
  };
}

/** Rebuild the title from the spans the scanner did not consume. */
function buildTitle(input: string, matches: ParseMatch[]): string {
  const keep = new Array<boolean>(input.length).fill(true);
  for (const m of matches) {
    for (let k = m.start; k < m.end && k < input.length; k += 1) keep[k] = false;
  }
  let out = '';
  for (let k = 0; k < input.length; k += 1) out += keep[k] ? input[k] : ' ';
  return out.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Live preview chips                                                  */
/* ------------------------------------------------------------------ */

export interface ParseChip {
  type: MatchType;
  text: string;
}

/**
 * Ordered chips for the live preview under the quick-add box.
 * `humanDate` is injected so the parser stays free of formatting concerns.
 */
export function previewChips(result: ParseResult, humanDate: (key: string) => string): ParseChip[] {
  const chips: ParseChip[] = [];
  if (result.due) {
    const day = humanDate(result.due.date);
    chips.push({
      type: 'date',
      text: result.due.time ? `${day} at ${result.due.time}` : day,
    });
  }
  if (result.recurrence) {
    chips.push({ type: 'recurrence', text: describeRecurrence(result.recurrence) });
  }
  if (result.priority !== null) {
    const names: Record<Priority, string> = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'None' };
    chips.push({ type: 'priority', text: `p${result.priority} · ${names[result.priority]}` });
  }
  if (result.project) chips.push({ type: 'project', text: `#${result.project}` });
  for (const label of result.labels) chips.push({ type: 'label', text: `@${label}` });
  return chips;
}
