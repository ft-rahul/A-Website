// Code ↔ preview link ("lens"): find which elements on the running page a
// source line affects, so hovering the line can highlight them in the preview.

import { enclosingBlocks, findOpener, stripStrings } from './explain/shared';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP = new Set(['html', 'head', 'body', 'script', 'style']);
const TAG = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;

/**
 * Tag every opening element with the HTML line it was written on, so the
 * preview can find "the element from line 6". Comments and the contents of
 * <script>/<style> are left alone.
 */
export const annotateHtml = (html) => {
  let inComment = false;
  let rawUntil = null; // inside <script> or <style>
  return html.split('\n').map((line, i) => {
    let out = '';
    let pos = 0;
    while (pos < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', pos);
        if (end === -1) { out += line.slice(pos); pos = line.length; break; }
        out += line.slice(pos, end + 3);
        pos = end + 3;
        inComment = false;
        continue;
      }
      if (rawUntil) {
        const end = line.toLowerCase().indexOf(`</${rawUntil}`, pos);
        if (end === -1) { out += line.slice(pos); pos = line.length; break; }
        out += line.slice(pos, end);
        pos = end;
        rawUntil = null;
        continue;
      }
      const lt = line.indexOf('<', pos);
      if (lt === -1) { out += line.slice(pos); break; }
      out += line.slice(pos, lt);
      if (line.startsWith('<!--', lt)) { inComment = true; out += '<!--'; pos = lt + 4; continue; }
      const m = /^<([a-zA-Z][\w-]*)/.exec(line.slice(lt));
      if (!m) { out += '<'; pos = lt + 1; continue; }
      const name = m[1].toLowerCase();
      out += SKIP.has(name) ? m[0] : `${m[0]} data-ml-line="${i + 1}"`;
      pos = lt + m[0].length;
      if (name === 'script' || name === 'style') {
        const close = line.indexOf('>', pos);
        if (close !== -1 && !/\/\s*$/.test(line.slice(pos, close))) {
          out += line.slice(pos, close + 1);
          pos = close + 1;
          rawUntil = name;
        }
      }
    }
    return out;
  }).join('\n');
};

/** The line whose opening tag created the element a given HTML line belongs to. */
const htmlTarget = (lines, idx) => {
  const stack = [];
  for (let i = 0; i <= idx; i++) {
    const text = lines[i].replace(/<!--.*?-->/g, '');
    let opened = null;
    let closedLine = null;
    TAG.lastIndex = 0;
    let m;
    while ((m = TAG.exec(text))) {
      const name = m[2].toLowerCase();
      if (SKIP.has(name)) continue;
      if (m[1]) {
        const at = stack.map((s) => s.name).lastIndexOf(name);
        if (at !== -1) {
          if (i === idx && closedLine === null) closedLine = stack[at].line;
          stack.length = at;
        }
      } else {
        if (i === idx && opened === null) opened = i;
        if (!VOID.has(name) && !m[3]) stack.push({ name, line: i });
      }
    }
    if (i === idx) {
      if (opened !== null) return opened;
      if (closedLine !== null) return closedLine;
    }
  }
  return stack.length ? stack[stack.length - 1].line : null;
};

// States that only match while the user interacts, plus pseudo-elements:
// drop them so `a:hover` still points at the links.
const DYNAMIC = /::?(hover|focus|focus-visible|focus-within|active|visited|target|checked|before|after|placeholder|selection|first-letter|first-line|marker|backdrop)\b/g;

const cssTarget = (lines, idx) => {
  const own = stripStrings(lines[idx]);
  let openerLine = null;
  if (own.includes('{')) openerLine = idx;
  else if (/,\s*$/.test(own)) {
    // first part of a selector list: the rule opens a few lines below
    for (let i = idx + 1; i < lines.length && openerLine === null; i++) {
      if (lines[i].includes('{')) openerLine = i;
      else if (!/,\s*$/.test(lines[i])) break;
    }
  }
  else if (/^\s*}/.test(own)) openerLine = findOpener(lines, idx)?.index ?? null;
  else openerLine = enclosingBlocks(lines, idx)[0]?.index ?? null;
  if (openerLine === null) return null;
  // A selector list may be spread over several lines: "h1,\nh2 {"
  let selector = lines[openerLine].split('{')[0];
  for (let i = openerLine - 1; i >= 0 && /,\s*$/.test(lines[i]); i--) selector = `${lines[i]} ${selector}`;
  selector = selector.replace(/\/\*.*?\*\//g, '').trim();
  if (!selector || selector.startsWith('@') || /^(from|to|\d+%)/.test(selector)) return null;
  const query = selector.replace(DYNAMIC, '').replace(/\s+/g, ' ').trim() || '*';
  const decl = /^\s*([\w-]+)\s*:\s*([^;]+);?/.exec(lines[idx]);
  return { selector: query, label: selector, detail: decl && openerLine !== idx ? `${decl[1]}: ${decl[2].trim()}` : null };
};

const DOM_CALL = [
  [/querySelector(?:All)?\(\s*(['"`])(.+?)\1/, (m) => m[2]],
  [/getElementById\(\s*(['"`])(.+?)\1/, (m) => `#${m[2]}`],
  [/getElementsByClassName\(\s*(['"`])(.+?)\1/, (m) => m[2].trim().split(/\s+/).map((c) => `.${c}`).join('')],
  [/getElementsByTagName\(\s*(['"`])(.+?)\1/, (m) => m[2]],
  [/\bdocument\.body\b/, () => 'body']
];
const domSelector = (text) => {
  for (const [re, pick] of DOM_CALL) {
    const m = re.exec(text);
    if (m) return pick(m);
  }
  return null;
};

const jsTarget = (lines, idx) => {
  const line = lines[idx].replace(/\/\/.*$/, '');
  const direct = domSelector(line);
  if (direct) return { selector: direct, label: direct };
  // `btn.textContent = …` — follow the variable back to where it was looked up
  const vars = {};
  for (let i = 0; i <= idx; i++) {
    const m = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)/.exec(lines[i]);
    if (!m) continue;
    const sel = domSelector(m[2]);
    if (sel) vars[m[1]] = sel;
    else if (vars[m[2].trim().replace(/;$/, '')]) vars[m[1]] = vars[m[2].trim().replace(/;$/, '')];
  }
  const used = Object.keys(vars).find((v) => new RegExp(`(^|[^\\w$.])${v.replace(/\$/g, '\\$')}\\b`).test(line));
  return used ? { selector: vars[used], label: `${used} → ${vars[used]}` } : null;
};

/**
 * What a line points at on the page:
 *   { line } for HTML (matched via data-ml-line), or { selector } for CSS/JS.
 * Returns null when the line does not touch the page.
 */
export const lensTarget = ({ code, lineIndex, language }) => {
  const lines = code.split('\n');
  if (!lines[lineIndex]?.trim()) return null;
  try {
    if (language === 'html') {
      const at = htmlTarget(lines, lineIndex);
      return at === null ? null : { line: at + 1, label: lines[at].trim().match(/^<[\w-]+/)?.[0].concat('>') || `line ${at + 1}` };
    }
    if (language === 'css') return cssTarget(lines, lineIndex);
    if (language === 'javascript') return jsTarget(lines, lineIndex);
  } catch {
    return null;
  }
  return null;
};

/**
 * Every CSS and JS line that points at elements, so the preview can answer
 * "which lines touch this element?" when it is hovered.
 */
export const linkMap = (files) =>
  files.flatMap((f) => {
    if (f.language !== 'css' && f.language !== 'javascript') return [];
    return f.code.split('\n').map((text, i) => {
      if (/^\s*[})\];]*\s*$/.test(text)) return null; // blank lines and closing brackets
      const t = lensTarget({ code: f.code, lineIndex: i, language: f.language });
      return t?.selector ? { f: f.language === 'css' ? 'css' : 'js', l: i + 1, s: t.selector } : null;
    }).filter(Boolean);
  });
