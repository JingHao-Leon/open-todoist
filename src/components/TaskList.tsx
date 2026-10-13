import { useEffect, useMemo, useState } from 'react';
import { collectLabels, countByLabel, countByProject, liveProjects, selectTasks } from '../lib/filter';
import { addDays, toKey, today } from '../lib/date';
import { TaskRow } from './TaskRow';
import type { SortDir, SortKey } from '../types';
import { useStore } from '../store/useStore';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'order', label: 'Manual' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'createdAt', label: 'Created' },
];

function viewTitle(viewId: string, projects: Map<string, string>): string {
  if (viewId === 'inbox') return 'Inbox';
  if (viewId === 'today') return 'Today';
  if (viewId === 'upcoming') return 'Upcoming';
  if (viewId === 'completed') return 'Completed';
  if (viewId === 'trash') return 'Trash';
  if (viewId.startsWith('project:')) return projects.get(viewId.slice(8)) ?? 'Project';
  if (viewId.startsWith('label:')) return `@${viewId.slice(6)}`;
  return 'Tasks';
}

export function TaskList() {
  const store = useStore();
  const [now, setNow] = useState(() => new Date());

  // Keeps "Today" honest across midnight without polling the server.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const projectNames = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p.name])),
    [store.projects],
  );

  const visible = useMemo(
    () => selectTasks(store.tasks, store.viewId, store.filter, store.sortKey, store.sortDir, now),
    [store.tasks, store.viewId, store.filter, store.sortKey, store.sortDir, now],
  );

  const isTrash = store.viewId === 'trash';

  const grouped = useMemo(() => {
    if (store.sortKey !== 'dueDate') return null;
    const todayKey = toKey(today(now));
    const buckets: Array<{ label: string; tasks: typeof visible }> = [
      { label: 'Overdue', tasks: [] },
      { label: 'Today', tasks: [] },
      { label: 'Tomorrow', tasks: [] },
      { label: 'Later', tasks: [] },
      { label: 'No date', tasks: [] },
    ];
    const tomorrowKey = toKey(addDays(today(now), 1));
    for (const task of visible) {
      if (!task.due) {
        buckets[4].tasks.push(task);
      } else if (task.due.date < todayKey) {
        buckets[0].tasks.push(task);
      } else if (task.due.date === todayKey) {
        buckets[1].tasks.push(task);
      } else if (task.due.date === tomorrowKey) {
        buckets[2].tasks.push(task);
      } else {
        buckets[3].tasks.push(task);
      }
    }
    return buckets.filter((b) => b.tasks.length > 0);
  }, [visible, store.sortKey, now]);

  const labels = useMemo(() => collectLabels(store.tasks), [store.tasks]);

  const cycleSortDir = () => {
    const dir: SortDir = store.sortDir === 'asc' ? 'desc' : 'asc';
    store.setSort(store.sortKey, dir);
  };

  return (
    <section className="task-pane">
      <header className="task-header">
        <div>
          <h1>{viewTitle(store.viewId, projectNames)}</h1>
          <p className="muted">
            {visible.length} task{visible.length === 1 ? '' : 's'}
            {store.filter.projects.length + store.filter.labels.length + store.filter.priorities.length > 0
              ? ' · filtered'
              : ''}
          </p>
        </div>
        <div className="task-header-actions">
          <label className="sort-control">
            <span className="muted">sort</span>
            <select
              value={store.sortKey}
              onChange={(e) => store.setSort(e.target.value as SortKey, store.sortDir)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="button" className="ghost-button" onClick={cycleSortDir}>
              {store.sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </label>
        </div>
      </header>

      <FilterBar labels={labels} />

      {visible.length === 0 ? (
        <p className="empty-state">
          Nothing here yet. Press <kbd>N</kbd> and type a task — try{' '}
          <code>Call the dentist tomorrow at 9am #Health</code>.
        </p>
      ) : grouped ? (
        grouped.map((bucket) => (
          <div key={bucket.label} className="group">
            <h2 className="group-title">{bucket.label}</h2>
            {bucket.tasks.map((task) => (
              <TaskRow key={task.id} task={task} isTrash={isTrash} />
            ))}
          </div>
        ))
      ) : (
        visible.map((task) => <TaskRow key={task.id} task={task} isTrash={isTrash} />)
      )}

      {isTrash && visible.length > 0 && (
        <button type="button" className="danger-button" onClick={store.emptyTrash}>
          Empty trash
        </button>
      )}
    </section>
  );
}

function FilterBar({ labels }: { labels: string[] }) {
  const store = useStore();
  const projectCounts = useMemo(() => countByProject(store.tasks), [store.tasks]);
  const labelCounts = useMemo(() => countByLabel(store.tasks), [store.tasks]);
  const projects = useMemo(() => liveProjects(store.projects), [store.projects]);

  const toggle = (kind: 'projects' | 'labels' | 'priorities', value: string) => {
    const current = store.filter[kind];
    const next = current.includes(value as never)
      ? current.filter((v) => v !== value)
      : [...current, value as never];
    store.setFilter({ ...store.filter, [kind]: next });
  };

  const clearAll = () => {
    store.setFilter({ projects: [], labels: [], priorities: [], dueBefore: null });
  };

  const hasFilters =
    store.filter.projects.length > 0 ||
    store.filter.labels.length > 0 ||
    store.filter.priorities.length > 0;

  if (projects.length === 0 && labels.length === 0) return null;

  return (
    <div className="filter-bar">
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`filter-pill ${store.filter.projects.includes(p.id) ? 'is-on' : ''}`}
          onClick={() => toggle('projects', p.id)}
        >
          {p.name}
          <span className="pill-count">{projectCounts.get(p.id) ?? 0}</span>
        </button>
      ))}
      {labels.map((l) => (
        <button
          key={l}
          type="button"
          className={`filter-pill ${store.filter.labels.includes(l) ? 'is-on' : ''}`}
          onClick={() => toggle('labels', l)}
        >
          @{l}
          <span className="pill-count">{labelCounts.get(l) ?? 0}</span>
        </button>
      ))}
      {([1, 2, 3, 4] as const).map((pr) => (
        <button
          key={pr}
          type="button"
          className={`filter-pill priority-${pr} ${store.filter.priorities.includes(pr) ? 'is-on' : ''}`}
          onClick={() => toggle('priorities', String(pr) as never)}
        >
          p{pr}
        </button>
      ))}
      {hasFilters && (
        <button type="button" className="ghost-button" onClick={clearAll}>
          clear
        </button>
      )}
    </div>
  );
}
