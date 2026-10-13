import type { AppStats, Project, Task } from '../types';
import { addDays, isoToLocalKey, toKey, today } from './date';

/**
 * Statistics are computed on demand from the task list held in memory.
 * Nothing is pre-aggregated, so there is no cache to invalidate.
 */

/** Set of local calendar days (`YYYY-MM-DD`) on which something was completed. */
export function completionDays(tasks: Task[]): Set<string> {
  const days = new Set<string>();
  for (const t of tasks) {
    if (!t.completedAt || t.isDeleted) continue;
    const key = isoToLocalKey(t.completedAt);
    if (key) days.add(key);
  }
  return days;
}

/**
 * Consecutive-day completion streak.
 *
 * Today not being complete yet does not break the streak — the run still counts
 * as long as yesterday was completed. A missed *yesterday* does break it.
 */
export function computeStreak(days: Set<string>, now: Date = new Date()): number {
  const base = today(now);
  const todayKey = toKey(base);

  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else {
    const yesterday = toKey(addDays(base, -1));
    if (!days.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  let day = cursor;
  while (days.has(day)) {
    streak += 1;
    const [y, m, d] = day.split('-').map((p) => Number.parseInt(p, 10));
    day = toKey(addDays({ y, m, d }, -1));
  }
  return streak;
}

/** Longest run of consecutive completion days anywhere in the history. */
export function longestStreak(days: Set<string>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of sorted) {
    if (previous !== null) {
      const [py, pm, pd] = previous.split('-').map((p) => Number.parseInt(p, 10));
      const expected = toKey(addDays({ y: py, m: pm, d: pd }, 1));
      run = day === expected ? run + 1 : 1;
    } else {
      run = 1;
    }
    previous = day;
    if (run > best) best = run;
  }
  return best;
}

export function computeStats(
  tasks: Task[],
  projects: Project[],
  now: Date = new Date(),
): AppStats {
  const base = today(now);
  const todayKey = toKey(base);

  let completedToday = 0;
  let dueToday = 0;
  let overdue = 0;
  const byDate = new Map<string, number>();
  const byProject = new Map<string, number>();
  const byLabel = new Map<string, number>();

  for (const t of tasks) {
    if (t.isDeleted) continue;
    if (t.due && t.completedAt === null) {
      if (t.due.date === todayKey) dueToday += 1;
      else if (t.due.date < todayKey) overdue += 1;
    }
    if (!t.completedAt) continue;

    const key = isoToLocalKey(t.completedAt);
    if (!key) continue;
    if (key === todayKey) completedToday += 1;
    byDate.set(key, (byDate.get(key) ?? 0) + 1);

    const projectKey = t.projectId ?? 'inbox';
    byProject.set(projectKey, (byProject.get(projectKey) ?? 0) + 1);

    for (const label of t.labels) byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
  }

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const completionsByProject = [...byProject.entries()]
    .map(([projectId, count]) => ({
      projectId: projectId === 'inbox' ? null : projectId,
      name: projectId === 'inbox' ? 'Inbox' : (projectName.get(projectId) ?? 'Unknown'),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const completionsByLabel = [...byLabel.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // A dense 28-day window keeps the sparkline readable and bounded.
  const completionsByDate: Array<{ date: string; count: number }> = [];
  for (let i = 27; i >= 0; i -= 1) {
    const key = toKey(addDays(base, -i));
    completionsByDate.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  const days = completionDays(tasks);
  return {
    completedToday,
    dueToday,
    overdue,
    streak: computeStreak(days, now),
    longestStreak: longestStreak(days),
    completionsByDate,
    completionsByProject,
    completionsByLabel,
  };
}
