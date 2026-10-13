import { useMemo, useState } from 'react';
import { computeStats } from '../lib/stats';
import { useStore } from '../store/useStore';

/**
 * Statistics, drawn with hand-rolled SVG.
 *
 * No charting library: three small shapes (bar sparkline, horizontal bars, a
 * streak figure) do the job and keep the bundle small.
 */
export function StatsPanel() {
  const store = useStore();
  const [now] = useState(() => new Date());
  const stats = useMemo(
    () => computeStats(store.tasks, store.projects, now),
    [store.tasks, store.projects, now],
  );

  const maxDay = Math.max(1, ...stats.completionsByDate.map((d) => d.count));

  return (
    <aside className="stats-panel" aria-label="Statistics">
      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{stats.completedToday}</span>
          <span className="stat-label">done today</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{stats.dueToday}</span>
          <span className="stat-label">due today</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">day streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{stats.longestStreak}</span>
          <span className="stat-label">best streak</span>
        </div>
      </div>

      <section className="stat-block">
        <h3>Last 28 days</h3>
        <svg
          className="sparkline"
          viewBox="0 0 280 60"
          role="img"
          aria-label={`Completions over the last 28 days, peak ${maxDay} per day`}
          preserveAspectRatio="none"
        >
          {stats.completionsByDate.map((day, i) => {
            const h = (day.count / maxDay) * 52;
            return (
              <rect
                key={day.date}
                x={i * 10}
                y={56 - h}
                width={7}
                height={Math.max(h, day.count > 0 ? 2 : 0)}
                rx={2}
                className={day.count > 0 ? 'spark-bar' : 'spark-bar is-empty'}
              >
                <title>{`${day.date}: ${day.count}`}</title>
              </rect>
            );
          })}
        </svg>
        <p className="muted small">{stats.completionsByDate[0]?.date} → today</p>
      </section>

      <section className="stat-block">
        <h3>By project</h3>
        {stats.completionsByProject.length === 0 ? (
          <p className="muted small">No completions yet.</p>
        ) : (
          <BarList
            items={stats.completionsByProject.map((p) => ({ key: p.projectId ?? 'inbox', label: p.name, value: p.count }))}
            onSelect={(id) => store.setView(id === 'inbox' ? 'completed' : `project:${id}`)}
          />
        )}
      </section>

      <section className="stat-block">
        <h3>By label</h3>
        {stats.completionsByLabel.length === 0 ? (
          <p className="muted small">No labelled completions yet.</p>
        ) : (
          <BarList
            items={stats.completionsByLabel.map((l) => ({ key: l.label, label: `@${l.label}`, value: l.count }))}
            onSelect={(label) => store.setView(`label:${label}`)}
          />
        )}
      </section>
    </aside>
  );
}

function BarList({
  items,
  onSelect,
}: {
  items: Array<{ key: string; label: string; value: number }>;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" className="bar-row" onClick={() => onSelect(item.key)}>
            <span className="bar-label">{item.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </span>
            <span className="bar-value">{item.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
