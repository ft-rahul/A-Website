import React, { useState } from 'react';
import { BookOpenCheck, ScanLine, Braces, HelpCircle, AlertTriangle, CornerDownRight, X, Eye, Lightbulb } from 'lucide-react';
import { LANGUAGE_LABELS } from '../lib/explain';

const SOURCE = {
  lesson: { label: 'Lesson note', icon: BookOpenCheck, hint: 'Written by the course author for this exact line.' },
  pattern: { label: 'Recognised pattern', icon: ScanLine, hint: 'Matched against Monklogy’s library of language constructs.' },
  structure: { label: 'Structure', icon: Braces, hint: 'Blank lines, comments and brackets.' },
  unknown: { label: 'Not recognised', icon: HelpCircle, hint: 'Monklogy does not guess when it does not recognise a line.' }
};

const RUNTIME_LABEL = {
  javascript: 'What the JavaScript runtime does',
  html: 'What the browser does',
  css: 'What the browser does',
  java: 'What the compiler and JVM do',
  shell: 'What the shell and system do',
  dockerfile: 'What Docker does',
  yaml: 'What happens when it runs',
  sql: 'What the database does'
};

export const ExplanationPanel = ({ explanation, rangeItems, language, fileName, previewing, onJump, onClose, quiz = false, pinned = false }) => {
  const isRange = rangeItems && rangeItems.length > 1;

  return (
    <section className="explain" aria-labelledby="explain-heading">
      <header className="explain-head">
        <h2 id="explain-heading" className="explain-eyebrow">Behind the scenes</h2>
        <span className="explain-loc mono">
          {isRange
            ? `Lines ${rangeItems[0].lineNumber}–${rangeItems[rangeItems.length - 1].lineNumber}`
            : explanation
            ? `Line ${explanation.lineNumber}`
            : ''}
          {' · '}
          {fileName}
          {pinned ? <span className="explain-pinned"> · pinned</span> : previewing && <span className="explain-preview"> · preview</span>}
        </span>
        {onClose && (
          <button className="icon-btn is-quiet explain-close" onClick={onClose} aria-label="Close Behind the scenes" title="Close">
            <X size={14} />
          </button>
        )}
      </header>

      {isRange ? (
        <div className="explain-range">
          <p className="explain-range-intro">
            {rangeItems.length} lines selected. Choose one to see what it does in detail.
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
        <ExplanationBody key={`${explanation.lineNumber}-${explanation.title}-${quiz}`} explanation={explanation} language={language} quiz={quiz} />
      ) : (
        <p className="explain-empty">Place your cursor on any line in the editor to see what it does.</p>
      )}

      <footer className="explain-foot">
        Explanations come from lesson notes and recognised {LANGUAGE_LABELS[language] || ''} patterns. Monklogy reads your
        code as text — it does not run an AI model or inspect your program while it executes.
      </footer>
    </section>
  );
};

const ExplanationBody = ({ explanation: e, language, quiz }) => {
  const [revealed, setRevealed] = useState(false);
  const hide = quiz && !revealed;
  const src = SOURCE[e.source] || SOURCE.pattern;
  const Icon = src.icon;
  const sections = [
    ['What the code says', e.says],
    [RUNTIME_LABEL[language] || 'What happens at runtime', e.runtime],
    ['Why it’s written this way', e.why],
    ['What happens next', e.next]
  ].filter(([, text]) => text);

  return (
    <div className="explain-body" key={`${e.lineNumber}-${e.title}`}>
      <pre className="explain-code"><code>{e.code.trim() || ' '}</code></pre>
      <div className={`explain-source is-${e.source}`} title={src.hint}>
        <Icon size={13} aria-hidden="true" /> {src.label}
      </div>
      <h3 className="explain-title" aria-live="polite">{e.title}</h3>

      {e.warning && (
        <p className="explain-warning" role="note">
          <AlertTriangle size={14} aria-hidden="true" /> {e.warning}
        </p>
      )}

      <dl className="explain-sections">
        {(hide ? sections.slice(0, 1) : sections).map(([label, text]) => (
          <div key={label} className="explain-section">
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>

      {hide && sections.length > 1 && (
        <div className="explain-predict">
          <p><Lightbulb size={14} aria-hidden="true" /> <strong>Predict first.</strong> {RUNTIME_LABEL[language] ? `${RUNTIME_LABEL[language].replace(/^What /, 'What do you think ')} with this line?` : 'What happens when this line runs?'} Say it out loud, then check.</p>
          <button className="btn btn-sm btn-secondary" onClick={() => setRevealed(true)}><Eye size={14} /> Reveal</button>
        </div>
      )}

      {!hide && e.analogy && (
        <aside className="explain-analogy">
          <span className="explain-analogy-label">Real-world analogy</span>
          <p>{e.analogy}</p>
        </aside>
      )}

      {(e.notes || []).filter(Boolean).map((n) => (
        <p key={n} className="explain-note">
          <CornerDownRight size={13} aria-hidden="true" /> {n}
        </p>
      ))}

      {e.tags && e.tags.length > 0 && (
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
    </div>
  );
};
