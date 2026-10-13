import type { Filter, Project, SortDir, SortKey, Task } from '../types';
import { isToday, toKey, today } from './date';
import { occurrencesWithin } from './recurrence';

/** Selects which tasks a view is allowed to show, before sorting. */
export function matchesView(task: Task, viewId: string, todayKey: string): boolean {
  if (viewId === 'trash') return task.isDeleted;
  if (task.isDeleted) return false;

  if (viewId === 'inbox') return task.projectId === null;
  if (viewId === 'completed') return task.completedAt !== null;
  if (viewId === 'today') {
    if (task.completedAt !== null) return false;
    if (task.due === null) return false;
    if (task.due.date <= todayKey) return true;
    return false;
  }
  if (viewId === 'upcoming') {
    if (task.completedAt !== null) return false;
    if (task.due === null) return false;
    return task.due.date > todayKey;
  }
  if (viewId.startsWith('project:')) {
    return task.projectId === viewId.slice('project:'.length);
  }
  if (viewId.startsWith('label:')) {
    const label = viewId.slice('label:'.length);
    return task.labels.includes(label);
  }
  return true;
}

/**
 * Every date a recurring task will occupy inside a window.
 *
 * A recurring task has no single "due date" in the strict sense, so views that
 * are date-driven (Today, Upcoming) project it onto the days it actually fires.
 */
export function taskOccurrences(task: Task, todayKey: string, horizonDays = 400): string[] {
  if (!task.recurrence) return task.due ? [task.due.date] : [];
  // Search from a little before today so a task that already fired still shows.
  const from = shiftKey(todayKey, -7);
  return occurrencesWithin(task.recurrence, from, horizonDays);
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map((p) => Number.parseInt(p, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toKey({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });
}

export function matchesFilter(task: Task, filter: Filter): boolean {
  if (filter.projects.length > 0) {
    const key = task.projectId ?? 'inbox';
    if (!filter.projects.includes(key)) return false;
  }
  if (filter.labels.length > 0) {
    if (!filter.labels.some((l) => task.labels.includes(l))) return false;
  }
  if (filter.priorities.length > 0) {
    if (!filter.priorities.includes(task.priority)) return false;
  }
  if (filter.dueBefore !== null) {
    if (!task.due || task.due.date > filter.dueBefore) return false;
  }
  return true;
}

/** Undated tasks always sort last, whatever the sort key. */
function dueKey(task: Task): string {
  if (!task.due) return '9999-99-99';
  return task.due.date;
}

export function sortTasks(
  tasks: Task[],
  key: SortKey,
  dir: SortDir,
): Task[] {
  const sign = dir === 'asc' ? 1 : -1;
  const decorated = tasks.map((task, index) => ({ task, index }));
  decorated.sort((a, b) => {
    const x = a.task;
    const y = b.task;
    let cmp = 0;

    switch (key) {
      case 'order':
        cmp = x.order - y.order;
        break;
      case 'alpha':
        cmp = x.title.localeCompare(y.title);
        break;
      case 'createdAt':
        cmp = x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0;
        break;
      case 'priority':
        cmp = x.priority - y.priority;
        break;
      case 'dueDate':
        cmp = dueKey(x).localeCompare(dueKey(y));
        if (cmp === 0 && x.due && y.due && x.due.time && y.due.time) {
          cmp = x.due.time.localeCompare(y.due.time);
        }
        break;
    }

    if (cmp !== 0) return cmp * sign;
    // Stable tiebreak so the list never jitters between renders.
    return a.index - b.index;
  });

  return decorated.map((d) => d.task);
}

/** Full pipeline: view → filter → sort. */
export function selectTasks(
  tasks: Task[],
  viewId: string,
  filter: Filter,
  sortKey: SortKey,
  sortDir: SortDir,
  now: Date = new Date(),
): Task[] {
  const todayKey = toKey(today(now));
  return sortTasks(
    tasks.filter((t) => matchesView(t, viewId, todayKey) && matchesFilter(t, filter)),
    sortKey,
    sortDir,
  );
}

/** Does this task occupy the given calendar day? */
export function occursOn(task: Task, key: string): boolean {
  return taskOccurrences(task, key).includes(key);
}

export function emptyFilter(): Filter {
  return { projects: [], labels: [], priorities: [], dueBefore: null };
}

export function filterIsActive(filter: Filter): boolean {
  return (
    filter.projects.length > 0 ||
    filter.labels.length > 0 ||
    filter.priorities.length > 0 ||
    filter.dueBefore !== null
  );
}

/** All distinct labels across the non-deleted task set. */
export function collectLabels(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    if (t.isDeleted) continue;
    for (const l of t.labels) set.add(l);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function liveProjects(projects: Project[]): Project[] {
  return projects
    .filter((p) => !p.isDeleted)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Open-task count per project id, for the sidebar badges. */
export function countByProject(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.isDeleted || t.completedAt) continue;
    const key = t.projectId ?? 'inbox';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function countByLabel(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.isDeleted || t.completedAt) continue;
    for (const l of t.labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return counts;
}

export { isToday };
