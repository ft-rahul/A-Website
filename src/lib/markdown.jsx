import React from 'react';

/*
 * Small, safe Markdown renderer (React elements only — no HTML injection).
 * Supports: # headings, - / * / 1. lists, > quotes, ``` code fences,
 * `code`, **bold**, *italic* / _italic_, [text](https://…) and [mm:ss]
 * timestamps (rendered as buttons when onTimestamp is given).
 */

const TS = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]/;
export const parseTimestamp = (s) => s.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);

const inline = (text, opts, keyBase = 'i') => {
  const out = [];
  let rest = text;
  let k = 0;
  const push = (node) => out.push(typeof node === 'string' ? node : React.cloneElement(node, { key: `${keyBase}-${k++}` }));
  while (rest.length) {
    let m;
    if ((m = rest.match(TS))) {
      const t = parseTimestamp(m[1]);
      push(opts.onTimestamp
        ? <button type="button" className="md-ts mono" onClick={() => opts.onTimestamp(t)} title="Jump to this moment">{m[1]}</button>
        : <span className="md-ts mono">{m[1]}</span>);
      rest = rest.slice(m[0].length);
    } else if ((m = rest.match(/^`([^`]+)`/))) {
      push(<code className="md-code">{m[1]}</code>);
      rest = rest.slice(m[0].length);
    } else if ((m = rest.match(/^\*\*([^*]+)\*\*/))) {
      push(<strong>{inline(m[1], opts, `${keyBase}b${k}`)}</strong>);
      rest = rest.slice(m[0].length);
    } else if ((m = rest.match(/^(\*|_)([^*_]+)\1/))) {
      push(<em>{inline(m[2], opts, `${keyBase}e${k}`)}</em>);
      rest = rest.slice(m[0].length);
    } else if ((m = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/))) {
      push(<a href={m[2]} target="_blank" rel="noreferrer noopener">{m[1]}</a>);
      rest = rest.slice(m[0].length);
    } else if ((m = rest.match(/^#([a-z][\w-]*)/i))) {
      push(<span className="md-tag">#{m[1]}</span>);
      rest = rest.slice(m[0].length);
    } else {
      const next = rest.slice(1).search(/[[`*_#]/);
      const take = next === -1 ? rest.length : next + 1;
      push(rest.slice(0, take));
      rest = rest.slice(take);
    }
  }
  // merge adjacent strings
  return out.reduce((acc, n) => {
    if (typeof n === 'string' && typeof acc[acc.length - 1] === 'string') acc[acc.length - 1] += n;
    else acc.push(n);
    return acc;
  }, []);
};

export const renderInline = (text, opts = {}) => inline(text || '', opts);

export const Markdown = ({ text, onTimestamp, className = '' }) => {
  const lines = (text || '').split('\n');
  const blocks = [];
  let i = 0;
  const opts = { onTimestamp };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push(<pre key={blocks.length} className="md-pre"><code>{body.join('\n')}</code></pre>);
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      const Tag = `h${m[1].length + 2}`;
      blocks.push(<Tag key={blocks.length} className="md-h">{inline(m[2], opts)}</Tag>);
      i += 1;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i += 1;
      }
      const L = ordered ? 'ol' : 'ul';
      blocks.push(<L key={blocks.length} className="md-list">{items.map((it, j) => <li key={j}>{inline(it, opts, `l${j}`)}</li>)}</L>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={blocks.length} className="md-quote">{inline(q.join(' '), opts)}</blockquote>);
      continue;
    }
    if (!line.trim()) { i += 1; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={blocks.length} className="md-p">{inline(para.join(' '), opts)}</p>);
  }
  return <div className={`md ${className}`}>{blocks}</div>;
};
