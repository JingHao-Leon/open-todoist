import { useEffect, useMemo, useRef, useState } from 'react';
import { parseInput, previewChips } from '../lib/nlp';
import { humanDate } from '../lib/date';
import { useStore } from '../store/useStore';

const EXAMPLES = [
  'Draft release notes #Work @docs tomorrow at 9am p1',
  'Water the plants every weekday @home',
  'Pay rent every month #Finance p2',
  'Renew passport in 3 weeks',
  'Weekly review every friday at 16:00',
];

interface Props {
  /** Project the task lands in when the line has no `#project` token. */
  projectId: string | null;
  /** Where focus should land when the user presses the quick-add key. */
  autoFocusToken: number;
  onConsumedToken: () => void;
}

/**
 * The quick-add box.
 *
 * The parse runs on every keystroke and the result is echoed back as chips
 * underneath, so the user can see exactly what will happen *before* pressing
 * Enter. Nothing is hidden and nothing is guessed silently.
 */
export function QuickAdd({ projectId, autoFocusToken, onConsumedToken }: Props) {
  const store = useStore();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (autoFocusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
      onConsumedToken();
    }
  }, [autoFocusToken, onConsumedToken]);

  const parsed = useMemo(
    () => parseInput(text),
    // Re-parse is cheap; the preview must track the clock so "today" stays true.
    [text, store.ready],
  );
  const chips = useMemo(() => previewChips(parsed, humanDate), [parsed]);

  const submit = () => {
    if (text.trim() === '') return;
    const summary = store.addFromText(text, projectId);
    if (summary.title) setText('');
    for (const w of summary.warnings) store.notify(w, 'warn');
  };

  return (
    <div className="quick-add">
      <div className="quick-add-row">
        <span className="quick-add-mark" aria-hidden="true">
          +
        </span>
        <input
          ref={inputRef}
          className="quick-add-input"
          value={text}
          placeholder={EXAMPLES[placeholderIndex % EXAMPLES.length]}
          aria-label="Add a task in plain language"
          data-testid="quick-add-input"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="ghost-button"
          title="Show another example"
          onClick={() => setPlaceholderIndex((i) => i + 1)}
        >
          hint
        </button>
        <button type="button" className="primary-button" onClick={submit} disabled={text.trim() === ''}>
          Add
        </button>
      </div>

      {chips.length > 0 && (
        <div className="chip-row" data-testid="parse-preview">
          <span className="chip-row-label">will create</span>
          {chips.map((chip, i) => (
            <span key={`${chip.type}-${i}`} className={`chip chip-${chip.type}`} title={chip.type}>
              {chip.text}
            </span>
          ))}
        </div>
      )}

      {parsed.title && (
        <p className="quick-add-preview">
          <span className="muted">title:</span> {parsed.title}
        </p>
      )}
      {parsed.warnings.map((w) => (
        <p key={w} className="quick-add-warning">
          {w}
        </p>
      ))}
    </div>
  );
}
