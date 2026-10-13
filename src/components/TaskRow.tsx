import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { humanDate, toKey, today } from '../lib/date';
import { recurrenceBadge } from '../lib/recurrence';
import { useStore } from '../store/useStore';

interface Props {
  task: Task;
  isTrash: boolean;
}

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'None',
};

/**
 * One task line.
 *
 * Keyboard contract, kept deliberately small and row-scoped:
 *   Space / x  toggle done      e  edit title
 *   1..4       set priority    Delete  move to trash
 *   Backspace   restore (trash only)
 */
export function TaskRow({ task, isTrash }: Props) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const todayKey = useMemo(() => toKey(today()), []);

  const done = task.completedAt !== null;

  const commit = () => {
    const title = draft.trim();
    if (title && title !== task.title) store.update(task.id, { title });
    else if (!title) setDraft(task.title);
    setEditing(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (editing) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(task.title);
        setEditing(false);
      }
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;

    switch (event.key) {
      case ' ':
      case 'x':
        event.preventDefault();
        if (isTrash) store.restore([task.id]);
        else if (done) store.reopen(task.id);
        else store.complete(task.id);
        break;
      case 'e':
        event.preventDefault();
        setDraft(task.title);
        setEditing(true);
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        event.preventDefault();
        store.update(task.id, { priority: Number(event.key) as Task['priority'] });
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        if (isTrash) store.restore([task.id]);
        else store.trash([task.id]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        store.moveTask(task.id, -1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        store.moveTask(task.id, 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`task-row ${done ? 'is-done' : ''} ${isTrash ? 'is-trashed' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="task-row"
    >
      <button
        type="button"
        className={`check ${done ? 'is-checked' : ''}`}
        aria-label={done ? 'Reopen task' : 'Complete task'}
        onClick={() => {
          if (isTrash) store.restore([task.id]);
          else if (done) store.reopen(task.id);
          else store.complete(task.id);
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div className="task-body">
        {editing ? (
          <input
            className="task-edit"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            className="task-title"
            onClick={() => {
              setDraft(task.title);
              setEditing(true);
            }}
          >
            {task.title || <em className="muted">(untitled)</em>}
          </span>
        )}

        <div className="task-meta">
          {task.due && (
            <span className={`meta-due ${task.due.date < todayKey && !done ? 'is-overdue' : ''}`}>
              {humanDate(task.due.date)}
              {task.due.time ? ` ${task.due.time}` : ''}
            </span>
          )}
          {task.recurrence && <span className="meta-repeat" title="Repeats">{recurrenceBadge(task.recurrence)}</span>}
          {task.labels.map((l) => (
            <button
              key={l}
              type="button"
              className="meta-label"
              onClick={() => store.setView(`label:${l}`)}
            >
              @{l}
            </button>
          ))}
          {task.priority !== 4 && (
            <span className={`meta-priority p${task.priority}`} title={PRIORITY_LABEL[task.priority]}>
              p{task.priority}
            </span>
          )}
        </div>
      </div>

      <div className="task-actions">
        <button
          type="button"
          className="ghost-button"
          title="Raise priority"
          onClick={() => store.update(task.id, { priority: Math.max(1, task.priority - 1) as Task['priority'] })}
        >
          ▲
        </button>
        <button
          type="button"
          className="ghost-button"
          title="Lower priority"
          onClick={() => store.update(task.id, { priority: Math.min(4, task.priority + 1) as Task['priority'] })}
        >
          ▼
        </button>
        {isTrash ? (
          <button type="button" className="ghost-button" onClick={() => store.restore([task.id])}>
            restore
          </button>
        ) : (
          <button type="button" className="ghost-button" onClick={() => store.trash([task.id])}>
            trash
          </button>
        )}
      </div>
    </div>
  );
}
