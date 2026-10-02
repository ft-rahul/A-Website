import { S, make } from './shared';
import { explainJavaScript } from './javascript';
import { explainHtml } from './html';
import { explainCss } from './css';
import { explainJava } from './java';
import { explainShell, explainDockerfile, explainYaml } from './shell';
import { explainSql } from './sql';

export { S as SOURCES };

const EXPLAINERS = {
  javascript: explainJavaScript,
  html: explainHtml,
  css: explainCss,
  java: explainJava,
  shell: explainShell,
  dockerfile: explainDockerfile,
  yaml: explainYaml,
  sql: explainSql
};

export const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  html: 'HTML',
  css: 'CSS',
  java: 'Java',
  shell: 'Shell',
  dockerfile: 'Dockerfile',
  yaml: 'YAML',
  sql: 'SQL'
};

/**
 * Explain a single line of code.
 *
 * Sources, in priority order:
 *  1. Lesson annotations — written by the course author for that exact line.
 *  2. Pattern rules — recognised constructs for the file's language.
 *  3. Unknown — the Tutor says it does not recognise the line.
 */
export const explainLine = ({ code, lineIndex, language, annotations }) => {
  const lines = code.split('\n');
  const raw = lines[lineIndex] ?? '';
  const line = raw.trim();
  const base = { lineNumber: lineIndex + 1, code: raw };

  if (line && annotations && annotations[line]) {
    return { ...base, source: S.LESSON, tags: [], ...annotations[line] };
  }
  const explain = EXPLAINERS[language];
  if (!explain) {
    return {
      ...base,
      ...make(S.UNKNOWN, {
        title: 'No explainer for this file type',
        says: 'Monklogy cannot explain this kind of file yet.',
        runtime: '',
        why: '',
        next: ''
      })
    };
  }
  try {
    return { ...base, ...explain(line, { lines, lineIndex, raw }) };
  } catch {
    return { ...base, ...make(S.UNKNOWN, { title: 'Could not analyse this line', says: 'Something about this line confused the explainer.', runtime: '', why: '', next: '' }) };
  }
};

/** Short overview for a multi-line selection. */
export const explainRange = ({ code, startLine, endLine, language, annotations }) => {
  const items = [];
  for (let i = startLine; i <= endLine; i++) {
    const r = explainLine({ code, lineIndex: i, language, annotations });
    if (r.title === 'Blank line') continue;
    items.push({ lineNumber: i + 1, title: r.title, source: r.source, code: r.code.trim() });
  }
  return items;
};
