import { describe, expect, it } from 'vitest';
import {
  collectLabels,
  countByLabel,
  countByProject,
  emptyFilter,
  filterIsActive,
  matchesFilter,
  matchesView,
  occursOn,
  selectTasks,
  sortTasks,
  taskOccurrences,
} from '../lib/filter';
import type { Filter, Task } from '../types';

const NOW = new Date(2026, 9, 14, 10, 0, 0);
const TODAY = '2026-10-14';

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
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

describe('matchesView', () => {
  it('Inbox shows only untitled-project tasks', () => {
    expect(matchesView(task({ id: 'a', title: 'x' }), 'inbox', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'b', title: 'x', projectId: 'p1' }), 'inbox', TODAY)).toBe(false);
  });

  it('Today shows open tasks due today or overdue', () => {
    expect(matchesView(task({ id: 'a', title: 'x', due: { date: TODAY } }), 'today', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'b', title: 'x', due: { date: '2026-10-01' } }), 'today', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'c', title: 'x', due: { date: '2026-10-15' } }), 'today', TODAY)).toBe(false);
  });

  it('Today excludes completed and undated tasks', () => {
    expect(matchesView(task({ id: 'a', title: 'x', due: { date: TODAY }, completedAt: '2026-10-14T09:00:00Z' }), 'today', TODAY)).toBe(false);
    expect(matchesView(task({ id: 'b', title: 'x' }), 'today', TODAY)).toBe(false);
  });

  it('Upcoming shows only future-dated open tasks', () => {
    expect(matchesView(task({ id: 'a', title: 'x', due: { date: '2026-10-20' } }), 'upcoming', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'b', title: 'x', due: { date: TODAY } }), 'upcoming', TODAY)).toBe(false);
    expect(matchesView(task({ id: 'c', title: 'x' }), 'upcoming', TODAY)).toBe(false);
  });

  it('hides soft-deleted tasks everywhere except the trash', () => {
    const deleted = task({ id: 'a', title: 'x', isDeleted: true });
    expect(matchesView(deleted, 'inbox', TODAY)).toBe(false);
    expect(matchesView(deleted, 'today', TODAY)).toBe(false);
    expect(matchesView(deleted, 'trash', TODAY)).toBe(true);
  });

  it('Completed shows done tasks', () => {
    expect(matchesView(task({ id: 'a', title: 'x', completedAt: '2026-10-14T09:00:00Z' }), 'completed', TODAY)).toBe(true);
  });

  it('project and label views route by id and name', () => {
    expect(matchesView(task({ id: 'a', title: 'x', projectId: 'p1' }), 'project:p1', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'b', title: 'x', labels: ['home'] }), 'label:home', TODAY)).toBe(true);
    expect(matchesView(task({ id: 'c', title: 'x', labels: ['work'] }), 'label:home', TODAY)).toBe(false);
  });
});

describe('recurring tasks in date-driven views', () => {
  it('projects a daily repeat onto each day it fires', () => {
    const daily = task({ id: 'a', title: 'x', recurrence: { freq: 'daily', interval: 1 } });
    expect(taskOccurrences(daily, TODAY)).toContain(TODAY);
    expect(taskOccurrences(daily, TODAY)).toContain('2026-10-20');
  });

  it('does not put a weekday repeat on a Saturday', () => {
    const weekdays = task({ id: 'a', title: 'x', recurrence: { freq: 'weekdays', interval: 1 } });
    expect(occursOn(weekdays, '2026-10-17')).toBe(false);
    expect(occursOn(weekdays, '2026-10-16')).toBe(true);
  });

  it('treats a plain dated task as a single occurrence', () => {
    const once = task({ id: 'a', title: 'x', due: { date: '2026-10-20' } });
    expect(taskOccurrences(once, TODAY)).toEqual(['2026-10-20']);
    expect(taskOccurrences(task({ id: 'b', title: 'x' }), TODAY)).toEqual([]);
  });
});

describe('matchesFilter', () => {
  const base: Filter = emptyFilter();

  it('passes everything with an empty filter', () => {
    expect(matchesFilter(task({ id: 'a', title: 'x' }), base)).toBe(true);
    expect(filterIsActive(base)).toBe(false);
  });

  it('filters by project, treating null as the inbox bucket', () => {
    const filter = { ...base, projects: ['inbox'] };
    expect(matchesFilter(task({ id: 'a', title: 'x' }), filter)).toBe(true);
    expect(matchesFilter(task({ id: 'b', title: 'x', projectId: 'p1' }), filter)).toBe(false);
  });

  it('treats multiple selected labels as OR', () => {
    const filter = { ...base, labels: ['home', 'work'] };
    expect(matchesFilter(task({ id: 'a', title: 'x', labels: ['work'] }), filter)).toBe(true);
    expect(matchesFilter(task({ id: 'b', title: 'x', labels: ['other'] }), filter)).toBe(false);
  });

  it('combines multiple filter kinds with AND', () => {
    const filter: Filter = { projects: ['p1'], labels: ['work'], priorities: [1], dueBefore: null };
    expect(matchesFilter(task({ id: 'a', title: 'x', projectId: 'p1', labels: ['work'], priority: 1 }), filter)).toBe(true);
    expect(matchesFilter(task({ id: 'b', title: 'x', projectId: 'p1', labels: ['work'], priority: 2 }), filter)).toBe(false);
  });

  it('filters by a due-date ceiling', () => {
    const filter = { ...base, dueBefore: '2026-10-20' };
    expect(matchesFilter(task({ id: 'a', title: 'x', due: { date: '2026-10-19' } }), filter)).toBe(true);
    expect(matchesFilter(task({ id: 'b', title: 'x', due: { date: '2026-10-21' } }), filter)).toBe(false);
    expect(matchesFilter(task({ id: 'c', title: 'x' }), filter)).toBe(false);
  });

  it('reports an active filter', () => {
    expect(filterIsActive({ ...base, priorities: [2] })).toBe(true);
  });
});

describe('sortTasks', () => {
  const a = task({ id: 'a', title: 'Alpha', priority: 3, due: { date: '2026-10-20' }, order: 2 });
  const b = task({ id: 'b', title: 'Beta', priority: 1, due: { date: '2026-10-15' }, order: 1 });
  const c = task({ id: 'c', title: 'Gamma', priority: 4, order: 3 });

  it('sorts by manual order', () => {
    expect(sortTasks([a, b, c], 'order', 'asc').map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts alphabetically', () => {
    expect(sortTasks([c, a, b], 'alpha', 'asc').map((t) => t.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts by priority ascending, so urgent first', () => {
    expect(sortTasks([c, a, b], 'priority', 'asc').map((t) => t.priority)).toEqual([1, 3, 4]);
  });

  it('puts undated tasks last when sorting by due date', () => {
    const sorted = sortTasks([c, a, b], 'dueDate', 'asc');
    expect(sorted.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('breaks due-date ties on clock time', () => {
    const t1 = task({ id: 't1', title: 'x', due: { date: '2026-10-15', time: '09:00' } });
    const t2 = task({ id: 't2', title: 'y', due: { date: '2026-10-15', time: '17:00' } });
    expect(sortTasks([t2, t1], 'dueDate', 'asc').map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('reverses on descending', () => {
    expect(sortTasks([a, b, c], 'alpha', 'desc').map((t) => t.title)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('is stable for equal keys', () => {
    const t1 = task({ id: 't1', title: 'Same', order: 1 });
    const t2 = task({ id: 't2', title: 'Same', order: 1 });
    expect(sortTasks([t1, t2], 'alpha', 'asc').map((t) => t.id)).toEqual(['t1', 't2']);
  });
});

describe('selectTasks', () => {
  it('applies view, then filter, then sort', () => {
    const tasks = [
      task({ id: 'a', title: 'A', due: { date: '2026-10-20' }, priority: 4, labels: ['work'] }),
      task({ id: 'b', title: 'B', due: { date: '2026-10-16' }, priority: 1, labels: ['home'] }),
      task({ id: 'c', title: 'C', due: { date: '2026-10-16' }, priority: 2, labels: ['work'] }),
    ];
    const filter: Filter = { projects: [], labels: ['work'], priorities: [], dueBefore: null };
    const result = selectTasks(tasks, 'upcoming', filter, 'dueDate', 'asc', NOW);
    expect(result.map((t) => t.id)).toEqual(['c', 'a']);
  });

  it('returns an empty list for a view with no members', () => {
    expect(selectTasks([], 'inbox', emptyFilter(), 'order', 'asc', NOW)).toEqual([]);
  });
});

describe('aggregations', () => {
  const tasks = [
    task({ id: 'a', title: 'A', projectId: 'p1', labels: ['work', 'urgent'] }),
    task({ id: 'b', title: 'B', projectId: 'p1', labels: ['work'] }),
    task({ id: 'c', title: 'C', completedAt: '2026-10-14T09:00:00Z', labels: ['work'] }),
    task({ id: 'e', title: 'E' }),
    task({ id: 'd', title: 'D', isDeleted: true, labels: ['gone'] }),
  ];

  it('counts open tasks per project, with the inbox under its own key', () => {
    const counts = countByProject(tasks);
    expect(counts.get('p1')).toBe(2);
    expect(counts.get('inbox')).toBe(1);
    expect(counts.has('d')).toBe(false);
  });

  it('counts open tasks per label', () => {
    expect(countByLabel(tasks).get('work')).toBe(2);
  });

  it('collects distinct labels from live tasks only', () => {
    expect(collectLabels(tasks)).toEqual(['urgent', 'work']);
  });
});
