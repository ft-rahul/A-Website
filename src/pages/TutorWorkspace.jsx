import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '../lib/money';
import {
  ArrowLeft, PanelLeft, ChevronLeft, ChevronRight, CheckCircle2, Check, Lock, Play, RotateCcw,
  Film, PlayCircle, Terminal, BookOpen, ArrowRight, Sparkles, Cpu, NotebookPen, X, ChevronDown, ChevronUp, MonitorPlay,
  Trash2, Info, Pin, Brain, BookmarkPlus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCourse, getCurriculum, summarizeProgress } from '../data/catalog';
import { explainLine, explainRange } from '../lib/explain';
import { storage } from '../lib/storage';
import { getSavedCode, saveCode, clearSavedCode } from '../lib/userData';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { diagnose, engineSyntaxError } from '../lib/diagnostics';
import { Terminal as TerminalPanel, TerminalStatus } from '../components/Terminal';
import { buildDocument } from '../lib/sandbox';
import { VideoPlayer } from '../components/VideoPlayer';
import { CodeEditor } from '../components/CodeEditor';
import { ExplanationPanel } from '../components/ExplanationPanel';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { CourseMark } from '../components/CourseMark';
import { NotesDrawer } from '../components/NotesDrawer';
import { AssistantPanel } from '../components/AssistantPanel';
import { BtsSimulation, hasSimulation } from '../components/BtsSimulation';

const READ_MODE_REASON = {
  java: 'Java is compiled and runs on the JVM, which is not available in the browser.',
  sql: 'SQL runs inside a database server.',
  shell: 'Shell commands run on an operating system, not in the browser.',
  dockerfile: 'Dockerfiles are built by the Docker engine.',
  yaml: 'This configuration is read by CI or Docker, not executed in the browser.',
  javascript: 'This file needs Node.js or a build step (for example JSX), so it cannot run in the browser sandbox.'
};

const SPLIT_LIMITS = { video: [0.28, 0.72], editor: [0.3, 0.75] };
const SPLIT_DEFAULT = { video: 0.5, editor: 0.55 };

const loadSavedCode = getSavedCode;

/* Renders the author's short markdown-style notes as a list. */
const KeyPoints = ({ text }) => {
  const items = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const inline = (t) => t.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
  return (
    <ul className="keypoints">
      {items.map((l, i) => <li key={i}>{inline(l.replace(/^[-*]\s*/, ''))}</li>)}
    </ul>
  );
};

/* ── Empty / locked states ────────────────────────────────── */
const NoCourse = ({ navigateTo }) => (
  <div className="tutor-empty">
    <h1>Pick a course to open the Tutor</h1>
    <p>The Tutor opens inside a lesson. Enrol in a course, or try the free first lesson of any course.</p>
    <button className="btn btn-primary" onClick={() => navigateTo('courses')}>Browse courses <ArrowRight size={15} /></button>
  </div>
);

const LockedLesson = ({ course, lesson, preview, onEnrol, onPreview }) => (
  <div className="locked">
    <CourseMark course={course} size={56} />
    <p className="eyebrow">Lesson {lesson.number}</p>
    <h1>{lesson.title}</h1>
    <p>This lesson is part of <strong>{course.title}</strong>. Enrol to unlock every lesson, the workspace and the Tutor’s explanations.</p>
    <div className="locked-actions">
      <button className="btn btn-accent" onClick={onEnrol}><Lock size={14} /> Enrol for {formatPrice(course.price)}</button>
      {preview && <button className="btn btn-secondary" onClick={onPreview}><PlayCircle size={15} /> Watch the free lesson</button>}
    </div>
  </div>
);

export const TutorWorkspace = () => {
  const { routeParams, navigateTo, purchasedCourseIds, courseProgress, tutorTheme } = useApp();

  // ── Resolve course ───────────────────────────────────────
  const lastVisitedOwned = useMemo(() => {
    const owned = purchasedCourseIds
      .map((id) => ({ id, at: courseProgress[id]?.lastVisitedAt || '' }))
      .sort((a, b) => b.at.localeCompare(a.at));
    return owned[0]?.id;
  }, [purchasedCourseIds, courseProgress]);
  const course = getCourse(routeParams.courseId) || getCourse(lastVisitedOwned) || null;

  if (!course) {
    return (
      <div className="tutor" data-tutor-theme={tutorTheme}>
        <NoCourse navigateTo={navigateTo} />
      </div>
    );
  }
  return <Workspace key={course.id} course={course} />;
};

const Workspace = ({ course }) => {
  const {
    routeParams, navigateTo, isOwned, courseProgress, markLessonCompleted, setLastLesson,
    saveLessonNotes, saveLessonMarks, showToast, tutorTheme, setTutorTheme, startPurchaseFlow
  } = useApp();

  const { modules, lessons } = getCurriculum(course.id);
  const owned = isOwned(course.id);
  const progressEntry = courseProgress[course.id];
  const summary = summarizeProgress(course.id, progressEntry);
  const completed = useMemo(() => new Set(progressEntry?.completedLessons || []), [progressEntry]);
  const previewLesson = lessons.find((l) => l.preview);

  const [lessonId, setLessonId] = useState(() => {
    const requested = lessons.find((l) => l.id === routeParams.lessonId);
    return (requested || summary.current || lessons[0])?.id;
  });
  useEffect(() => {
    if (routeParams.lessonId && lessons.some((l) => l.id === routeParams.lessonId)) setLessonId(routeParams.lessonId);
  }, [routeParams.lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];
  const index = lessons.indexOf(lesson);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const accessible = owned || Boolean(lesson.preview);

  // Keep the address bar canonical: /monkology/courses/:course/learn/:lesson
  useEffect(() => {
    if (routeParams.courseId !== course.id || routeParams.lessonId !== lesson.id) {
      navigateTo('tutor', { courseId: course.id, lessonId: lesson.id }, { replace: true, scroll: false });
    }
  }, [course.id, lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (accessible) setLastLesson(course.id, lesson.id);
  }, [course.id, lesson.id, accessible, setLastLesson]);

  // ── Layout ───────────────────────────────────────────────
  const narrow = useMediaQuery('(max-width: 1080px)');
  // Clean by default: the lesson list opens on demand (remembered on wide screens)
  const [sideOpen, setSideOpen] = useState(() => !window.matchMedia('(max-width: 1080px)').matches && storage.get('lessons_open', false));
  useEffect(() => { if (narrow) setSideOpen(false); }, [narrow]);
  useEffect(() => { if (!narrow) storage.set('lessons_open', sideOpen); }, [sideOpen, narrow]);
  const mainRef = useRef(null);

  const goTo = (l) => {
    if (!l) return;
    setLessonId(l.id);
    navigateTo('tutor', { courseId: course.id, lessonId: l.id }, { scroll: false });
    if (narrow) setSideOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  };

  // ── Tutor theme with a smooth, flash-free transition ────
  const [theming, setTheming] = useState(false);
  const changeTheme = (t) => {
    setTheming(true);
    setTutorTheme(t);
    setTimeout(() => setTheming(false), 450);
  };

  // ── Workspace files ──────────────────────────────────────
  const workspace = lesson.workspace || course.sandbox;
  const isSandbox = !lesson.workspace;
  const [files, setFiles] = useState(() => loadSavedCode(course.id, lesson.id) || workspace.files.map((f) => ({ ...f })));
  const [activeFileId, setActiveFileId] = useState(workspace.files[0].id);
  const [cursor, setCursor] = useState({ start: 0, end: 0 });
  const [hoverLine, setHoverLine] = useState(null);
  const [pinLine, setPinLine] = useState(null); // Behind the scenes: a line held for study
  useEffect(() => setPinLine(null), [activeFileId]);
  const editorRef = useRef(null);

  useEffect(() => {
    const saved = loadSavedCode(course.id, lesson.id);
    const fresh = workspace.files.map((f) => ({ ...f }));
    // Only reuse saved code if it matches this lesson's file set
    setFiles(saved && saved.length === fresh.length && saved.every((f, i) => f.id === fresh[i].id) ? saved : fresh);
    setActiveFileId(workspace.files[0].id);
    setCursor({ start: 0, end: 0 });
    setHoverLine(null);
    setPinLine(null);
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimer = useRef(0);
  const updateCode = (code) => {
    setFiles((fs) => {
      const nextFiles = fs.map((f) => (f.id === activeFileId ? { ...f, code } : f));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveCode(course.id, lesson.id, nextFiles), 500);
      return nextFiles;
    });
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const webMode = workspace.mode === 'web';

  // ── Explanation ──────────────────────────────────────────
  const focusTarget = pinLine ?? hoverLine;
  const explainTarget = focusTarget !== null ? { start: focusTarget, end: focusTarget } : cursor;
  const lineCount = activeFile.code.split('\n').length;
  const safeStart = Math.min(explainTarget.start, lineCount - 1);
  const safeEnd = Math.min(explainTarget.end, lineCount - 1);
  const explanation = useMemo(
    () => explainLine({ code: activeFile.code, lineIndex: safeStart, language: activeFile.language, annotations: workspace.annotations }),
    [activeFile.code, activeFile.language, safeStart, workspace.annotations]
  );
  const rangeItems = useMemo(
    () => (safeEnd > safeStart
      ? explainRange({ code: activeFile.code, startLine: safeStart, endLine: safeEnd, language: activeFile.language, annotations: workspace.annotations })
      : null),
    [activeFile.code, activeFile.language, safeStart, safeEnd, workspace.annotations]
  );
  const onCursorChange = useCallback((r) => setCursor((c) => (c.start === r.start && c.end === r.end ? c : r)), []);

  // ── Diagnostics, run pipeline and terminal ───────────────
  const iframeRef = useRef(null);
  // Each run mounts a fresh iframe (via key). Changing srcdoc on an existing iframe
  // would add entries to the tab's history and break the browser Back button.
  const [frame, setFrame] = useState({ html: '', key: 0 });
  const setSrcDoc = useCallback((html) => setFrame((f) => ({ html, key: f.key + 1 })), []);
  const [result, setResult] = useState(null); // { passed, text }
  const [term, setTerm] = useState([]);
  const [runStatus, setRunStatus] = useState({ state: 'idle', errors: 0, warnings: 0 });
  const [compileErrors, setCompileErrors] = useState(null); // shown over the preview when a build fails
  const runRef = useRef({ id: 0, jsStartLine: 0, started: 0, runtimeErrors: 0, validate: false, timer: 0 });
  const evalId = useRef(0);
  const fileByLang = (lang) => files.find((f) => f.language === lang);
  const jsFileName = fileByLang('javascript')?.name || 'script.js';

  // Live diagnostics for every file (cheap: a single lexer pass)
  const diagnosticsByFile = useMemo(
    () => Object.fromEntries(files.map((f) => [f.id, diagnose(f.code, f.language)])),
    [files]
  );
  const activeDiagnostics = diagnosticsByFile[activeFile.id] || [];
  const totals = useMemo(() => {
    const all = Object.values(diagnosticsByFile).flat();
    return { errors: all.filter((d) => d.severity === 'error').length, warnings: all.filter((d) => d.severity === 'warning').length };
  }, [diagnosticsByFile]);

  const print = useCallback((...lines) => setTerm((t) => [...t, ...lines].slice(-300)), []);

  const diagnosticLines = useCallback(() => {
    const out = [];
    files.forEach((f) => {
      (diagnosticsByFile[f.id] || []).forEach((d) => {
        out.push({ type: d.severity === 'error' ? 'error' : 'warn', text: d.message, loc: { file: f.name, fileId: f.id, line: d.line, col: d.col } });
        if (d.hint) out.push({ type: 'dim', text: `    ↳ ${d.hint}` });
      });
    });
    return out;
  }, [files, diagnosticsByFile]);

  const finishRun = useCallback((ok, errors, warnings) => {
    const r = runRef.current;
    if (r.finished) return; // a run is judged exactly once
    r.finished = true;
    clearTimeout(r.timer);
    const ms = Math.round(performance.now() - r.started);
    setRunStatus({ state: ok ? 'ok' : 'failed', errors, warnings, ms });
    print(ok
      ? { type: 'success', text: `Process exited with code 0 · ${ms} ms${warnings ? ` · ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}` }
      : { type: 'error', text: `Process exited with code 1 · ${errors} error${errors === 1 ? '' : 's'}` });
    if (!r.validate || !workspace.check) return;
    if (!ok) {
      setResult({ passed: false, text: 'The run failed, so the exercise was not checked. Fix the errors shown in the terminal and run again.' });
      return;
    }
    const target = files.find((f) => f.id === workspace.check.file);
    if (target && workspace.check.pattern.test(target.code)) {
      setResult({ passed: true, text: workspace.check.success });
      if (owned && markLessonCompleted(course.id, lesson.id)) showToast('Lesson complete', lesson.title, 'success');
    } else {
      setResult({ passed: false, text: 'The code ran without errors, but the exercise is not complete yet. Re-read the task above.' });
    }
  }, [files, workspace, owned, course.id, lesson.id, lesson.title, markLessonCompleted, showToast, print]);

  const run = useCallback((validate, { quiet = false } = {}) => {
    if (!webMode) return;
    const r = runRef.current;
    clearTimeout(r.timer);
    r.id += 1;
    r.runtimeErrors = 0;
    r.htmlCssErrors = 0;
    r.finished = false;
    r.validate = validate;
    r.started = performance.now();
    setResult(null);
    setCompileErrors(null);
    if (!quiet) print({ type: 'cmd', text: `run ${files.map((f) => f.name).join(' ')}` });

    const staticLines = diagnosticLines();
    const staticErrors = totals.errors;
    const js = fileByLang('javascript')?.code || '';
    const engineErr = engineSyntaxError(js);
    const jsFile = fileByLang('javascript');
    const jsStaticErrors = (diagnosticsByFile[jsFile?.id] || []).filter((d) => d.severity === 'error');
    // Every static error, in every file, blocks the build — browsers silently
    // "repair" broken HTML, so the preview would otherwise look fine.
    const allStaticErrors = files.flatMap((f) =>
      (diagnosticsByFile[f.id] || []).filter((d) => d.severity === 'error').map((d) => ({ ...d, file: f.name, fileId: f.id }))
    );
    const buildFailed = Boolean(engineErr) || allStaticErrors.length > 0;

    if (!quiet || staticLines.length) {
      print({ type: 'dim', text: `› checking ${files.length} file${files.length === 1 ? '' : 's'}…` }, ...staticLines);
    }

    if (buildFailed) {
      // Nothing is rendered or executed until the code is valid.
      setSrcDoc('');
      r.jsStartLine = 0;
      const engineOnly = engineErr && !jsStaticErrors.length;
      const errors = staticErrors + (engineOnly ? 1 : 0);
      if (engineOnly) {
        print({ type: 'error', text: `SyntaxError: ${engineErr}`, loc: { file: jsFileName, fileId: jsFile?.id, line: null } });
      }
      const broken = Array.from(new Set([...allStaticErrors.map((d) => d.file), ...(engineOnly ? [jsFileName] : [])]));
      print({ type: 'error', text: `Build failed — fix ${errors} error${errors === 1 ? '' : 's'} in ${broken.join(', ')}. The preview was not updated.` });
      setCompileErrors([
        ...allStaticErrors.map((d) => ({ file: d.file, fileId: d.fileId, line: d.line, col: d.col, message: d.message, hint: d.hint })),
        ...(engineOnly ? [{ file: jsFileName, fileId: jsFile?.id, line: null, message: `SyntaxError: ${engineErr}` }] : [])
      ]);
      finishRun(false, errors, totals.warnings);
      return;
    }

    r.htmlCssErrors = staticErrors;
    const doc = buildDocument(files, r.id);
    r.jsStartLine = doc.jsStartLine;
    setSrcDoc(doc.html);
    // Completion arrives as a "done" message; a timeout guards against infinite loops.
    r.timer = setTimeout(() => {
      if (runRef.current.id === r.id && runStatusRef.current === 'running') {
        print({ type: 'error', text: 'Timed out after 5 s — the script never finished (an infinite loop?).' });
        finishRun(false, 1, totals.warnings);
      }
    }, 5000);
    setRunStatus({ state: 'running', errors: 0, warnings: totals.warnings });
  }, [webMode, files, diagnosticLines, totals, diagnosticsByFile, jsFileName, print, finishRun]);

  const runStatusRef = useRef('idle');
  runStatusRef.current = runStatus.state;

  // Messages from the sandbox
  useEffect(() => {
    const onMsg = (e) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow || !e.data?.__monklogy) return;
      const d = e.data;
      const r = runRef.current;
      if (d.run !== r.id) return; // stale output from an earlier run
      const toLoc = () => {
        if (!d.lineno) return null;
        const line = d.lineno - r.jsStartLine + 1;
        return line >= 1 ? { file: jsFileName, fileId: files.find((f) => f.language === 'javascript')?.id, line, col: d.colno } : null;
      };
      if (d.type === 'done') {
        if (r.finished) return;
        // allow late async errors (promises, short timers) to surface before judging
        setTimeout(() => {
          if (runRef.current.id !== d.run || runRef.current.finished) return;
          clearTimeout(r.timer);
          const errors = (r.htmlCssErrors || 0) + r.runtimeErrors;
          finishRun(errors === 0, errors, totals.warnings);
        }, 350);
        return;
      }
      if (d.type === 'runtime') {
        r.runtimeErrors += 1;
        print({ type: 'error', text: d.text, loc: toLoc() });
        if (runStatusRef.current !== 'running') setRunStatus((s) => ({ ...s, state: 'failed', errors: (s.errors || 0) + 1 }));
        return;
      }
      if (d.type === 'result') return print({ type: 'result', text: d.text });
      if (d.type === 'evalerror') return print({ type: 'error', text: d.text });
      print({ type: d.type === 'warn' ? 'warn' : d.type === 'error' ? 'error' : 'log', text: d.text });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [files, jsFileName, print, finishRun, totals.warnings]);

  // Fresh terminal per lesson; run once quietly so the preview shows something
  useEffect(() => {
    setResult(null);
    setCompileErrors(null);
    setRunStatus({ state: 'idle', errors: 0, warnings: 0 });
    const banner = [
      { type: 'dim', text: `Monklogy sandbox · ${course.title} · lesson ${lesson.number}` },
      { type: 'dim', text: webMode ? "Type 'help' for commands. Anything else runs as JavaScript in the preview page." : `This lesson is read-and-explain. Type 'check' to inspect the file, 'help' for commands.` }
    ];
    setTerm(banner);
    if (accessible && webMode) setTimeout(() => run(false, { quiet: true }), 0);
    else setSrcDoc('');
  }, [lesson.id, accessible]); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpTo = useCallback((loc) => {
    if (!loc) return;
    if (loc.fileId && loc.fileId !== activeFileId) setActiveFileId(loc.fileId);
    if (loc.line) setTimeout(() => editorRef.current?.focusLine(loc.line - 1), 30);
  }, [activeFileId]);

  const onCommand = useCallback((raw) => {
    const [cmd, ...args] = raw.split(/\s+/);
    print({ type: 'cmd', text: raw });
    switch (cmd) {
      case 'help':
        print(
          { type: 'dim', text: 'run            check, then execute the lesson files' },
          { type: 'dim', text: 'check          static check only (syntax, brackets, typos)' },
          { type: 'dim', text: 'ls             list files' },
          { type: 'dim', text: 'cat <file>     print a file with line numbers' },
          { type: 'dim', text: 'clear          clear the terminal (Ctrl+L)' },
          { type: 'dim', text: webMode ? 'anything else  evaluated as JavaScript inside the preview page' : 'this lesson cannot execute code in the browser' }
        );
        return;
      case 'clear':
      case 'cls':
        setTerm([]);
        return;
      case 'ls':
        print({ type: 'log', text: files.map((f) => f.name).join('   ') });
        return;
      case 'cat': {
        const f = files.find((x) => x.name === args[0] || x.name.endsWith(`/${args[0]}`));
        if (!f) { print({ type: 'error', text: `cat: ${args[0] || ''}: No such file` }); return; }
        print(...f.code.split('\n').map((l, i) => ({ type: 'log', text: `${String(i + 1).padStart(3, ' ')}  ${l}` })));
        return;
      }
      case 'check': {
        const lines = diagnosticLines();
        print(...(lines.length ? lines : [{ type: 'success', text: 'No problems found.' }]));
        print({ type: totals.errors ? 'error' : 'dim', text: `${totals.errors} error${totals.errors === 1 ? '' : 's'}, ${totals.warnings} warning${totals.warnings === 1 ? '' : 's'}` });
        return;
      }
      case 'run':
        setTerm((t) => t.slice(0, -1)); // run() prints its own command line
        run(true);
        return;
      default:
        if (!webMode) {
          print({ type: 'error', text: `${cmd}: command not found — ${READ_MODE_REASON[activeFile.language] || 'this file does not run in the browser.'}` });
          return;
        }
        if (!iframeRef.current?.contentWindow) return;
        evalId.current += 1;
        iframeRef.current.contentWindow.postMessage({ __monklogyEval: true, id: evalId.current, code: raw }, '*');
    }
  }, [files, webMode, print, diagnosticLines, totals, run, activeFile.language]);

  const resetCode = () => {
    clearSavedCode(course.id, lesson.id);
    setFiles(workspace.files.map((f) => ({ ...f })));
    setResult(null);
    showToast('Starter code restored', lesson.title);
  };

  // ── Video ↔ notes ────────────────────────────────────────
  const playerRef = useRef(null);
  const notesRef = useRef(null);
  const [videoTime, setVideoTime] = useState(0);
  // Seek target carried across a lesson switch (e.g. clicking a note in another section)
  const pendingSeek = useRef(null);
  const openLessonAt = (lessonIdToOpen, time) => {
    const target = lessons.find((l) => l.id === lessonIdToOpen);
    if (!target) return;
    if (target.id === lesson.id) {
      if (time != null) seekVideo(time);
      return;
    }
    pendingSeek.current = time != null ? { lessonId: target.id, time } : null;
    goTo(target);
  };
  useEffect(() => setVideoTime(0), [lesson.id]);
  const marks = progressEntry?.marks?.[lesson.id] || [];
  const setMarks = (next, added) => saveLessonMarks(course.id, lesson.id, next, added);
  const addBookmarkAt = (t) => {
    setMarks([...marks, { id: `${Date.now().toString(36)}b`, kind: 'bookmark', time: Math.round(t * 10) / 10, text: '', createdAt: new Date().toISOString() }], 'bookmark');
  };
  const seekVideo = (t) => {
    playerRef.current?.seekTo(t, { play: true });
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Notebook (free-form, autosaved)
  const [notebook, setNotebook] = useState(progressEntry?.notes?.[lesson.id] ?? '');
  const [notebookState, setNotebookState] = useState('saved');
  const notebookTimer = useRef(0);
  useEffect(() => {
    setNotebook(courseProgress[course.id]?.notes?.[lesson.id] ?? '');
    setNotebookState('saved');
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onNotebook = (v) => {
    setNotebook(v);
    setNotebookState('saving');
    clearTimeout(notebookTimer.current);
    notebookTimer.current = setTimeout(() => {
      saveLessonNotes(course.id, lesson.id, v);
      setNotebookState('saved');
    }, 600);
  };
  useEffect(() => () => clearTimeout(notebookTimer.current), []);

  // ── Right rail: assistant, behind the scenes, notes ─────
  const railDocked = useMediaQuery('(min-width: 1281px)');
  const stacked = useMediaQuery('(max-width: 760px)');
  const [railTab, setRailTab] = useState(() => storage.get('rail_tab', 'bts'));
  const [railOpen, setRailOpen] = useState(() => storage.get('rail_open_v2', false) && window.matchMedia('(min-width: 1281px)').matches);
  useEffect(() => storage.set('rail_tab', railTab), [railTab]);
  useEffect(() => { if (railDocked) storage.set('rail_open_v2', railOpen); }, [railOpen, railDocked]);
  useEffect(() => { if (!railDocked) setRailOpen(false); }, [railDocked]);
  const openRail = (tab) => {
    setRailTab(tab);
    setRailOpen(true);
  };
  const toggleRail = (tab) => (railOpen && railTab === tab ? setRailOpen(false) : openRail(tab));
  useEffect(() => {
    if (railDocked || !railOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setRailOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [railDocked, railOpen]);
  const noteAt = (t) => {
    openRail('notes');
    setTimeout(() => notesRef.current?.startNoteAt(Math.round(t * 10) / 10), 80);
  };

  // ── Studio split sizes (video / workspace, editor / console) ──
  const [split, setSplit] = useState(() => ({ video: 0.5, editor: 0.55, ...storage.get('studio_split', {}) }));
  useEffect(() => storage.set('studio_split', split), [split]);
  const studioRef = useRef(null);
  const bottomRef = useRef(null);
  const setPart = (part, v) => setSplit((sp) => ({ ...sp, [part]: Math.min(SPLIT_LIMITS[part][1], Math.max(SPLIT_LIMITS[part][0], v)) }));
  const startDrag = (part) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = part === 'video' ? studioRef.current : bottomRef.current;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pad = (k) => parseFloat(cs[k]) || 0;
    // measure the content box, so the gutters around the studio don't offset the drag
    const box = {
      top: r.top + pad('paddingTop'),
      left: r.left + pad('paddingLeft'),
      height: Math.max(1, r.height - pad('paddingTop') - pad('paddingBottom')),
      width: Math.max(1, r.width - pad('paddingLeft') - pad('paddingRight'))
    };
    const move = (ev) => setPart(part, part === 'video' ? (ev.clientY - box.top) / box.height : (ev.clientX - box.left) / box.width);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-resizing-row', 'is-resizing-col');
    };
    document.body.classList.add(part === 'video' ? 'is-resizing-row' : 'is-resizing-col');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const splitKeys = (part) => (e) => {
    const dec = part === 'video' ? 'ArrowUp' : 'ArrowLeft';
    const inc = part === 'video' ? 'ArrowDown' : 'ArrowRight';
    if (e.key === dec || e.key === inc) {
      e.preventDefault();
      setPart(part, split[part] + (e.key === inc ? 0.05 : -0.05));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setPart(part, e.key === 'Home' ? 0 : 1);
    }
  };
  // A render function (not a component) so the handle keeps focus while resizing with the keyboard
  const splitter = (part, label) => (
    <div
      className={`splitter ${part === 'video' ? 'is-row' : 'is-col'}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={part === 'video' ? 'horizontal' : 'vertical'}
      aria-valuemin={SPLIT_LIMITS[part][0] * 100}
      aria-valuemax={SPLIT_LIMITS[part][1] * 100}
      aria-valuenow={Math.round(split[part] * 100)}
      onPointerDown={startDrag(part)}
      onKeyDown={splitKeys(part)}
      onDoubleClick={() => setSplit((sp) => ({ ...sp, [part]: SPLIT_DEFAULT[part] }))}
      title="Drag to resize · double-click to reset"
    >
      <span className="splitter-grip" aria-hidden="true" />
    </div>
  );

  // ── Console: terminal or preview ─────────────────────────
  const [consoleTab, setConsoleTab] = useState('terminal');
  useEffect(() => { if (!webMode) setConsoleTab('terminal'); }, [webMode]);
  // A failed run is only useful if you can read why: bring the terminal forward
  useEffect(() => { if (runStatus.state === 'failed') setConsoleTab('terminal'); }, [runStatus.state, runStatus.errors]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [readInfo, setReadInfo] = useState(false);
  useEffect(() => { setTaskOpen(false); setReadInfo(false); }, [lesson.id]);

  // ── What the assistant sees ──────────────────────────────
  const getAssistantContext = () => ({
    courseTitle: course.title,
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    prompt: workspace.prompt,
    keyPoints: lesson.notes || '',
    fileName: activeFile.name,
    language: activeFile.language,
    code: activeFile.code,
    cursorLine: Math.min(cursor.start, lineCount - 1) + 1,
    diagnostics: files.flatMap((f) => (diagnosticsByFile[f.id] || []).map((d) => ({ ...d, file: f.name }))),
    terminal: term.filter((l) => l.type !== 'dim').slice(-14).map((l) => (l.type === 'cmd' ? `$ ${l.text}` : l.text)).join('\n')
  });
  const cursorExplanation = useMemo(
    () => explainLine({ code: activeFile.code, lineIndex: Math.min(cursor.start, lineCount - 1), language: activeFile.language, annotations: workspace.annotations }),
    [activeFile.code, activeFile.language, cursor.start, lineCount, workspace.annotations]
  );

  const isDone = completed.has(lesson.id);
  const markDone = () => {
    if (!owned) return;
    if (markLessonCompleted(course.id, lesson.id)) showToast('Lesson complete', lesson.title, 'success');
  };

  const railTabs = [
    { id: 'assistant', label: 'Assistant', icon: <Sparkles size={15} /> },
    { id: 'bts', label: 'Behind the scenes', short: 'Explain', icon: <Cpu size={15} /> },
    { id: 'notes', label: 'Notes', icon: <NotebookPen size={15} /> }
  ];
  // ── Behind the scenes: study tools ───────────────────────
  const codeLines = useMemo(() => activeFile.code.split('\n'), [activeFile.code]);
  const simBefore = useMemo(() => codeLines.slice(0, safeStart), [codeLines, safeStart]);
  const showSim = hasSimulation(activeFile.language) && !(rangeItems && focusTarget === null);
  const [quiz, setQuiz] = useState(() => storage.get('bts_quiz', false));
  useEffect(() => storage.set('bts_quiz', quiz), [quiz]);
  const stepLine = (dir) => {
    let i = safeStart + dir;
    while (i >= 0 && i < lineCount && !codeLines[i].trim()) i += dir;
    if (i < 0 || i >= lineCount) return;
    setPinLine(i);
    editorRef.current?.revealLine(i);
  };
  const saveExplanation = () => {
    const e = explanation;
    if (!e) return;
    const text = `**Line ${e.lineNumber} · ${e.title}**\n\`${e.code.trim()}\`\n\n${[e.says, e.runtime].filter(Boolean).join(' ')}`;
    setMarks([...marks, { id: `${Date.now().toString(36)}x`, kind: 'note', time: null, text, tags: ['revise'], createdAt: new Date().toISOString() }], 'note');
    showToast('Saved to your notes', `Line ${e.lineNumber} · ${e.title}`, 'success');
  };

  return (
    <div className={`tutor ${theming ? 'is-theming' : ''} ${railOpen && railDocked && accessible ? 'has-rail' : ''}`} data-tutor-theme={tutorTheme}>
      <header className="tutor-top">
        <div className="tutor-top-left">
          <button className="icon-btn" onClick={() => navigateTo(owned ? 'my-courses' : 'course-details', { courseId: course.id })} aria-label={owned ? 'Back to My courses' : 'Back to course'}>
            <ArrowLeft size={17} />
          </button>
          <button className="icon-btn" onClick={() => setSideOpen((o) => !o)} aria-expanded={sideOpen} aria-controls="tutor-lessons" aria-label={sideOpen ? 'Hide lessons' : 'Show lessons'}>
            <PanelLeft size={17} />
          </button>
          <div className="tutor-titles">
            <span className="tutor-course mono">{course.title}</span>
            <span className="tutor-lesson">{lesson.title}</span>
          </div>
        </div>
        <div className="tutor-top-right">
          <ThemeSwitch value={tutorTheme} onChange={changeTheme} label="Dark Tutor theme" />
          <div className="tutor-nav">
            <button className="icon-btn" onClick={() => goTo(prev)} disabled={!prev} aria-label={prev ? `Previous lesson: ${prev.title}` : 'No previous lesson'}>
              <ChevronLeft size={17} />
            </button>
            <button className="icon-btn" onClick={() => goTo(next)} disabled={!next} aria-label={next ? `Next lesson: ${next.title}` : 'No next lesson'}>
              <ChevronRight size={17} />
            </button>
          </div>
          {owned && (
            <button className={`btn btn-sm ${isDone ? 'btn-done' : 'btn-secondary'} tutor-complete`} onClick={markDone} aria-pressed={isDone}>
              {isDone ? <CheckCircle2 size={15} /> : <Check size={15} />}
              <span>{isDone ? 'Completed' : 'Mark complete'}</span>
            </button>
          )}
          {accessible && (
            <>
              <div className="tool-dock" role="group" aria-label="Tutor tools">
                {railTabs.map((t) => {
                  const on = railOpen && railTab === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`tool-btn ${t.id === 'bts' ? 'bts-toggle' : ''} ${on ? 'is-on' : ''}`}
                      onClick={() => toggleRail(t.id)}
                      aria-pressed={on}
                      aria-controls="tutor-rail"
                      aria-label={t.label}
                      title={t.label}
                    >
                      {t.icon}
                    </button>
                  );
                })}
              </div>
              <button
                className={`icon-btn rail-toggle ${railOpen ? 'is-on' : ''}`}
                onClick={() => (railOpen ? setRailOpen(false) : openRail(railTab))}
                aria-expanded={railOpen}
                aria-controls="tutor-rail"
                aria-label={railOpen ? 'Hide the Tutor panel' : 'Show the Tutor panel'}
              >
                <Sparkles size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="tutor-body">
        <aside id="tutor-lessons" className={`tutor-side ${sideOpen ? 'is-open' : ''}`} aria-label="Lessons" aria-hidden={!sideOpen}>
          <div className="tutor-side-head">
            <CourseMark course={course} size={34} />
            <div>
              <div className="tutor-side-title">{course.title}</div>
              {owned ? (
                <>
                  <div className="meter is-thin"><span style={{ width: `${summary.percent}%` }} /></div>
                  <div className="tutor-side-meta mono">{summary.percent}% · {summary.completed} of {summary.total}</div>
                </>
              ) : (
                <div className="tutor-side-meta mono">Preview — enrol to unlock all lessons</div>
              )}
            </div>
          </div>
          <nav className="tutor-side-list">
            {modules.map((m) => (
              <div key={m.id} className="tutor-module">
                <div className="tutor-module-title mono">{m.title}</div>
                <ol>
                  {m.lessons.map((l) => {
                    const can = owned || l.preview;
                    const active = l.id === lesson.id;
                    return (
                      <li key={l.id}>
                        <button
                          className={`tutor-lesson-item ${active ? 'is-active' : ''} ${can ? '' : 'is-locked'}`}
                          onClick={() => goTo(l)}
                          aria-current={active ? 'true' : undefined}
                          tabIndex={sideOpen ? 0 : -1}
                        >
                          <span className="tutor-lesson-state" aria-hidden="true">
                            {completed.has(l.id) ? <CheckCircle2 size={15} /> : can ? <span className="dot" /> : <Lock size={12} />}
                          </span>
                          <span className="tutor-lesson-name">{l.title}</span>
                          <span className="tutor-lesson-meta mono">
                            {l.video && <Film size={12} aria-label="Video" />}
                            {l.duration}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </nav>
        </aside>
        {narrow && sideOpen && <div className="tutor-scrim" onClick={() => setSideOpen(false)} aria-hidden="true" />}

        <main ref={mainRef} className="tutor-main" id="main-content">
          {!accessible ? (
            <LockedLesson
              course={course}
              lesson={lesson}
              preview={previewLesson}
              onEnrol={() => startPurchaseFlow(course)}
              onPreview={() => goTo(previewLesson)}
            />
          ) : (
            <>
              <div
                ref={studioRef}
                className="studio"
                style={stacked ? undefined : { gridTemplateRows: `minmax(0, ${split.video}fr) 16px minmax(0, ${1 - split.video}fr)` }}
              >
                <div className="studio-video">
                  <VideoPlayer
                    key={lesson.id}
                    ref={playerRef}
                    video={lesson.video}
                    storageKey={`${course.id}/${lesson.id}`}
                    title={lesson.title}
                    startAt={pendingSeek.current?.lessonId === lesson.id ? pendingSeek.current.time : undefined}
                    markers={marks.filter((m) => m.time != null)}
                    onTime={setVideoTime}
                    onBookmark={addBookmarkAt}
                    onNote={noteAt}
                    next={next ? { title: next.title, number: next.number, duration: next.duration, hasVideo: Boolean(next.video), locked: !(owned || next.preview) } : null}
                    onNext={next && (owned || next.preview) ? () => goTo(next) : undefined}
                    onComplete={() => {
                      if (owned && markLessonCompleted(course.id, lesson.id)) showToast('Lesson complete', 'You watched this lesson to the end.', 'success');
                    }}
                    emptyTitle="Video coming soon"
                    emptyText="The workspace, terminal and Tutor below are ready to use."
                    emptyHint={import.meta.env.DEV ? `Dev: add videos to src/assets/courses/${course.id}/${String(modules.findIndex((m) => m.lessons.includes(lesson)) + 1).padStart(2, '0')}-…/ — they map to this section's lessons in filename order.` : undefined}
                  />
                </div>

                {!stacked && splitter('video', 'Resize video and workspace')}

                <div
                  ref={bottomRef}
                  className="studio-bottom"
                  style={stacked ? undefined : { gridTemplateColumns: `minmax(0, ${split.editor}fr) 16px minmax(0, ${1 - split.editor}fr)` }}
                >
                  <section className="studio-pane studio-editor" aria-label="Code editor">
                    <div className="practice-bar">
                      <div className="file-tabs" role="tablist" aria-label="Files">
                        {files.map((f) => (
                          <button
                            key={f.id}
                            role="tab"
                            aria-selected={f.id === activeFile.id}
                            className={`file-tab mono ${f.id === activeFile.id ? 'is-active' : ''}`}
                            onClick={() => {
                              setActiveFileId(f.id);
                              setCursor({ start: 0, end: 0 });
                            }}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                      <div className="practice-actions">
                        <button
                          className={`btn btn-ghost btn-sm task-toggle ${taskOpen ? 'is-on' : ''}`}
                          onClick={() => setTaskOpen((o) => !o)}
                          aria-expanded={taskOpen}
                          aria-controls="studio-task"
                          title={isSandbox ? 'Practice' : 'Exercise'}
                        >
                          <BookOpen size={14} /> <span className="hide-sm">Task</span>
                        </button>
                        <button className="icon-btn is-quiet" onClick={resetCode} title="Restore the starter code" aria-label="Reset code">
                          <RotateCcw size={14} />
                        </button>
                        {webMode && (
                          <button className="btn btn-accent btn-sm" onClick={() => run(true)}>
                            <Play size={14} fill="currentColor" /> Run
                          </button>
                        )}
                      </div>
                    </div>

                    {taskOpen && (
                      <div id="studio-task" className="studio-task" role="region" aria-label={isSandbox ? 'Practice' : 'Exercise'}>
                        <span className="studio-task-k mono">{isSandbox ? 'Practice' : 'Exercise'}</span>
                        <p>{workspace.prompt}</p>
                        <button className="icon-btn is-quiet" onClick={() => setTaskOpen(false)} aria-label="Close task"><X size={14} /></button>
                      </div>
                    )}

                    <CodeEditor
                      ref={editorRef}
                      value={activeFile.code}
                      onChange={updateCode}
                      fileName={activeFile.name}
                      onCursorChange={onCursorChange}
                      onHoverLine={setHoverLine}
                      hoverText
                      markLine={pinLine}
                      describedBy="editor-help"
                      diagnostics={activeDiagnostics}
                    />
                    <span id="editor-help" className="sr-only">
                      Hover or move to a line to explain it in Behind the scenes. Select lines for an overview. Tab indents; press Escape then Tab to leave the editor.
                    </span>
                    {(totals.errors > 0 || totals.warnings > 0) && (
                    <div className="problems-bar mono">
                      <button
                        className={`problems-count ${totals.errors ? 'has-errors' : totals.warnings ? 'has-warnings' : ''}`}
                        onClick={() => {
                          const firstFile = files.find((f) => (diagnosticsByFile[f.id] || []).length);
                          const d = firstFile && diagnosticsByFile[firstFile.id][0];
                          if (d) jumpTo({ fileId: firstFile.id, line: d.line });
                        }}
                        title="Go to the first problem"
                      >
                        <span className="pc-err">✖ {totals.errors}</span>
                        <span className="pc-warn">⚠ {totals.warnings}</span>
                      </button>
                      <span className="editor-help">Click to jump to the first problem</span>
                    </div>
                    )}
                  </section>

                  {!stacked && splitter('editor', 'Resize editor and terminal')}

                  <section className="studio-pane studio-console" aria-label="Terminal and preview">
                    <div className="console-tabs">
                      {webMode ? (
                        <div className="console-tablist" role="tablist" aria-label="Output">
                          <button role="tab" aria-selected={consoleTab === 'terminal'} className={`console-tab mono ${consoleTab === 'terminal' ? 'is-active' : ''}`} onClick={() => setConsoleTab('terminal')}>
                            <Terminal size={13} /> Terminal
                            {runStatus.state === 'failed' && consoleTab !== 'terminal' && <span className="console-dot is-err" aria-label="has errors" />}
                          </button>
                          <button role="tab" aria-selected={consoleTab === 'preview'} className={`console-tab mono ${consoleTab === 'preview' ? 'is-active' : ''}`} onClick={() => setConsoleTab('preview')} title="Your page, running in a sandbox">
                            <MonitorPlay size={13} /> Preview
                            {compileErrors && consoleTab !== 'preview' && <span className="console-dot is-err" aria-label="failed to compile" />}
                          </button>
                        </div>
                      ) : (
                        <div className="console-tablist">
                          <span className="console-tab mono is-active is-static"><Terminal size={13} /> Terminal</span>
                          <button className={`console-chip mono ${readInfo ? 'is-on' : ''}`} onClick={() => setReadInfo((o) => !o)} aria-expanded={readInfo} aria-controls="readmode-info">
                            <Info size={12} /> Read-only
                          </button>
                        </div>
                      )}
                      <div className="console-status">
                        <TerminalStatus status={runStatus} />
                        <button className="icon-btn is-quiet term-clear" onClick={() => setTerm([])} aria-label="Clear terminal (Ctrl+L)" title="Clear (Ctrl+L)"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {!webMode && readInfo && (
                      <div id="readmode-info" className="readmode">
                        <Terminal size={16} aria-hidden="true" />
                        <p>
                          <strong>Read and explain mode.</strong> {READ_MODE_REASON[activeFile.language] || 'This file is not executed in the browser.'} The terminal can still <code>check</code> it.
                        </p>
                      </div>
                    )}

                    {result && (
                      <div className={`result ${result.passed ? 'is-pass' : 'is-fail'}`} role="status">
                        {result.passed ? <CheckCircle2 size={18} /> : <Terminal size={18} />}
                        <p>{result.passed ? <strong>Exercise passed. </strong> : null}{result.text}</p>
                        {result.passed && next && (
                          <button className="btn btn-sm btn-primary" onClick={() => goTo(next)}>Next <ChevronRight size={14} /></button>
                        )}
                        <button className="icon-btn is-quiet" onClick={() => setResult(null)} aria-label="Dismiss"><X size={14} /></button>
                      </div>
                    )}

                    <div className="console-panes">
                      <div className={`console-pane ${consoleTab === 'terminal' ? 'is-shown' : ''}`} role="tabpanel" aria-label="Terminal" inert={consoleTab !== 'terminal'}>
                        <TerminalPanel
                          lines={term}
                          status={runStatus}
                          cwd={`~/${course.id.split('-')[0]}/${lesson.id}`}
                          onCommand={onCommand}
                          onClear={() => setTerm([])}
                          onJump={jumpTo}
                          placeholder={webMode ? 'run · check · help · or JavaScript' : 'check · cat · help'}
                          headless
                        />
                      </div>
                      {webMode && (
                        <div className={`console-pane is-preview ${consoleTab === 'preview' ? 'is-shown' : ''}`} role="tabpanel" aria-label="Preview" inert={consoleTab !== 'preview'}>
                          <iframe key={frame.key} ref={iframeRef} className="output-frame" srcDoc={frame.html} title="Live preview of your code" sandbox="allow-scripts allow-modals" />
                          {compileErrors && (
                            <div className="compile-overlay" role="alert">
                              <div className="compile-head mono">✖ Failed to compile</div>
                              {compileErrors.map((c, i) => (
                                <button key={i} className="compile-item" onClick={() => jumpTo({ fileId: c.fileId, line: c.line })}>
                                  <span className="mono">{c.file}{c.line ? `:${c.line}:${c.col}` : ''}</span>
                                  <span>{c.message}</span>
                                  {c.hint && <span className="compile-hint">{c.hint}</span>}
                                </button>
                              ))}
                              <p className="compile-foot">Nothing is shown until these are fixed. Click an error to jump to its line.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="tutor-stage">
                <section className="lesson-info" aria-labelledby="lesson-title">
                  <p className="lesson-kicker mono">
                    Lesson {lesson.number} of {lessons.length} · {lesson.moduleTitle}
                    {!owned && lesson.preview && <span className="tag is-accent">Free preview</span>}
                  </p>
                  <h1 id="lesson-title" className="lesson-title">{lesson.title}</h1>
                  <p className="lesson-summary">{lesson.summary}</p>
                  <div className="lesson-grid">
                    <div className="lesson-task">
                      <h2 className="lesson-sub mono"><BookOpen size={13} /> {isSandbox ? 'Practice' : 'Exercise'}</h2>
                      <p className="lesson-prompt">{workspace.prompt}</p>
                      {isSandbox && <p className="muted lesson-sandbox-note">This lesson has no exercise yet, so the workspace is a free scratchpad.</p>}
                    </div>
                    {lesson.notes && (
                      <div className="lesson-keys">
                        <h2 className="lesson-sub mono">Key points</h2>
                        <KeyPoints text={lesson.notes} />
                      </div>
                    )}
                  </div>
                </section>

                <nav className="lesson-pager" aria-label="Lesson navigation">
                  {prev ? (
                    <button className="pager-btn" onClick={() => goTo(prev)}>
                      <span className="mono muted">Previous</span>
                      <span>{prev.title}</span>
                    </button>
                  ) : <span />}
                  {next && (
                    <button className="pager-btn is-next" onClick={() => goTo(next)}>
                      <span className="mono muted">Next</span>
                      <span>{next.title}</span>
                    </button>
                  )}
                </nav>
              </div>
            </>
          )}
        </main>

        {accessible && (
          <>
            {!railDocked && railOpen && <div className="tutor-scrim is-rail" onClick={() => setRailOpen(false)} aria-hidden="true" />}
            <aside
              id="tutor-rail"
              className={`tutor-rail ${railOpen ? 'is-open' : ''} ${railDocked ? 'is-docked' : 'is-overlay'}`}
              aria-label="Tutor tools"
              inert={!railOpen}
            >
              <div className="rail-head">
                <div className="rail-tabs" role="tablist" aria-label="Tutor tools">
                  {railTabs.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      id={`rail-tab-${t.id}`}
                      aria-selected={railTab === t.id}
                      aria-controls={`rail-panel-${t.id}`}
                      className={`rail-tab ${railTab === t.id ? 'is-active' : ''}`}
                      onClick={() => setRailTab(t.id)}
                    >
                      {t.icon}
                      <span className="rail-tab-long">{t.label}</span>
                      {t.short && <span className="rail-tab-short">{t.short}</span>}
                    </button>
                  ))}
                </div>
                <button className="icon-btn is-quiet" onClick={() => setRailOpen(false)} aria-label="Close the Tutor panel"><X size={16} /></button>
              </div>

              <div id="rail-panel-assistant" role="tabpanel" aria-labelledby="rail-tab-assistant" className="rail-panel is-assistant" hidden={railTab !== 'assistant'}>
                <AssistantPanel
                  threadKey={`${course.id}/${lesson.id}`}
                  getContext={getAssistantContext}
                  offline={() => ({ explanation: cursorExplanation })}
                />
              </div>

              <div id="rail-panel-bts" role="tabpanel" aria-labelledby="rail-tab-bts" className="rail-panel is-bts" hidden={railTab !== 'bts'}>
                <div className="study-bar" role="toolbar" aria-label="Study tools">
                  <div className="study-nav">
                    <button className="icon-btn is-quiet" onClick={() => stepLine(-1)} disabled={safeStart <= 0} aria-label="Previous line" title="Previous line"><ChevronUp size={15} /></button>
                    <span className="study-pos mono" aria-live="polite">Line {safeStart + 1}<span className="muted">/{lineCount}</span></span>
                    <button className="icon-btn is-quiet" onClick={() => stepLine(1)} disabled={safeStart >= lineCount - 1} aria-label="Next line" title="Next line"><ChevronDown size={15} /></button>
                  </div>
                  <button className={`study-btn ${pinLine !== null ? 'is-on' : ''}`} onClick={() => setPinLine((p) => (p !== null ? null : safeStart))} aria-pressed={pinLine !== null} title="Hold this line while you study it">
                    <Pin size={13} /> {pinLine !== null ? 'Pinned' : 'Pin'}
                  </button>
                  <button className={`study-btn ${quiz ? 'is-on' : ''}`} onClick={() => setQuiz((q) => !q)} aria-pressed={quiz} title="Hide the answer until you have predicted it">
                    <Brain size={13} /> Predict
                  </button>
                  <button className="study-btn" onClick={saveExplanation} disabled={!explanation || !explanation.code.trim()} title="Save this explanation to your lesson notes">
                    <BookmarkPlus size={13} /> Save
                  </button>
                </div>
                {showSim && (
                  <div className="rail-sim">
                    <span className="rail-sim-k mono">
                      Simulation · line {safeStart + 1}{pinLine !== null ? ' · pinned' : hoverLine !== null ? ' · hover' : ''}
                    </span>
                    <BtsSimulation line={explanation.code} language={activeFile.language} before={simBefore} showSteps />
                  </div>
                )}
                <ExplanationPanel
                  explanation={explanation}
                  rangeItems={focusTarget === null ? rangeItems : null}
                  language={activeFile.language}
                  fileName={activeFile.name}
                  previewing={hoverLine !== null}
                  pinned={pinLine !== null}
                  quiz={quiz}
                  onJump={(i) => editorRef.current?.focusLine(i)}
                />
              </div>

              <div id="rail-panel-notes" role="tabpanel" aria-labelledby="rail-tab-notes" className="rail-panel is-notes" hidden={railTab !== 'notes'}>
                <NotesDrawer
                  ref={notesRef}
                  embedded
                  course={course}
                  lesson={lesson}
                  modules={modules}
                  marksByLesson={progressEntry?.marks || {}}
                  notebooksByLesson={progressEntry?.notes || {}}
                  onMarksChange={setMarks}
                  notebook={notebook}
                  onNotebookChange={onNotebook}
                  notebookState={notebookState}
                  currentTime={videoTime}
                  hasVideo={Boolean(lesson.video)}
                  getTime={() => playerRef.current?.getTime()}
                  onSeek={seekVideo}
                  onOpenAt={openLessonAt}
                  open
                  onToggle={() => {}}
                />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};
