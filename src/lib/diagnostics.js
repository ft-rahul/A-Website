/*
 * Static diagnostics for the Tutor workspace — a real lexer-level pass,
 * not a guess. It finds problems the learner can see and fix:
 *   - unclosed / mismatched brackets, unterminated strings, comments, templates
 *   - missing expressions (`x = ;`, `if ()`, trailing operators, const without value)
 *   - common typos in keywords and DOM APIs
 *   - logic warnings (assignment in a condition, loose equality)
 *   - HTML tag balance, CSS braces / missing colons / missing semicolons
 * Each diagnostic: { line, col, endCol, severity: 'error' | 'warning', message, hint }
 * Lines and columns are 1-based. JavaScript errors are additionally confirmed by the
 * real engine at run time (see TutorWorkspace), so nothing here claims a run succeeded.
 */

const PAIRS = { ')': '(', ']': '[', '}': '{' };
const NAMES = { '(': 'parenthesis', '[': 'bracket', '{': 'brace', ')': 'parenthesis', ']': 'bracket', '}': 'brace' };

const TYPOS = [
  [/\bfucntion\b|\bfuntion\b|\bfuction\b|\bfunciton\b/, 'function'],
  [/\bretrun\b|\bretunr\b/, 'return'],
  [/\bcosnt\b|\bconts\b/, 'const'],
  [/\bconsle\b|\bcosole\b|\bconsoel\b/, 'console'],
  [/\bconsole\.(lgo|lg|og)\b/, 'console.log'],
  [/\bdocumnet\b|\bdocuemnt\b|\bdoucment\b/, 'document'],
  [/\.addEventListner\b|\.addEvenListener\b|\.addEventlistener\b/, '.addEventListener'],
  [/\.getElementByID\b|\.getElementbyId\b/, '.getElementById'],
  [/\.querySelecter\b|\.queryselector\b/, '.querySelector'],
  [/\.innerHtml\b/, '.innerHTML'],
  [/\.textcontent\b/, '.textContent'],
  [/\blenght\b/, 'length']
];

const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/** Lex JS-like code: returns problems with brackets/strings and a "code-only" copy of each line. */
const lexJs = (code) => {
  const diags = [];
  const stack = [];
  const codeLines = [''];
  let line = 1;
  let col = 0;
  let i = 0;
  let state = 'code'; // code | sq | dq | tpl | line | block | regex
  let strStart = null;
  const tplDepth = [];
  let lastSignificant = '';
  let lastWord = '';
  const push = (ch) => { codeLines[codeLines.length - 1] += ch; };

  while (i < code.length) {
    const ch = code[i];
    const nx = code[i + 1];
    col += 1;
    if (ch === '\n') {
      if (state === 'sq' || state === 'dq') {
        diags.push({ line: strStart.line, col: strStart.col, endCol: strStart.col + 1, severity: 'error', message: 'Unterminated string', hint: `Close the string with ${state === 'sq' ? "'" : '"'} before the end of the line.` });
        state = 'code';
      }
      if (state === 'line') state = 'code';
      if (state === 'regex') state = 'code';
      line += 1;
      col = 0;
      codeLines.push('');
      i += 1;
      continue;
    }
    switch (state) {
      case 'line':
        break;
      case 'block':
        if (ch === '*' && nx === '/') { state = 'code'; i += 1; col += 1; }
        break;
      case 'sq':
      case 'dq':
        if (ch === '\\') { i += 1; col += 1; break; }
        if ((state === 'sq' && ch === "'") || (state === 'dq' && ch === '"')) { state = 'code'; push('""'); lastSignificant = '"'; }
        break;
      case 'regex':
        if (ch === '\\') { i += 1; col += 1; break; }
        if (ch === '[') { // character class
          while (i < code.length && code[i] !== ']' && code[i] !== '\n') { if (code[i] === '\\') { i += 1; col += 1; } i += 1; col += 1; }
          break;
        }
        if (ch === '/') { state = 'code'; push('RX'); lastSignificant = 'w'; }
        break;
      case 'tpl':
        if (ch === '\\') { i += 1; col += 1; break; }
        if (ch === '`') { state = 'code'; push('``'); lastSignificant = '`'; break; }
        if (ch === '$' && nx === '{') {
          stack.push({ ch: '{', line, col, tpl: true });
          tplDepth.push(stack.length);
          state = 'code';
          push('${');
          i += 1;
          col += 1;
        }
        break;
      default: {
        if (ch === '/' && nx === '/') { state = 'line'; i += 1; col += 1; break; }
        if (ch === '/' && nx === '*') { state = 'block'; strStart = { line, col }; i += 1; col += 1; break; }
        if (ch === "'" || ch === '"') { state = ch === "'" ? 'sq' : 'dq'; strStart = { line, col }; break; }
        if (ch === '`') { state = 'tpl'; strStart = { line, col }; break; }
        if (ch === '/' && (REGEX_PRECEDERS.has(lastSignificant) || lastSignificant === '' || ['return', 'typeof', 'case'].includes(lastWord))) {
          state = 'regex';
          strStart = { line, col };
          break;
        }
        if ('([{'.includes(ch)) stack.push({ ch, line, col });
        if (')]}'.includes(ch)) {
          const top = stack[stack.length - 1];
          if (!top) {
            diags.push({ line, col, endCol: col + 1, severity: 'error', message: `Unexpected '${ch}' — there is no open ${NAMES[ch]} to close`, hint: 'Remove it, or add the matching opening bracket earlier.' });
          } else if (top.ch !== PAIRS[ch]) {
            diags.push({ line, col, endCol: col + 1, severity: 'error', message: `Expected '${{ '(': ')', '[': ']', '{': '}' }[top.ch]}' to close the ${NAMES[top.ch]} opened on line ${top.line}, but found '${ch}'`, hint: 'Brackets must close in the reverse order they were opened.' });
            stack.pop();
          } else {
            stack.pop();
            if (ch === '}' && tplDepth.length && tplDepth[tplDepth.length - 1] === stack.length + 1) {
              tplDepth.pop();
              state = 'tpl';
            }
          }
        }
        push(ch);
        if (!/\s/.test(ch)) {
          lastSignificant = ch;
          if (/[\w$]/.test(ch)) {
            const m = code.slice(0, i + 1).match(/[\w$]+$/);
            lastWord = m ? m[0] : '';
            lastSignificant = 'w';
          } else lastWord = '';
        }
      }
    }
    i += 1;
  }
  if (state === 'block') diags.push({ line: strStart.line, col: strStart.col, endCol: strStart.col + 2, severity: 'error', message: 'Unclosed comment — /* has no matching */', hint: 'Add */ where the comment should end.' });
  if (state === 'tpl') diags.push({ line: strStart.line, col: strStart.col, endCol: strStart.col + 1, severity: 'error', message: 'Unterminated template literal', hint: 'Close it with a backtick (`).' });
  if (state === 'sq' || state === 'dq') diags.push({ line: strStart.line, col: strStart.col, endCol: strStart.col + 1, severity: 'error', message: 'Unterminated string', hint: 'Add the closing quote.' });
  stack.forEach((o) => diags.push({
    line: o.line, col: o.col, endCol: o.col + 1, severity: 'error',
    message: `Unclosed ${NAMES[o.ch]} '${o.ch}'${o.tpl ? ' in template expression' : ''} — opened here, never closed`,
    hint: `Add the matching '${{ '(': ')', '[': ']', '{': '}' }[o.ch]}'.`
  }));
  return { diags, codeLines };
};

const lineChecksJs = (codeLines, rawLines) => {
  const diags = [];
  codeLines.forEach((text, idx) => {
    const line = idx + 1;
    const raw = rawLines[idx] || '';
    const at = (re) => { const m = text.match(re); return m ? m.index + 1 : 1; };
    let m;
    if ((m = text.match(/(^|[^=!<>+\-*/%&|^])=\s*[;)]/))) {
      const c = m.index + m[1].length + 1;
      diags.push({ line, col: c, endCol: c + 1, severity: 'error', message: "Missing value after '='", hint: 'Write the value to assign, e.g. = 0' });
    }
    if (/\b(if|while|for|switch)\s*\(\s*\)/.test(text)) {
      const c = at(/\b(if|while|for|switch)\s*\(/);
      diags.push({ line, col: c, endCol: c + text.match(/\b(if|while|for|switch)/)[0].length, severity: 'error', message: 'Empty condition — the parentheses need an expression', hint: 'Put a condition inside, e.g. if (count > 0)' });
    }
    if ((m = text.match(/(?<![+\-])([+*/%]|-(?!-))\s*(;|\))/)) && !/\+\+|--/.test(text.slice(m.index - 1, m.index + 2))) {
      diags.push({ line, col: m.index + 1, endCol: m.index + 2, severity: 'error', message: `Operator '${m[1]}' is missing its right-hand side`, hint: 'Add the value after the operator, or remove the operator.' });
    }
    if ((m = text.match(/\bconst\s+([\w$]+)\s*;/))) {
      diags.push({ line, col: m.index + 1, endCol: m.index + 6, severity: 'error', message: `const '${m[1]}' must be initialised`, hint: `Give it a value: const ${m[1]} = …;  (or use let if it is assigned later)` });
    }
    if ((m = text.match(/\b(if|while)\s*\(([^()]|\([^()]*\))*[^=!<>]=[^=>]/)) && !/===?|!==?|<=|>=|=>/.test(text.slice(text.indexOf('(', m.index), text.lastIndexOf(')')).replace(/[^=!<>]=[^=>]/, ''))) {
      const eq = text.indexOf('=', text.indexOf('(', m.index));
      diags.push({ line, col: eq + 1, endCol: eq + 2, severity: 'warning', message: 'Assignment inside a condition — did you mean === ?', hint: '= assigns a value; === compares. This condition is almost always true.' });
    }
    const loose = /[^=!<>]==[^=]|!=[^=]/.exec(text);
    if (loose) {
      diags.push({ line, col: loose.index + 2, endCol: loose.index + 4, severity: 'warning', message: 'Loose equality converts types before comparing', hint: 'Prefer === and !== so "1" == 1 does not surprise you.' });
    }
    TYPOS.forEach(([re, fix]) => {
      const t = raw.match(re);
      if (t && text.includes(t[0].replace(/^\./, '.'))) {
        diags.push({ line, col: t.index + 1, endCol: t.index + 1 + t[0].length, severity: 'error', message: `Unknown name '${t[0].replace(/^\./, '')}' — did you mean '${fix.replace(/^\./, '')}'?`, hint: 'JavaScript names are case-sensitive and must be spelled exactly.' });
      }
    });
  });
  return diags;
};

export const diagnoseJs = (code) => {
  const rawLines = code.split('\n');
  const { diags, codeLines } = lexJs(code);
  return [...diags, ...lineChecksJs(codeLines, rawLines)];
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', '!doctype']);
const OPTIONAL_CLOSE = new Set(['p', 'li', 'td', 'tr', 'th', 'option', 'dt', 'dd']);

// Elements a document may contain only once. A second opening tag is almost
// always a closing tag with the '/' forgotten (e.g. <html> typed for </html>).
const ONCE = new Set(['html', 'head', 'body', 'title', 'main']);

export const diagnoseHtml = (code) => {
  const diags = [];
  const stack = [];
  const seen = {}; // first opening position of ONCE elements
  const suspects = new Set(); // stack entries already reported as "missing '/'"
  const re = /<!--[\s\S]*?(-->|$)|<\/?\s*([a-zA-Z!][\w-]*)([^>]*?)(\/?)>|<\/?\s*([a-zA-Z][\w-]*)[^>]*$/gm;
  const posOf = (index) => {
    const before = code.slice(0, index);
    const line = before.split('\n').length;
    return { line, col: index - before.lastIndexOf('\n') };
  };
  const missingSlash = (name, p, len, why) => ({
    ...p,
    endCol: p.col + len,
    severity: 'error',
    message: `Line ${p.line}: <${name}> should be </${name}> — the '/' is missing`,
    hint: `${why} Write </${name}> to close the element.`
  });

  // A backslash instead of a slash: <\div>
  const back = /<\\\s*([a-zA-Z][\w-]*)\s*>/g;
  let b;
  while ((b = back.exec(code))) {
    const p = posOf(b.index);
    diags.push({ ...p, endCol: p.col + b[0].length, severity: 'error', message: `Line ${p.line}: '<\\${b[1]}>' uses a backslash — closing tags use '/'`, hint: `Write </${b[1]}>.` });
  }

  // already reported above; parse it as the closing tag it was meant to be
  const src = code.replace(/<\\(?=\s*[a-zA-Z])/g, '</');
  let m;
  while ((m = re.exec(src))) {
    if (m[0].startsWith('<!--')) {
      if (!m[0].endsWith('-->')) diags.push({ ...posOf(m.index), endCol: posOf(m.index).col + 4, severity: 'error', message: 'Unclosed comment — <!-- has no -->', hint: 'Add --> to end the comment.' });
      continue;
    }
    if (m[5]) {
      const p = posOf(m.index);
      diags.push({ ...p, endCol: p.col + m[0].length, severity: 'error', message: `Line ${p.line}: tag <${m[5]}> is missing its closing '>'`, hint: 'Every tag must end with >.' });
      continue;
    }
    const name = m[2].toLowerCase();
    const closing = /^<\//.test(m[0]);
    const attrs = m[3] || '';
    const p = posOf(m.index);
    const quotes = (attrs.match(/"/g) || []).length;
    if (quotes % 2) diags.push({ ...p, endCol: p.col + m[0].length, severity: 'error', message: `Unbalanced quote in <${name}> attributes`, hint: 'Each attribute value needs an opening and a closing quote.' });
    if (VOID.has(name)) {
      if (closing && name !== '!doctype') diags.push({ ...p, endCol: p.col + m[0].length, severity: 'error', message: `</${name}> is not allowed — <${name}> never has a closing tag`, hint: `Remove </${name}>.` });
      continue;
    }
    if (m[4] === '/') continue;
    if (name === 'script' || name === 'style') {
      if (!closing) {
        const end = src.toLowerCase().indexOf(`</${name}`, re.lastIndex);
        if (end === -1) diags.push({ ...p, endCol: p.col + name.length + 1, severity: 'error', message: `<${name}> is never closed`, hint: `Add </${name}>.` });
        else re.lastIndex = end;
      }
      continue;
    }
    if (!closing) {
      if (ONCE.has(name) && seen[name]) {
        // the element is open (or was already used): this must have been meant as </name>
        diags.push(missingSlash(name, p, m[0].length, `<${name}> was already opened on line ${seen[name].line} and can only appear once.`));
        const openIdx = stack.map((s) => s.name).lastIndexOf(name);
        if (openIdx !== -1) {
          // treat it as the intended closing tag so later lines are judged correctly
          for (let k = stack.length - 1; k > openIdx; k--) {
            const open = stack[k];
            if (!OPTIONAL_CLOSE.has(open.name) && !suspects.has(open)) {
              diags.push({ line: open.line, col: open.col, endCol: open.col + open.name.length + 1, severity: 'error', message: `<${open.name}> is not closed before line ${p.line}`, hint: `Add </${open.name}> before the end of <${name}>.` });
            }
          }
          stack.length = openIdx;
        }
        continue;
      }
      if (ONCE.has(name)) seen[name] = p;
      stack.push({ name, ...p });
    } else {
      const idx = stack.map((s) => s.name).lastIndexOf(name);
      if (idx === -1) {
        diags.push({ ...p, endCol: p.col + m[0].length, severity: 'error', message: `Line ${p.line}: closing tag </${name}> has no matching <${name}>`, hint: 'Remove it, or add the opening tag.' });
      } else {
        for (let k = stack.length - 1; k > idx; k--) {
          const open = stack[k];
          if (OPTIONAL_CLOSE.has(open.name) || suspects.has(open)) continue;
          const outer = stack[k - 1];
          if (k - 1 > idx && outer?.name === open.name) {
            // <h1>Hello<h1> — the second tag was meant to close the first
            diags.push(missingSlash(open.name, open, open.name.length + 2, `Line ${outer.line} opens <${open.name}>, and this tag looks like where it should end.`));
            suspects.add(outer);
            k -= 1;
            continue;
          }
          diags.push({ line: open.line, col: open.col, endCol: open.col + open.name.length + 1, severity: 'error', message: `Line ${open.line}: <${open.name}> is not closed before </${name}> on line ${p.line}`, hint: `Add </${open.name}> before </${name}>.` });
        }
        stack.length = idx;
      }
    }
  }

  // Left open at the end. Two unclosed tags of the same name, one inside the
  // other, usually mean the inner one was meant to be the closing tag.
  const reported = new Set();
  for (let i = stack.length - 1; i >= 0; i--) {
    const inner = stack[i];
    if (reported.has(inner) || OPTIONAL_CLOSE.has(inner.name)) continue;
    const outerIdx = stack.slice(0, i).map((s) => s.name).lastIndexOf(inner.name);
    const between = stack.slice(outerIdx + 1, i);
    const innerHasContent = code.slice(posIndex(code, inner)).replace(/^<[^>]*>/, '').trim() === '';
    if (outerIdx !== -1 && (innerHasContent || !between.length)) {
      diags.push(missingSlash(inner.name, inner, inner.name.length + 2, `Line ${stack[outerIdx].line} opens <${inner.name}>, and this tag looks like where it should end.`));
      reported.add(inner);
      reported.add(stack[outerIdx]);
    }
  }
  stack.forEach((open) => {
    if (reported.has(open) || OPTIONAL_CLOSE.has(open.name)) return;
    diags.push({ line: open.line, col: open.col, endCol: open.col + open.name.length + 1, severity: 'error', message: `Line ${open.line}: <${open.name}> is never closed`, hint: `Add </${open.name}> where the element should end.` });
  });
  return diags;
};

// index of a tag's "<" from its 1-based line/col
const posIndex = (code, { line, col }) => {
  let idx = 0;
  for (let l = 1; l < line; l++) idx = code.indexOf('\n', idx) + 1;
  return idx + col - 1;
};

export const diagnoseCss = (code) => {
  const diags = [];
  const lines = code.split('\n');
  const stack = [];
  let inComment = false;
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    let text = '';
    for (let i = 0; i < raw.length; i++) {
      if (inComment) { if (raw[i] === '*' && raw[i + 1] === '/') { inComment = false; i += 1; } continue; }
      if (raw[i] === '/' && raw[i + 1] === '*') { inComment = true; i += 1; continue; }
      text += raw[i];
      if (raw[i] === '{') stack.push({ line, col: i + 1 });
      if (raw[i] === '}') {
        if (!stack.length) diags.push({ line, col: i + 1, endCol: i + 2, severity: 'error', message: "Unexpected '}' — no rule is open", hint: 'Remove it, or add the selector and { before.' });
        else stack.pop();
      }
    }
    const t = text.trim();
    if (!t || !stack.length || /[{}]/.test(t) || t.startsWith('@')) return;
    // inside a rule: declarations
    if (!t.includes(':')) {
      const c = raw.indexOf(t) + 1;
      diags.push({ line, col: c, endCol: c + t.length, severity: 'error', message: `'${t.replace(/;$/, '')}' is not a valid declaration — missing ':'`, hint: 'Declarations look like  property: value;' });
      return;
    }
    if (/:\s*;?$/.test(t)) {
      const c = raw.indexOf(':') + 1;
      diags.push({ line, col: c, endCol: c + 1, severity: 'error', message: `Missing value for '${t.split(':')[0].trim()}'`, hint: 'Write a value after the colon.' });
      return;
    }
    const nextT = (lines[idx + 1] || '').trim();
    if (!t.endsWith(';') && nextT && !nextT.startsWith('}')) {
      diags.push({ line, col: raw.length, endCol: raw.length + 1, severity: 'error', message: 'Missing semicolon — the next declaration will be swallowed into this one', hint: 'End each declaration with ;' });
    }
  });
  if (inComment) diags.push({ line: lines.length, col: 1, endCol: 2, severity: 'error', message: 'Unclosed comment — /* has no */', hint: 'Add */.' });
  stack.forEach((o) => diags.push({ line: o.line, col: o.col, endCol: o.col + 1, severity: 'error', message: "Unclosed rule — '{' is never closed", hint: "Add '}' after the last declaration." }));
  return diags;
};

/** Bracket balance only, for languages Monklogy cannot run (Java, SQL, YAML…). */
export const diagnoseBrackets = (code) => lexJs(code).diags.filter((d) => /bracket|brace|parenthes|Unexpected|Unclosed|Expected/.test(d.message));

export const diagnose = (code, language) => {
  let list = [];
  if (language === 'javascript') list = diagnoseJs(code);
  else if (language === 'html') list = diagnoseHtml(code);
  else if (language === 'css') list = diagnoseCss(code);
  else if (language === 'java' || language === 'sql') list = diagnoseBrackets(code);
  // de-duplicate by line+message
  const seen = new Set();
  return list
    .filter((d) => { const k = `${d.line}:${d.message}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.line - b.line || a.col - b.col);
};

/** Ask the real JavaScript parser (without running anything). */
export const engineSyntaxError = (code) => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    return null;
  } catch (e) {
    return e instanceof SyntaxError ? e.message : null;
  }
};
