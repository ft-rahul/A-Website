import React, { useState } from 'react';
import { AlertTriangle, CornerDownRight, X, ChevronDown } from 'lucide-react';

const RUNTIME_LABEL = {
  javascript: 'When it runs',
  html: 'What the browser does',
  css: 'What the browser does',
  java: 'When it runs',
  shell: 'When you run it',
  dockerfile: 'What Docker does',
  yaml: 'When it runs',
  sql: 'What the database does'
};

export const ExplanationPanel = ({ explanation, rangeItems, language, onJump, onClose }) => {
  const isRange = rangeItems && rangeItems.length > 1;

  return (
    <section className="explain" aria-labelledby="explain-heading">
      <h2 id="explain-heading" className="sr-only">What this line does</h2>
      {onClose && (
        <button className="icon-btn is-quiet explain-close" onClick={onClose} aria-label="Close the explanation" title="Close">
          <X size={14} />
        </button>
      )}

      {isRange ? (
        <div className="explain-range">
          <p className="explain-range-intro">
            {rangeItems.length} lines selected. Pick one to see what it does.
          </p>
          <ol className="explain-range-list">
            {rangeItems.map((item) => (
              <li key={item.lineNumber}>
                <button onClick={() => onJump?.(item.lineNumber - 1)}>
                  <span className="mono explain-range-ln">{item.lineNumber}</span>
                  <span className="explain-range-title">{item.title}</span>
                  <code className="explain-range-code">{item.code}</code>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : explanation ? (
        <ExplanationBody key={`${explanation.lineNumber}-${explanation.title}`} explanation={explanation} language={language} />
      ) : (
        <p className="explain-empty">Hover or click any line of code to see what it does.</p>
      )}

    </section>
  );
};

const ExplanationBody = ({ explanation: e, language }) => {
  const [more, setMore] = useState(false);
  const detail = [
    [RUNTIME_LABEL[language] || 'When it runs', e.runtime],
    ['Why it’s written this way', e.why],
    ['What happens next', e.next]
  ].filter(([, text]) => text);
  const extra = detail.length || e.analogy || (e.notes || []).some(Boolean) || (e.tags || []).length;

  return (
    <div className="explain-body">
      <pre className="explain-code"><code>{e.code.trim() || ' '}</code></pre>
      <h3 className="explain-title" aria-live="polite">{e.title}</h3>
      {e.says && <p className="explain-lead">{e.says}</p>}

      {e.warning && (
        <p className="explain-warning" role="note">
          <AlertTriangle size={14} aria-hidden="true" /> {e.warning}
        </p>
      )}

      {more && detail.length > 0 && (
        <dl className="explain-sections">
          {detail.map(([label, text]) => (
            <div key={label} className="explain-section">
              <dt>{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      )}

      {more && e.analogy && (
        <aside className="explain-analogy">
          <span className="explain-analogy-label">Think of it like</span>
          <p>{e.analogy}</p>
        </aside>
      )}

      {more && (e.notes || []).filter(Boolean).map((n) => (
        <p key={n} className="explain-note">
          <CornerDownRight size={13} aria-hidden="true" /> {n}
        </p>
      ))}

      {more && e.tags && e.tags.length > 0 && (
        <div className="explain-tags">
          <span className="explain-tags-label">Also on this line</span>
          <ul>
            {e.tags.map((t) => (
              <li key={t.label}>
                <code>{t.label}</code>
                <span>{t.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {extra ? (
        <button className={`explain-more ${more ? 'is-open' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? 'Show less' : 'Tell me more'} <ChevronDown size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};
