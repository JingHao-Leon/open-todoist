import type { Priority, Project, Recurrence, Task } from '../types';
import { newId } from './id';

/** Portable JSON document. Plain data, so it diffs and reads well. */
export interface ExportDocument {
  app: 'open-todoist';
  schemaVersion: 1;
  exportedAt: string;
  projects: Project[];
  tasks: Task[];
}

export interface ImportResult {
  tasks: Task[];
  projects: Project[];
  /** Non-fatal problems, surfaced in the UI. */
  warnings: string[];
}

export function buildExport(tasks: Task[], projects: Project[], now: Date = new Date()): ExportDocument {
  return {
    app: 'open-todoist',
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    tasks: [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    projects: [...projects].sort((a, b) => a.order - b.order),
  };
}

export function toJson(tasks: Task[], projects: Project[], now?: Date): string {
  return `${JSON.stringify(buildExport(tasks, projects, now), null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asPriority(value: unknown): Priority {
  const n = typeof value === 'number' ? value : Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 ? (n as Priority) : 4;
}

function asLabels(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function asRecurrence(value: unknown): Recurrence | null {
  if (!isRecord(value)) return null;
  const intervalRaw = Number(value.interval);
  const interval = Number.isFinite(intervalRaw) && intervalRaw >= 1 ? Math.floor(intervalRaw) : 1;
  switch (value.freq) {
    case 'daily':
      return { freq: 'daily', interval };
    case 'weekdays':
      return { freq: 'weekdays', interval: 1 };
    case 'weekly': {
      const days = Array.isArray(value.daysOfWeek)
        ? value.daysOfWeek.map(Number).filter((d) => d >= 0 && d <= 6)
        : undefined;
      return days && days.length > 0
        ? { freq: 'weekly', interval, daysOfWeek: [...new Set(days)].sort((a, b) => a - b) }
        : { freq: 'weekly', interval };
    }
    case 'monthly':
      return { freq: 'monthly', interval };
    case 'yearly':
      return { freq: 'yearly', interval };
    default:
      return null;
  }
}

function asDue(value: unknown): Task['due'] {
  if (!isRecord(value)) return null;
  const date = asString(value.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = asString(value.time);
  return /^\d{2}:\d{2}$/.test(time) ? { date, time } : { date };
}

/**
 * Parse an exported document.
 *
 * Unknown project references are materialised as real projects rather than
 * dropped into the Inbox, so an import never silently loses a grouping.
 */
export function parseImport(text: string): ImportResult {
  const warnings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isRecord(raw)) throw new Error('Expected a JSON object at the top level.');

  const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  if (rawProjects.length === 0 && rawTasks.length === 0) {
    throw new Error('No projects or tasks found in that file.');
  }

  const projects: Project[] = rawProjects.filter(isRecord).map((p, index) => ({
    id: asString(p.id) || newId(),
    name: asString(p.name, 'Untitled'),
    order: Number.isFinite(Number(p.order)) ? Number(p.order) : index,
    isDeleted: Boolean(p.isDeleted),
    createdAt: asString(p.createdAt, new Date().toISOString()),
    ...(typeof p.color === 'string' ? { color: p.color } : {}),
  }));

  const knownProjectIds = new Set(projects.map((p) => p.id));
  const created = new Map<string, Project>();

  const tasks: Task[] = rawTasks.filter(isRecord).map((t) => {
    let projectId: string | null = asString(t.projectId) || null;

    if (projectId !== null && !knownProjectIds.has(projectId)) {
      let placeholder = created.get(projectId);
      if (!placeholder) {
        placeholder = {
          id: projectId,
          name: 'Recovered project',
          order: projects.length + created.size,
          isDeleted: false,
          createdAt: new Date().toISOString(),
        };
        created.set(projectId, placeholder);
        knownProjectIds.add(projectId);
        warnings.push(`Created a placeholder for missing project "${projectId}".`);
      }
      projectId = placeholder.id;
    }

    const due = asDue(t.due);
    return {
      id: asString(t.id) || newId(),
      title: asString(t.title, 'Untitled'),
      description: asString(t.description),
      projectId,
      labels: asLabels(t.labels),
      priority: asPriority(t.priority),
      due,
      recurrence: asRecurrence(t.recurrence),
      createdAt: asString(t.createdAt, new Date().toISOString()),
      completedAt: t.completedAt ? asString(t.completedAt) : null,
      order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
      isDeleted: Boolean(t.isDeleted),
      deletedAt: t.deletedAt ? asString(t.deletedAt) : null,
    } satisfies Task;
  });

  if (rawTasks.some((t) => !isRecord(t))) {
    warnings.push('Some entries were not objects and were skipped.');
  }

  return { tasks, projects: [...projects, ...created.values()], warnings };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function recurrenceText(rec: Recurrence | null): string {
  if (!rec) return '';
  if (rec.freq === 'weekdays') return 'weekdays';
  const prefix = rec.interval > 1 ? `${rec.interval} ` : '';
  if (rec.freq === 'weekly' && rec.daysOfWeek && rec.daysOfWeek.length > 0) {
    const names = rec.daysOfWeek.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]);
    return `${prefix}week on ${names.join(' ')}`;
  }
  return `${prefix}${rec.freq}`;
}

export const CSV_COLUMNS = [
  'id',
  'title',
  'description',
  'project',
  'labels',
  'priority',
  'due_date',
  'due_time',
  'recurrence',
  'status',
  'created_at',
  'completed_at',
] as const;

export function toCsv(tasks: Task[], projects: Project[]): string {
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const header = CSV_COLUMNS.join(',');
  const rows = tasks.map((t) => {
    const cells: Record<string, string> = {
      id: t.id,
      title: t.title,
      description: t.description,
      project: t.projectId ? (projectName.get(t.projectId) ?? 'Unknown') : '',
      labels: t.labels.join(' '),
      priority: String(t.priority),
      due_date: t.due?.date ?? '',
      due_time: t.due?.time ?? '',
      recurrence: recurrenceText(t.recurrence),
      status: t.isDeleted ? 'trashed' : t.completedAt ? 'completed' : 'open',
      created_at: t.createdAt,
      completed_at: t.completedAt ?? '',
    };
    return CSV_COLUMNS.map((c) => csvCell(cells[c])).join(',');
  });
  return `${[header, ...rows].join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* Browser file helpers                                                */
/* ------------------------------------------------------------------ */

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function stamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}
