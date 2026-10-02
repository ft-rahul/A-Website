import React, { useEffect, useRef, useState } from 'react';
import { TerminalSquare, Trash2, CircleCheck, CircleAlert, Loader2 } from 'lucide-react';

/** Exit-status pill(s) for a run: ready · running… · exit 0 · exit 1 (+ warnings). */
export const TerminalStatus = ({ status }) => {
  const pill = {
    idle: { cls: 'is-idle', icon: null, text: 'Not run yet' },
    running: { cls: 'is-running', icon: <Loader2 size={12} className="spin" />, text: 'Running…' },
    ok: { cls: 'is-ok', icon: <CircleCheck size={12} />, text: 'It worked' },
    failed: { cls: 'is-failed', icon: <CircleAlert size={12} />, text: status.errors === 1 ? '1 thing to fix' : `${status.errors} things to fix` }
  }[status.state] || { cls: 'is-idle', text: 'Not run yet' };
  // Plain words for learners; warnings are shown in the editor instead
  return <span className={`term-pill ${pill.cls}`} role="status">{pill.icon}{pill.text}</span>;
};

/**
 * CLI-style terminal for the lesson workspace.
 * Line shape: { type: 'cmd'|'log'|'info'|'warn'|'error'|'success'|'dim'|'result', text, loc?: { file, line, col } }
 * headless: the host renders the title, <TerminalStatus> and a clear button itself.
 */
export const Terminal = ({ lines, status, cwd, onCommand, onClear, onJump, placeholder, headless = false }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [hIndex, setHIndex] = useState(-1);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory((h) => [...h.filter((x) => x !== cmd), cmd].slice(-50));
    setHIndex(-1);
    setInput('');
    onCommand(cmd);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      const i = hIndex === -1 ? history.length - 1 : Math.max(0, hIndex - 1);
      setHIndex(i);
      setInput(history[i]);
    } else if (e.key === 'ArrowDown' && hIndex !== -1) {
      e.preventDefault();
      const i = hIndex + 1;
      if (i >= history.length) { setHIndex(-1); setInput(''); } else { setHIndex(i); setInput(history[i]); }
    } else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); onClear(); }
  };

  return (
    <div className="term" onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('term-body')) inputRef.current?.focus(); }}>
      {!headless && (
        <div className="term-head">
          <span className="term-title mono"><TerminalSquare size={13} /> terminal</span>
          <TerminalStatus status={status} />
          <button className="icon-btn is-quiet term-clear" onClick={onClear} aria-label="Clear terminal (Ctrl+L)" title="Clear (Ctrl+L)"><Trash2 size={13} /></button>
        </div>
      )}
      <div ref={bodyRef} className="term-body mono" role="log" aria-live="polite" aria-label="Terminal output">
        {lines.map((l, i) => (
          <div key={i} className={`term-line is-${l.type}`}>
            {l.type === 'cmd' ? (
              <><span className="term-cwd">{cwd}</span><span className="term-sigil">$</span> {l.text}</>
            ) : (
              <>
                {l.type === 'error' && <span className="term-badge">✖</span>}
                {l.type === 'warn' && <span className="term-badge">⚠</span>}
                {l.type === 'success' && <span className="term-badge">✔</span>}
                {l.type === 'result' && <span className="term-badge">←</span>}
                {l.loc && (
                  <button className="term-loc" onClick={() => onJump(l.loc)} title="Show in editor">
                    {l.loc.file}:{l.loc.line}{l.loc.col ? `:${l.loc.col}` : ''}
                  </button>
                )}
                <span className="term-text">{l.text}</span>
              </>
            )}
          </div>
        ))}
        <div className="term-input-row">
          <span className="term-cwd">{cwd}</span><span className="term-sigil">$</span>
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Terminal command"
          />
        </div>
      </div>
    </div>
  );
};
