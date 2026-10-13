import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { Filter, Project, SortDir, SortKey, Task } from '../types';
import { loadSnapshot, saveSnapshot } from '../lib/db';
import { emptyFilter } from '../lib/filter';
import { completeTask, createBlankTask, createProject, createTask, reopenTask } from '../lib/factory';
import { parseInput } from '../lib/nlp';
import { newId } from '../lib/id';
import { parseImport } from '../lib/io';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'warn';
}

export interface State {
  tasks: Task[];
  projects: Project[];
  ready: boolean;
  viewId: string;
  filter: Filter;
  sortKey: SortKey;
  sortDir: SortDir;
  toasts: Toast[];
  /** Text currently in the quick-add box, so `N` can focus and prefill it. */
  draft: string;
}

type Action =
  | { type: 'hydrate'; tasks: Task[]; projects: Project[] }
  | { type: 'setView'; viewId: string }
  | { type: 'setFilter'; filter: Filter }
  | { type: 'setSort'; sortKey: SortKey; sortDir: SortDir }
  | { type: 'setDraft'; draft: string }
  | { type: 'toast'; message: string; tone: 'info' | 'warn' }
  | { type: 'dismissToast'; id: string }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; id: string; patch: Partial<Task> }
  | { type: 'removeTasks'; ids: string[] }
  | { type: 'restoreTasks'; ids: string[] }
  | { type: 'setProjects'; projects: Project[] }
  | { type: 'replaceAll'; tasks: Task[]; projects: Project[] };

const initialState: State = {
  tasks: [],
  projects: [],
  ready: false,
  viewId: 'inbox',
  filter: emptyFilter(),
  sortKey: 'order',
  sortDir: 'asc',
  toasts: [],
  draft: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...state, tasks: action.tasks, projects: action.projects, ready: true };
    case 'setView':
      return { ...state, viewId: action.viewId };
    case 'setFilter':
      return { ...state, filter: action.filter };
    case 'setSort':
      return { ...state, sortKey: action.sortKey, sortDir: action.sortDir };
    case 'setDraft':
      return { ...state, draft: action.draft };
    case 'toast':
      return {
        ...state,
        toasts: [...state.toasts, { id: newId(), message: action.message, tone: action.tone }],
      };
    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'removeTasks': {
      const stamp = new Date().toISOString();
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          action.ids.includes(t.id) ? { ...t, isDeleted: true, deletedAt: stamp } : t,
        ),
      };
    }
    case 'restoreTasks':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          action.ids.includes(t.id) ? { ...t, isDeleted: false, deletedAt: null } : t,
        ),
      };
    case 'setProjects':
      return { ...state, projects: action.projects };
    case 'replaceAll':
      return { ...state, tasks: action.tasks, projects: action.projects };
    default:
      return state;
  }
}

export interface Store extends State {
  addFromText: (text: string, projectId: string | null) => ParseSummary;
  addBlank: (projectId: string | null) => string;
  complete: (id: string) => void;
  reopen: (id: string) => void;
  update: (id: string, patch: Partial<Task>) => void;
  trash: (ids: string[]) => void;
  restore: (ids: string[]) => void;
  emptyTrash: () => void;
  addProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  trashProject: (id: string) => void;
  moveProject: (id: string, direction: -1 | 1) => void;
  moveTask: (id: string, direction: -1 | 1) => void;
  setView: (viewId: string) => void;
  setFilter: (filter: Filter) => void;
  setSort: (key: SortKey, dir: SortDir) => void;
  setDraft: (draft: string) => void;
  notify: (message: string, tone?: 'info' | 'warn') => void;
  dismiss: (id: string) => void;
  importJson: (text: string) => void;
}

export interface ParseSummary {
  title: string;
  warnings: string[];
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot().then((snapshot) => {
      if (!cancelled) dispatch({ type: 'hydrate', ...snapshot });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Write-through persistence. Debounced so a burst of keystrokes or a drag
  // reorder does not hammer IndexedDB.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!state.ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveSnapshot({ tasks: latest.current.tasks, projects: latest.current.projects });
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.tasks, state.projects, state.ready]);

  const notify = useCallback((message: string, tone: 'info' | 'warn' = 'info') => {
    dispatch({ type: 'toast', message, tone });
  }, []);

  const resolveProject = useCallback(
    (name: string | null): { projectId: string | null; created: Project | null } => {
      if (!name) return { projectId: null, created: null };
      const wanted = name.trim().toLowerCase();
      const existing = latest.current.projects.find(
        (p) => !p.isDeleted && p.name.trim().toLowerCase() === wanted,
      );
      if (existing) return { projectId: existing.id, created: null };
      const project = createProject(name, latest.current.projects);
      dispatch({ type: 'setProjects', projects: [...latest.current.projects, project] });
      latest.current = {
        ...latest.current,
        projects: [...latest.current.projects, project],
      };
      return { projectId: project.id, created: project };
    },
    [],
  );

  const addFromText = useCallback(
    (text: string, projectId: string | null): ParseSummary => {
      const parsed = parseInput(text);
      if (!parsed.title && parsed.labels.length === 0) {
        return { title: '', warnings: ['Nothing to add.'] };
      }

      const resolved = resolveProject(parsed.project);
      const task = createTask(parsed, resolved.projectId ?? projectId, latest.current.tasks);

      // A quick-add into a project view should not also stamp an inbox task.
      const finalTask =
        parsed.project === null && projectId !== null ? { ...task, projectId } : task;
      dispatch({ type: 'addTask', task: finalTask });
      latest.current = { ...latest.current, tasks: [...latest.current.tasks, finalTask] };

      const warnings = [...parsed.warnings];
      if (resolved.created) warnings.push(`Created project "${resolved.created.name}".`);
      return { title: finalTask.title, warnings };
    },
    [resolveProject],
  );

  const addBlank = useCallback((projectId: string | null): string => {
    const task = createBlankTask(projectId, latest.current.tasks);
    dispatch({ type: 'addTask', task });
    latest.current = { ...latest.current, tasks: [...latest.current.tasks, task] };
    return task.id;
  }, []);

  const complete = useCallback(
    (id: string) => {
      const result = completeTask(latest.current.tasks, id);
      dispatch({ type: 'replaceAll', tasks: result.tasks, projects: latest.current.projects });
      latest.current = { ...latest.current, tasks: result.tasks };
    },
    [],
  );

  const reopen = useCallback((id: string) => {
    const tasks = reopenTask(latest.current.tasks, id);
    dispatch({ type: 'updateTask', id, patch: { completedAt: null } });
    latest.current = { ...latest.current, tasks };
  }, []);

  const update = useCallback((id: string, patch: Partial<Task>) => {
    dispatch({ type: 'updateTask', id, patch });
    latest.current = {
      ...latest.current,
      tasks: latest.current.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    };
  }, []);

  const trash = useCallback((ids: string[]) => {
    dispatch({ type: 'removeTasks', ids });
    const stamp = new Date().toISOString();
    latest.current = {
      ...latest.current,
      tasks: latest.current.tasks.map((t) =>
        ids.includes(t.id) ? { ...t, isDeleted: true, deletedAt: stamp } : t,
      ),
    };
  }, []);

  const restore = useCallback((ids: string[]) => {
    dispatch({ type: 'restoreTasks', ids });
    latest.current = {
      ...latest.current,
      tasks: latest.current.tasks.map((t) =>
        ids.includes(t.id) ? { ...t, isDeleted: false, deletedAt: null } : t,
      ),
    };
  }, []);

  const emptyTrash = useCallback(() => {
    const ids = latest.current.tasks.filter((t) => t.isDeleted).map((t) => t.id);
    dispatch({ type: 'replaceAll', tasks: latest.current.tasks.filter((t) => !t.isDeleted), projects: latest.current.projects });
    latest.current = { ...latest.current, tasks: latest.current.tasks.filter((t) => !t.isDeleted) };
    if (ids.length > 0) notify(`Permanently deleted ${ids.length} task${ids.length === 1 ? '' : 's'}.`, 'warn');
  }, [notify]);

  const addProject = useCallback(
    (name: string) => {
      const project = createProject(name, latest.current.projects);
      dispatch({ type: 'setProjects', projects: [...latest.current.projects, project] });
      latest.current = { ...latest.current, projects: [...latest.current.projects, project] };
    },
    [],
  );

  const renameProject = useCallback((id: string, name: string) => {
    const projects = latest.current.projects.map((p) =>
      p.id === id ? { ...p, name: name.trim() || p.name } : p,
    );
    dispatch({ type: 'setProjects', projects });
    latest.current = { ...latest.current, projects };
  }, []);

  const trashProject = useCallback(
    (id: string) => {
      const projects = latest.current.projects.map((p) =>
        p.id === id ? { ...p, isDeleted: true } : p,
      );
      // Its tasks fall back to the Inbox rather than disappearing.
      const tasks = latest.current.tasks.map((t) =>
        t.projectId === id ? { ...t, projectId: null } : t,
      );
      dispatch({ type: 'setProjects', projects });
      dispatch({ type: 'replaceAll', tasks, projects });
      latest.current = { ...latest.current, projects, tasks };
      notify('Project deleted. Its tasks moved to Inbox.', 'warn');
    },
    [notify],
  );

  const moveProject = useCallback((id: string, direction: -1 | 1) => {
    const sorted = [...latest.current.projects].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((p) => p.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    const projects = latest.current.projects.map((p) => {
      if (p.id === a.id) return { ...p, order: b.order };
      if (p.id === b.id) return { ...p, order: a.order };
      return p;
    });
    dispatch({ type: 'setProjects', projects });
    latest.current = { ...latest.current, projects };
  }, []);

  const moveTask = useCallback((id: string, direction: -1 | 1) => {
    const sorted = [...latest.current.tasks].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((t) => t.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    const tasks = latest.current.tasks.map((t) => {
      if (t.id === a.id) return { ...t, order: b.order };
      if (t.id === b.id) return { ...t, order: a.order };
      return t;
    });
    dispatch({ type: 'replaceAll', tasks, projects: latest.current.projects });
    latest.current = { ...latest.current, tasks };
  }, []);

  const importJson = useCallback(
    (text: string) => {
      try {
        const result = parseImport(text);
        dispatch({ type: 'replaceAll', tasks: result.tasks, projects: result.projects });
        latest.current = { ...latest.current, tasks: result.tasks, projects: result.projects };
        notify(
          `Imported ${result.tasks.length} task${result.tasks.length === 1 ? '' : 's'} and ${result.projects.length} project${result.projects.length === 1 ? '' : 's'}.`,
        );
        for (const w of result.warnings) notify(w, 'warn');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Import failed.', 'warn');
      }
    },
    [notify],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      addFromText,
      addBlank,
      complete,
      reopen,
      update,
      trash,
      restore,
      emptyTrash,
      addProject,
      renameProject,
      trashProject,
      moveProject,
      moveTask,
      setView: (viewId) => dispatch({ type: 'setView', viewId }),
      setFilter: (filter) => dispatch({ type: 'setFilter', filter }),
      setSort: (key, dir) => dispatch({ type: 'setSort', sortKey: key, sortDir: dir }),
      setDraft: (draft) => dispatch({ type: 'setDraft', draft }),
      notify,
      dismiss: (id) => dispatch({ type: 'dismissToast', id }),
      importJson,
    }),
    [
      state,
      addFromText,
      addBlank,
      complete,
      reopen,
      update,
      trash,
      restore,
      emptyTrash,
      addProject,
      renameProject,
      trashProject,
      moveProject,
      moveTask,
      notify,
      importJson,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
