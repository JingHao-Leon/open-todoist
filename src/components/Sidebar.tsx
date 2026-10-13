import { useMemo, useState } from 'react';
import { collectLabels, countByLabel, countByProject, liveProjects } from '../lib/filter';
import { toKey, today } from '../lib/date';
import { useStore } from '../store/useStore';

export function Sidebar() {
  const store = useStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newProject, setNewProject] = useState('');
  const todayKey = useMemo(() => toKey(today()), []);

  const projects = useMemo(() => liveProjects(store.projects), [store.projects]);
  const projectCounts = useMemo(() => countByProject(store.tasks), [store.tasks]);
  const labelCounts = useMemo(() => countByLabel(store.tasks), [store.tasks]);
  const labels = useMemo(() => collectLabels(store.tasks), [store.tasks]);

  const completedCount = useMemo(
    () => store.tasks.filter((t) => t.completedAt !== null && !t.isDeleted).length,
    [store.tasks],
  );
  const trashCount = useMemo(() => store.tasks.filter((t) => t.isDeleted).length, [store.tasks]);

  const views: Array<{ id: string; label: string; count: number }> = [
    {
      id: 'today',
      label: 'Today',
      count: store.tasks.filter((t) => !t.isDeleted && isDueOnOrBefore(t.due?.date, t.completedAt, todayKey)).length,
    },
    { id: 'upcoming', label: 'Upcoming', count: store.tasks.filter((t) => !t.isDeleted && !t.completedAt && t.due).length },
    { id: 'inbox', label: 'Inbox', count: projectCounts.get('inbox') ?? 0 },
    { id: 'completed', label: 'Completed', count: completedCount },
    { id: 'trash', label: 'Trash', count: trashCount },
  ];

  return (
    <nav className="sidebar" aria-label="Views and projects">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">open-todoist</span>
      </div>

      <ul className="view-list">
        {views.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`nav-item ${store.viewId === v.id ? 'is-active' : ''}`}
              onClick={() => store.setView(v.id)}
            >
              <span>{v.label}</span>
              <span className="pill-count">{v.count}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-section">
        <h2 className="sidebar-heading">Projects</h2>
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              {renaming === project.id ? (
                <input
                  className="rename-input"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    store.renameProject(project.id, draft);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      store.renameProject(project.id, draft);
                      setRenaming(null);
                    }
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <div className={`nav-item ${store.viewId === `project:${project.id}` ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="nav-main"
                    onClick={() => store.setView(`project:${project.id}`)}
                  >
                    <span className="project-dot" aria-hidden="true" />
                    <span>{project.name}</span>
                    <span className="pill-count">{projectCounts.get(project.id) ?? 0}</span>
                  </button>
                  <span className="nav-tools">
                    <button
                      type="button"
                      className="icon-button"
                      title="Move up"
                      onClick={() => store.moveProject(project.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Move down"
                      onClick={() => store.moveProject(project.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Rename"
                      onClick={() => {
                        setDraft(project.name);
                        setRenaming(project.id);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Delete project"
                      onClick={() => store.trashProject(project.id)}
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form
          className="new-project"
          onSubmit={(e) => {
            e.preventDefault();
            if (newProject.trim()) {
              store.addProject(newProject);
              setNewProject('');
            }
          }}
        >
          <input
            value={newProject}
            placeholder="+ new project"
            aria-label="New project name"
            onChange={(e) => setNewProject(e.target.value)}
          />
        </form>
      </div>

      {labels.length > 0 && (
        <div className="sidebar-section">
          <h2 className="sidebar-heading">Labels</h2>
          <ul className="label-list">
            {labels.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  className={`nav-item ${store.viewId === `label:${label}` ? 'is-active' : ''}`}
                  onClick={() => store.setView(`label:${label}`)}
                >
                  <span>@{label}</span>
                  <span className="pill-count">{labelCounts.get(label) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="sidebar-foot">
        Stored locally in your browser. No account, no server, no tracking.
      </p>
    </nav>
  );
}

/** Today view count: still open and due today or earlier. */
function isDueOnOrBefore(due: string | undefined, completedAt: string | null, todayKey: string): boolean {
  if (completedAt !== null || !due) return false;
  return due <= todayKey;
}
