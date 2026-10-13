import type { ParseResult, Project, Task } from '../types';
import { newId } from './id';
import { nowIso, toKey, today } from './date';
import { nextOccurrence } from './recurrence';

export function nextOrder(tasks: Task[]): number {
  let max = 0;
  for (const t of tasks) {
    if (t.order > max) max = t.order;
  }
  return max + 1;
}

export function createProject(name: string, projects: Project[], now: Date = new Date()): Project {
  let max = 0;
  for (const p of projects) {
    if (p.order > max) max = p.order;
  }
  return {
    id: newId(),
    name: name.trim() || 'Untitled project',
    order: max + 1,
    isDeleted: false,
    createdAt: nowIso(now),
  };
}

export function createTask(
  parsed: ParseResult,
  projectId: string | null,
  tasks: Task[],
  now: Date = new Date(),
): Task {
  return {
    id: newId(),
    title: parsed.title,
    description: '',
    projectId,
    labels: parsed.labels,
    priority: parsed.priority ?? 4,
    due: parsed.due,
    recurrence: parsed.recurrence,
    createdAt: nowIso(now),
    completedAt: null,
    order: nextOrder(tasks),
    isDeleted: false,
    deletedAt: null,
  };
}

export function createBlankTask(projectId: string | null, tasks: Task[], now: Date = new Date()): Task {
  return {
    id: newId(),
    title: '',
    description: '',
    projectId,
    labels: [],
    priority: 4,
    due: null,
    recurrence: null,
    createdAt: nowIso(now),
    completedAt: null,
    order: nextOrder(tasks),
    isDeleted: false,
    deletedAt: null,
  };
}

/**
 * Completing a task.
 *
 * A recurring task is *rolled forward* rather than closed: its due date moves
 * to the next fire day and it stays open, which is the whole point of a repeat.
 * Returns `rolled: true` so the UI can explain what happened.
 */
export function completeTask(
  tasks: Task[],
  id: string,
  now: Date = new Date(),
): { tasks: Task[]; rolled: boolean } {
  const target = tasks.find((t) => t.id === id);
  if (!target) return { tasks, rolled: false };

  if (!target.recurrence) {
    const completedAt = nowIso(now);
    return {
      tasks: tasks.map((t) => (t.id === id ? { ...t, completedAt } : t)),
      rolled: false,
    };
  }

  const base = target.due ? target.due.date : toKey(today(now));
  const nextDate = nextOccurrence(target.recurrence, base);
  const due: Task['due'] = target.due?.time ? { date: nextDate, time: target.due.time } : { date: nextDate };

  return {
    tasks: tasks.map((t) => (t.id === id ? { ...t, due, completedAt: null } : t)),
    rolled: true,
  };
}

/** Re-opening a task clears its completion timestamp. */
export function reopenTask(tasks: Task[], id: string): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, completedAt: null } : t));
}
