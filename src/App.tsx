import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { QuickAdd } from './components/QuickAdd';
import { CommandPalette } from './components/CommandPalette';
import { StatsPanel } from './components/StatsPanel';
import { StoreProvider, useStore } from './store/useStore';
import { download, stamp, toCsv, toJson } from './lib/io';

function Shell() {
  const store = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [quickAddToken, setQuickAddToken] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeProjectId = store.viewId.startsWith('project:') ? store.viewId.slice(8) : null;

  const focusQuickAdd = useCallback(() => setQuickAddToken((n) => n + 1), []);
  const consumeToken = useCallback(() => {}, []);

  /* ---------- global shortcuts ---------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key.toLowerCase()) {
        case 'n':
        case 'q':
          event.preventDefault();
          focusQuickAdd();
          break;
        case 't':
          store.setView('today');
          break;
        case 'u':
          store.setView('upcoming');
          break;
        case 'i':
          store.setView('inbox');
          break;
        case 'c':
          store.setView('completed');
          break;
        case 's':
          setStatsOpen((v) => !v);
          break;
        case '/':
          event.preventDefault();
          focusQuickAdd();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusQuickAdd, store]);

  /* ---------- data transfer ---------- */
  useEffect(() => {
    const onExportJson = () => download(`open-todoist-${stamp()}.json`, toJson(store.tasks, store.projects), 'application/json');
    const onExportCsv = () => download(`open-todoist-${stamp()}.csv`, toCsv(store.tasks, store.projects), 'text/csv');
    const onImport = () => fileRef.current?.click();
    window.addEventListener('ot:export-json', onExportJson);
    window.addEventListener('ot:export-csv', onExportCsv);
    window.addEventListener('ot:import', onImport);
    return () => {
      window.removeEventListener('ot:export-json', onExportJson);
      window.removeEventListener('ot:export-csv', onExportCsv);
      window.removeEventListener('ot:import', onImport);
    };
  }, [store.tasks, store.projects]);

  if (!store.ready) {
    return (
      <div className="boot">
        <p>Loading your local data…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <QuickAdd projectId={activeProjectId} autoFocusToken={quickAddToken} onConsumedToken={consumeToken} />
        <div className="main-body">
          <TaskList />
          {statsOpen && <StatsPanel />}
        </div>
        <footer className="status-bar">
          <span>
            <kbd>⌘K</kbd> commands · <kbd>N</kbd> add · <kbd>T</kbd> today · <kbd>U</kbd> upcoming ·{' '}
            <kbd>I</kbd> inbox · <kbd>C</kbd> completed · <kbd>S</kbd> stats
          </span>
          <span className="status-actions">
            <button type="button" className="ghost-button" onClick={() => window.dispatchEvent(new CustomEvent('ot:import'))}>
              Import
            </button>
            <button type="button" className="ghost-button" onClick={() => window.dispatchEvent(new CustomEvent('ot:export-json'))}>
              JSON
            </button>
            <button type="button" className="ghost-button" onClick={() => window.dispatchEvent(new CustomEvent('ot:export-csv'))}>
              CSV
            </button>
          </span>
        </footer>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          store.importJson(await file.text());
        }}
      />

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      <div className="toast-stack">
        {store.toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <button type="button" className="icon-button" onClick={() => store.dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
