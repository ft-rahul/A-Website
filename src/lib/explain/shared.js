// Shared helpers for the line explainers.

export const S = {
  LESSON: 'lesson', // written by the course author for this exact line
  PATTERN: 'pattern', // recognised language construct
  STRUCTURE: 'structure', // blank lines, comments, closing brackets
  UNKNOWN: 'unknown'
};

export const make = (source, fields) => ({ source, tags: [], ...fields });

/** Strip string and template contents so bracket counting ignores them. */
export const stripStrings = (line) =>
  line
    .replace(/\\./g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``')
    .replace(/\/\/.*$/, '');

/**
 * Walk upward from the first closing bracket on a line to the line that
 * opened it. Works for { } ( ) [ ] across lines.
 */
export const findOpener = (lines, lineIndex) => {
  const pairs = { '}': '{', ')': '(', ']': '[' };
  const current = stripStrings(lines[lineIndex]);
  const pos = current.search(/[}\])]/);
  if (pos === -1) return null;
  const closer = current[pos];
  const opener = pairs[closer];
  let depth = 0;
  for (let i = lineIndex; i >= 0; i--) {
    const text = i === lineIndex ? current.slice(0, pos) : stripStrings(lines[i]);
    for (let j = text.length - 1; j >= 0; j--) {
      const ch = text[j];
      if (ch === closer) depth += 1;
      else if (ch === opener) {
        if (depth === 0) return { index: i, text: lines[i].trim(), closer };
        depth -= 1;
      }
    }
  }
  return null;
};

/** Find the nearest enclosing line that opened a `{` block above lineIndex. */
export const enclosingBlocks = (lines, lineIndex) => {
  const found = [];
  let depth = 0;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const text = stripStrings(lines[i]).split('').reverse();
    for (const ch of text) {
      if (ch === '}') depth += 1;
      else if (ch === '{') {
        if (depth === 0) found.push({ index: i, text: lines[i].trim() });
        else depth -= 1;
      }
    }
  }
  return found; // innermost first
};

export const truncate = (s, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const unknown = (languageLabel) =>
  make(S.UNKNOWN, {
    title: 'No explanation for this line yet',
    says: `Monklogy does not recognise this ${languageLabel} construct, so it will not guess what it does.`,
    runtime: 'Try placing the cursor on a nearby line, or select a block to see an overview of the lines it does recognise.',
    why: '',
    next: ''
  });

export const blank = () =>
  make(S.STRUCTURE, {
    title: 'Blank line',
    says: 'Nothing — this line is empty.',
    runtime: 'Whitespace between statements is skipped by the parser. It has no effect on how the code runs.',
    why: 'Blank lines group related statements so the code is easier to read.',
    next: 'Execution continues with the next non-empty line.'
  });
