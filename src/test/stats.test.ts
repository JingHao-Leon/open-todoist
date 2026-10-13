import { describe, expect, it } from 'vitest';
import { completionDays, computeStreak, computeStats, longestStreak } from '../lib/stats';
import type { Project, Task } from '../types';

const NOW = new Date(2026, 9, 14, 10, 0, 0);

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    title: 'Task',
    description: '',
    projectId: null,
    labels: [],
    priority: 4,
    due: null,
    recurrence: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    completedAt: null,
    order: 0,
    isDeleted: false,
    deletedAt: null,
    ...partial,
  };
}

/** Build an ISO timestamp that lands on a given local calendar day. */
function completedOn(key: string, id: string, extra: Partial<Task> = {}): Task {
  const [y, m, d] = key.split('-').map(Number);
  const local = new Date(y, m - 1, d, 12, 0, 0).toISOString();
  return task({ id, completedAt: local, ...extra });
}

function days(...keys: string[]): Set<string> {
  return new Set(keys);
}

describe('computeStreak', () => {
  it('counts a run ending today', () => {
    expect(computeStreak(days('2026-10-12', '2026-10-13', '2026-10-14'), NOW)).toBe(3);
  });

  it('keeps the streak alive when today has no completion yet', () => {
    expect(computeStreak(days('2026-10-12', '2026-10-13'), NOW)).toBe(2);
  });

  it('breaks when yesterday was missed', () => {
    expect(computeStreak(days('2026-10-10', '2026-10-11'), NOW)).toBe(0);
  });

  it('returns 0 with no history at all', () => {
    expect(computeStreak(new Set(), NOW)).toBe(0);
  });

  it('counts a single day as a streak of one', () => {
    expect(computeStreak(days('2026-10-14'), NOW)).toBe(1);
  });

  it('counts a run that crosses a month boundary', () => {
    // Streaks are measured backwards from "today", so the clock has to move too.
    const nowOct2 = new Date(2026, 9, 2, 10, 0, 0);
    expect(computeStreak(days('2026-09-30', '2026-10-01', '2026-10-02'), nowOct2)).toBe(3);
  });

  it('is zero for an old run that no longer touches today', () => {
    expect(computeStreak(days('2026-10-01', '2026-10-02'), NOW)).toBe(0);
  });

  it('is unaffected by several completions on one day', () => {
    const tasks = [completedOn('2026-10-13', 'a'), completedOn('2026-10-13', 'b'), completedOn('2026-10-14', 'c')];
    expect(computeStreak(completionDays(tasks), NOW)).toBe(2);
  });
});

describe('longestStreak', () => {
  it('finds the longest historical run', () => {
    expect(longestStreak(days('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20'))).toBe(4);
  });

  it('handles disjoint runs', () => {
    expect(longestStreak(days('2026-09-01', '2026-09-02', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'))).toBe(4);
  });

  it('is zero for an empty history', () => {
    expect(longestStreak(new Set())).toBe(0);
  });
});

describe('computeStats', () => {
  const projects: Project[] = [
    { id: 'p1', name: 'Work', order: 1, isDeleted: false, createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'p2', name: 'Home', order: 2, isDeleted: false, createdAt: '2026-10-01T00:00:00.000Z' },
  ];

  it('counts today, due today and overdue', () => {
    const tasks = [
      completedOn('2026-10-14', 'done'),
      task({ id: 'due', due: { date: '2026-10-14' } }),
      task({ id: 'late', due: { date: '2026-10-10' } }),
      task({ id: 'later', due: { date: '2026-10-20' } }),
      task({ id: 'undated' }),
    ];
    const stats = computeStats(tasks, projects, NOW);
    expect(stats.completedToday).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.overdue).toBe(1);
  });

  it('does not count a completed task as due', () => {
    const tasks = [completedOn('2026-10-14', 'a', { due: { date: '2026-10-14' } })];
    expect(computeStats(tasks, projects, NOW).dueToday).toBe(0);
  });

  it('ignores soft-deleted tasks entirely', () => {
    const tasks = [
      completedOn('2026-10-14', 'a', { isDeleted: true }),
      task({ id: 'b', due: { date: '2026-10-10' }, isDeleted: true }),
    ];
    const stats = computeStats(tasks, projects, NOW);
    expect(stats.completedToday).toBe(0);
    expect(stats.overdue).toBe(0);
  });

  it('groups completions by project and label, biggest first', () => {
    const tasks = [
      completedOn('2026-10-13', 'a', { projectId: 'p1', labels: ['work'] }),
      completedOn('2026-10-13', 'b', { projectId: 'p1', labels: ['work'] }),
      completedOn('2026-10-14', 'c', { projectId: 'p2', labels: ['home', 'work'] }),
      completedOn('2026-10-14', 'd', {}),
    ];
    const stats = computeStats(tasks, projects, NOW);
    expect(stats.completionsByProject[0]).toEqual({ projectId: 'p1', name: 'Work', count: 2 });
    expect(stats.completionsByProject.map((p) => p.name)).toContain('Inbox');
    expect(stats.completionsByLabel[0]).toEqual({ label: 'work', count: 3 });
  });

  it('emits a dense 28-day window ending today', () => {
    const stats = computeStats([], projects, NOW);
    expect(stats.completionsByDate).toHaveLength(28);
    expect(stats.completionsByDate[27].date).toBe('2026-10-14');
    expect(stats.completionsByDate.every((d) => d.count === 0)).toBe(true);
  });
});
