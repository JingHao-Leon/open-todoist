/**
 * Core domain types for open-todoist.
 *
 * Everything is local-first: a task is a plain serialisable object, stored in
 * IndexedDB and kept in memory. There is no server model and no sync protocol.
 */

/** 1 = urgent (red) … 4 = no priority (grey). Matches the p1..p4 quick-add tokens. */
export type Priority = 1 | 2 | 3 | 4;

export type Recurrence =
  | { freq: 'daily'; interval: number }
  | { freq: 'weekdays'; interval: 1 }
  | { freq: 'weekly'; interval: number; daysOfWeek?: number[] }
  | { freq: 'monthly'; interval: number }
  | { freq: 'yearly'; interval: number };

export interface DueDate {
  /** Calendar day, `YYYY-MM-DD`, in the user's local timezone. */
  date: string;
  /** Optional `HH:mm`, 24-hour. */
  time?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** Project id, or `null` for Inbox. */
  projectId: string | null;
  labels: string[];
  priority: Priority;
  due: DueDate | null;
  recurrence: Recurrence | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp, or `null` while open. */
  completedAt: string | null;
  /** Fractional index inside its view; lower sorts first. */
  order: number;
  /** Soft-delete flag. Deleted tasks live in the trash view. */
  isDeleted: boolean;
  /** ISO timestamp of when the task was moved to trash, for purge ordering. */
  deletedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  /** Sort position of the project in the sidebar. */
  order: number;
  isDeleted: boolean;
  createdAt: string;
  /** Optional accent colour (hex) used for the project dot. */
  color?: string;
}

/** A named, reusable view definition. */
export type ViewId =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'trash'
  | `project:${string}`
  | `label:${string}`;

export type SortKey =
  | 'order'
  | 'dueDate'
  | 'priority'
  | 'alpha'
  | 'createdAt';

export type SortDir = 'asc' | 'desc';

export interface Filter {
  projects: string[];
  labels: string[];
  priorities: Priority[];
  /** Only tasks due on or before this date (inclusive). */
  dueBefore: string | null;
}

export interface ParseMatch {
  type: 'date' | 'time' | 'recurrence' | 'priority' | 'project' | 'label';
  /** The literal text that was consumed from the input. */
  raw: string;
  start: number;
  end: number;
}

export interface ParseResult {
  /** Input with every recognised token removed, whitespace collapsed. */
  title: string;
  due: DueDate | null;
  recurrence: Recurrence | null;
  priority: Priority | null;
  project: string | null;
  labels: string[];
  matches: ParseMatch[];
  /** Tokens the parser understood but deliberately ignored. */
  warnings: string[];
}

export interface AppStats {
  completedToday: number;
  dueToday: number;
  overdue: number;
  streak: number;
  /** Longest run of consecutive days ending today (or yesterday). */
  longestStreak: number;
  completionsByDate: Array<{ date: string; count: number }>;
  completionsByProject: Array<{ projectId: string | null; name: string; count: number }>;
  completionsByLabel: Array<{ label: string; count: number }>;
}
