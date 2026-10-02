import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

export const LINE_HEIGHT = 22;
const PAD_TOP = 14;

const countNewlines = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
};

/**
 * Plain-textarea code editor that reports which lines the cursor or
 * selection covers. The active line is highlighted behind the text, and
 * hovering a line number previews that line without moving the cursor.
 */
export const CodeEditor = forwardRef(function CodeEditor(
  { value, onChange, fileName, onCursorChange, onHoverLine, label, describedBy, lineHeight = LINE_HEIGHT, diagnostics = [], hoverText = false, markLine = null, marks = [] },
  ref
) {
  const textRef = useRef(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [hovered, setHovered] = useState(null);
  const escapeArmed = useRef(false);
  const lines = value.split('\n');
  const PAD_LEFT = 16;

  // Text measurement for squiggles and inline messages (Error Lens style)
  const measureCtx = useRef(null);
  const [fontKey, setFontKey] = useState('');
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setFontKey(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
  });
  const measure = useCallback((text) => {
    if (!fontKey) return text.length * 8;
    if (!measureCtx.current) measureCtx.current = document.createElement('canvas').getContext('2d');
    const ctx = measureCtx.current;
    if (!ctx) return text.length * 8;
    ctx.font = fontKey;
    return ctx.measureText(text.replace(/\t/g, '  ')).width;
  }, [fontKey]);

  const byLine = useMemo(() => {
    const map = {};
    diagnostics.forEach((d) => {
      const cur = map[d.line];
      if (!cur || (cur.severity === 'warning' && d.severity === 'error')) map[d.line] = d;
    });
    return map;
  }, [diagnostics]);

  const report = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: v } = el;
    const start = countNewlines(v.slice(0, selectionStart));
    let end = countNewlines(v.slice(0, selectionEnd));
    if (selectionEnd > selectionStart && v[selectionEnd - 1] === '\n') end = Math.max(start, end - 1);
    setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    onCursorChange?.({ start, end });
  }, [onCursorChange]);

  // selectionchange covers mouse drags and keyboard selection in all modern browsers
  useEffect(() => {
    const onSel = () => {
      if (document.activeElement === textRef.current) report();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [report]);

  const focusLine = useCallback((lineIndex) => {
    const el = textRef.current;
    if (!el) return;
    const all = el.value.split('\n');
    const idx = Math.max(0, Math.min(lineIndex, all.length - 1));
    let offset = 0;
    for (let i = 0; i < idx; i++) offset += all[i].length + 1;
    const indent = (all[idx].match(/^\s*/) || [''])[0].length;
    el.focus({ preventScroll: true });
    el.setSelectionRange(offset + indent, offset + indent);
    const targetTop = PAD_TOP + idx * lineHeight;
    if (targetTop < el.scrollTop || targetTop > el.scrollTop + el.clientHeight - lineHeight * 2) {
      el.scrollTop = Math.max(0, targetTop - el.clientHeight / 3);
    }
    report();
  }, [report, lineHeight]);

  // Scroll a line into view without moving focus or the cursor (used by "step through")
  const revealLine = useCallback((lineIndex) => {
    const el = textRef.current;
    if (!el) return;
    const targetTop = PAD_TOP + lineIndex * lineHeight;
    if (targetTop < el.scrollTop || targetTop > el.scrollTop + el.clientHeight - lineHeight * 2) {
      el.scrollTop = Math.max(0, targetTop - el.clientHeight / 3);
    }
  }, [lineHeight]);

  useImperativeHandle(ref, () => ({ focusLine, revealLine }), [focusLine, revealLine]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      escapeArmed.current = true;
      return;
    }
    if (e.key === 'Tab' && !escapeArmed.current && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = el;
      const next = `${el.value.slice(0, s)}  ${el.value.slice(en)}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(s + 2, s + 2);
        report();
      });
    }
    escapeArmed.current = false;
  };

  return (
    <div className="editor" style={{ lineHeight: `${lineHeight}px`, '--ln-h': `${lineHeight}px` }}>
      <div className="editor-gutter" aria-hidden="true" onMouseLeave={() => onHoverLine?.(null)}>
        <div className="editor-gutter-inner" style={{ transform: `translateY(${-scroll.top}px)` }}>
          {lines.map((_, i) => (
            <div
              key={i}
              className={`editor-ln ${i >= range.start && i <= range.end ? 'is-active' : ''} ${byLine[i + 1] ? `has-${byLine[i + 1].severity}` : ''}`}
              title={byLine[i + 1]?.message}
              onMouseEnter={() => onHoverLine?.(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                focusLine(i);
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="editor-body">
        <div
          className="editor-active"
          aria-hidden="true"
          style={{
            transform: `translateY(${PAD_TOP + range.start * lineHeight - scroll.top}px)`,
            height: `${(range.end - range.start + 1) * lineHeight}px`
          }}
        />
        {markLine !== null && (
          <div
            className="editor-pinned"
            aria-hidden="true"
            style={{ transform: `translateY(${PAD_TOP + markLine * lineHeight - scroll.top}px)`, height: `${lineHeight}px` }}
          />
        )}
        {marks.map((m) => (
          <div
            key={`mark-${m}`}
            className="editor-linked"
            aria-hidden="true"
            style={{ transform: `translateY(${PAD_TOP + m * lineHeight - scroll.top}px)`, height: `${lineHeight}px` }}
          />
        ))}
        {hoverText && hovered !== null && (
          <div
            className="editor-hover"
            aria-hidden="true"
            style={{ transform: `translateY(${PAD_TOP + hovered * lineHeight - scroll.top}px)`, height: `${lineHeight}px` }}
          />
        )}
        <div className="editor-diags" aria-hidden="true" style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
          {Object.values(byLine).map((d) => {
            const text = lines[d.line - 1] || '';
            const top = PAD_TOP + (d.line - 1) * lineHeight;
            const startX = PAD_LEFT + measure(text.slice(0, Math.max(0, d.col - 1)));
            const width = Math.max(8, measure(text.slice(Math.max(0, d.col - 1), Math.max(d.col, (d.endCol || d.col + 1) - 1))));
            const endX = PAD_LEFT + measure(text) + 28;
            return (
              <React.Fragment key={`${d.line}-${d.col}`}>
                <span className={`diag-row is-${d.severity}`} style={{ top, height: lineHeight }} />
                <span className={`diag-squiggle is-${d.severity}`} style={{ top: top + lineHeight - 5, left: startX, width }} />
                <span className={`diag-lens is-${d.severity}`} style={{ top, left: endX, lineHeight: `${lineHeight}px` }}>{d.message}</span>
              </React.Fragment>
            );
          })}
        </div>
        <textarea
          ref={textRef}
          aria-invalid={diagnostics.some((d) => d.severity === 'error') || undefined}
          className="editor-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(report);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={report}
          onClick={report}
          onFocus={report}
          onSelect={report}
          onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
          onMouseMove={hoverText ? (e) => {
            const el = e.currentTarget;
            const y = e.clientY - el.getBoundingClientRect().top + el.scrollTop - PAD_TOP;
            const line = Math.floor(y / lineHeight);
            const next = line >= 0 && line < el.value.split('\n').length ? line : null;
            if (next !== hovered) { setHovered(next); onHoverLine?.(next); }
          } : undefined}
          onMouseLeave={hoverText ? () => { setHovered(null); onHoverLine?.(null); } : undefined}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-label={label || `Code editor: ${fileName}`}
          aria-describedby={describedBy}
        />
      </div>
    </div>
  );
});
