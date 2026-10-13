import { useEffect, useMemo, useRef, useState } from 'react';
import { liveProjects } from '../lib/filter';
import { useStore } from '../store/useStore';

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * ⌘K / Ctrl-K palette.
 *
 * Everything reachable by mouse is reachable here, which is the point: a
 * keyboard-first app should never require the mouse.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const projects = useMemo(() => liveProjects(store.projects), [store.projects]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'view:inbox', label: 'Go to Inbox', run: () => store.setView('inbox') },
      { id: 'view:today', label: 'Go to Today', hint: 't', run: () => store.setView('today') },
      { id: 'view:upcoming', label: 'Go to Upcoming', hint: 'u', run: () => store.setView('upcoming') },
      { id: 'view:completed', label: 'Go to Completed', hint: 'c', run: () => store.setView('completed') },
      { id: 'view:trash', label: 'Go to Trash', run: () => store.setView('trash') },
      { id: 'view:stats', label: 'Show statistics', run: () => store.notify('Statistics panel toggled') },
      { id: 'sort:due', label: 'Sort by due date', run: () => store.setSort('dueDate', 'asc') },
      { id: 'sort:priority', label: 'Sort by priority', run: () => store.setSort('priority', 'asc') },
      { id: 'sort:alpha', label: 'Sort alphabetically', run: () => store.setSort('alpha', 'asc') },
      { id: 'sort:order', label: 'Sort manually', run: () => store.setSort('order', 'asc') },
      { id: 'filter:clear', label: 'Clear all filters', run: () => store.setFilter({ projects: [], labels: [], priorities: [], dueBefore: null }) },
      { id: 'data:export-json', label: 'Export data as JSON', run: () => window.dispatchEvent(new CustomEvent('ot:export-json')) },
      { id: 'data:export-csv', label: 'Export tasks as CSV', run: () => window.dispatchEvent(new CustomEvent('ot:export-csv')) },
      { id: 'data:import', label: 'Import data from JSON', run: () => window.dispatchEvent(new CustomEvent('ot:import')) },
    ];

    for (const project of projects) {
      list.push({
        id: `project:${project.id}`,
        label: `Go to project “${project.name}”`,
        run: () => store.setView(`project:${project.id}`),
      });
    }
    return list;
  }, [projects, store]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const activate = (command: Command | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          placeholder="Type a command or search…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              activate(filtered[index]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <ul className="palette-results">
          {filtered.length === 0 && <li className="palette-empty">No matching command</li>}
          {filtered.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                className={`palette-item ${i === index ? 'is-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => activate(command)}
              >
                <span>{command.label}</span>
                {command.hint && <kbd>{command.hint}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
