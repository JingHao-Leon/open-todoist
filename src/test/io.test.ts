import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, buildExport, parseImport, toCsv, toJson } from '../lib/io';
import { completeTask, createTask, createProject, nextOrder } from '../lib/factory';
import { parseInput } from '../lib/nlp';
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

const projects: Project[] = [
  { id: 'p1', name: 'Work', order: 1, isDeleted: false, createdAt: '2026-10-01T00:00:00.000Z' },
];

describe('factory', () => {
  it('increments order past the current maximum', () => {
    expect(nextOrder([task({ id: 'a', order: 3 }), task({ id: 'b', order: 7 })])).toBe(8);
    expect(nextOrder([])).toBe(1);
  });

  it('creates a project with a trimmed name', () => {
    const project = createProject('  Side quest  ', [], NOW);
    expect(project.name).toBe('Side quest');
    expect(project.order).toBe(1);
  });

  it('falls back to a placeholder for an empty project name', () => {
    expect(createProject('   ', [], NOW).name).toBe('Untitled project');
  });

  it('turns a parse result into a task', () => {
    const parsed = parseInput('Ship build #Work @release tomorrow p1', { now: NOW });
    const created = createTask(parsed, 'p1', [], NOW);
    expect(created.title).toBe('Ship build');
    expect(created.labels).toEqual(['release']);
    expect(created.priority).toBe(1);
    expect(created.due).toEqual({ date: '2026-10-15' });
    expect(created.projectId).toBe('p1');
    expect(created.completedAt).toBeNull();
  });

  it('completes a one-off task by stamping completedAt', () => {
    const { tasks, rolled } = completeTask([task({ id: 'a' })], 'a', NOW);
    expect(rolled).toBe(false);
    expect(tasks[0].completedAt).not.toBeNull();
  });

  it('rolls a recurring task forward instead of closing it', () => {
    const recurring = task({ id: 'a', recurrence: { freq: 'daily', interval: 1 }, due: { date: '2026-10-14' } });
    const { tasks, rolled } = completeTask([recurring], 'a', NOW);
    expect(rolled).toBe(true);
    expect(tasks[0].completedAt).toBeNull();
    expect(tasks[0].due).toEqual({ date: '2026-10-15' });
  });

  it('keeps the clock time when rolling forward', () => {
    const recurring = task({
      id: 'a',
      recurrence: { freq: 'weekly', interval: 1, daysOfWeek: [1] },
      due: { date: '2026-10-14', time: '09:00' },
    });
    const { tasks } = completeTask([recurring], 'a', NOW);
    expect(tasks[0].due).toEqual({ date: '2026-10-19', time: '09:00' });
  });
});

describe('JSON export and import', () => {
  const tasks = [
    task({ id: 'a', title: 'Alpha', projectId: 'p1', labels: ['x', 'y'], priority: 2, due: { date: '2026-10-15', time: '09:00' } }),
    task({ id: 'b', title: 'Beta, with comma', description: 'Multi\nline' }),
  ];

  it('produces a versioned document', () => {
    const doc = buildExport(tasks, projects, NOW);
    expect(doc.app).toBe('open-todoist');
    expect(doc.schemaVersion).toBe(1);
    expect(doc.tasks).toHaveLength(2);
    expect(doc.projects).toHaveLength(1);
  });

  it('round-trips through JSON without losing fields', () => {
    const json = toJson(tasks, projects, NOW);
    const back = parseImport(json);
    expect(back.warnings).toEqual([]);
    expect(back.tasks).toHaveLength(2);
    expect(back.tasks[0].labels).toEqual(['x', 'y']);
    expect(back.tasks[0].due).toEqual({ date: '2026-10-15', time: '09:00' });
    expect(back.tasks[1].title).toBe('Beta, with comma');
    expect(back.tasks[1].description).toBe('Multi\nline');
  });

  it('rejects malformed JSON with a readable message', () => {
    expect(() => parseImport('{not json')).toThrow(/not valid JSON/i);
    expect(() => parseImport('{"tasks":[],"projects":[]}')).toThrow(/No projects or tasks/i);
  });

  it('recovers a task whose project is missing from the file', () => {
    const doc = JSON.stringify({
      projects: [],
      tasks: [{ id: 'a', title: 'Orphan', projectId: 'ghost' }],
    });
    const back = parseImport(doc);
    expect(back.tasks[0].projectId).toBe('ghost');
    expect(back.projects).toHaveLength(1);
    expect(back.warnings.join(' ')).toMatch(/placeholder/i);
  });

  it('coerces an invalid priority back to 4', () => {
    const doc = JSON.stringify({ projects: [], tasks: [{ id: 'a', title: 'x', priority: 99 }] });
    expect(parseImport(doc).tasks[0].priority).toBe(4);
  });

  it('drops a malformed due date but keeps the task', () => {
    const doc = JSON.stringify({ projects: [], tasks: [{ id: 'a', title: 'x', due: { date: 'soon' } }] });
    expect(parseImport(doc).tasks[0].due).toBeNull();
  });

  it('accepts a comma-separated labels string', () => {
    const doc = JSON.stringify({ projects: [], tasks: [{ id: 'a', title: 'x', labels: 'a, b' }] });
    expect(parseImport(doc).tasks[0].labels).toEqual(['a', 'b']);
  });

  it('normalises a recurrence', () => {
    const doc = JSON.stringify({
      projects: [],
      tasks: [{ id: 'a', title: 'x', recurrence: { freq: 'weekly', interval: 2, daysOfWeek: [5, 1] } }],
    });
    expect(parseImport(doc).tasks[0].recurrence).toEqual({
      freq: 'weekly',
      interval: 2,
      daysOfWeek: [1, 5],
    });
  });
});

describe('CSV export', () => {
  const tasks = [
    task({ id: 'a', title: 'Plain', projectId: 'p1', priority: 1 }),
    task({ id: 'b', title: 'Has, comma and "quotes"', description: 'line1\nline2', labels: ['x', 'y'] }),
  ];

  it('writes a header matching the declared columns', () => {
    const csv = toCsv(tasks, projects);
    expect(csv.split('\n')[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('quotes cells containing commas, quotes and newlines', () => {
    const csv = toCsv(tasks, projects);
    expect(csv).toContain('"Has, comma and ""quotes"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it('resolves the project name rather than the id', () => {
    expect(toCsv(tasks, projects)).toContain('Work');
  });

  it('renders the recurrence in readable form', () => {
    const recurring = task({ id: 'c', title: 'R', recurrence: { freq: 'weekly', interval: 2 } });
    expect(toCsv([recurring], projects)).toContain('2 week');
  });

  it('ends with a trailing newline', () => {
    expect(toCsv(tasks, projects).endsWith('\n')).toBe(true);
  });
});
