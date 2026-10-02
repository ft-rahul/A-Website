import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Flag, StickyNote, Pencil, Trash2, Download, Check, X, Clock, Plus, ChevronDown, NotebookPen,
  Bold, Italic, Code, List, Eye, PenLine, CornerDownRight
} from 'lucide-react';
import { fmt } from './VideoPlayer';
import { Markdown, renderInline } from '../lib/markdown';

export const NOTE_TAGS = [
  { id: 'important', label: 'Important' },
  { id: 'question', label: 'Question' },
  { id: 'revise', label: 'Revise' },
  { id: 'idea', label: 'Idea' }
];

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const sortMarks = (marks) =>
  [...marks].sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity) || (a.createdAt || '').localeCompare(b.createdAt || ''));

const download = (name, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const slug = (s) => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

const lessonMarkdown = (lesson, marks, notebook) => {
  const out = [`## ${lesson.number}. ${lesson.title}`, ''];
  sortMarks(marks).forEach((m) => {
    const tags = (m.tags || []).map((t) => ` #${t}`).join('');
    out.push(`- ${m.time != null ? `[${fmt(m.time)}] ` : ''}${m.kind === 'bookmark' ? '🔖 ' : ''}${m.text || 'Bookmark'}${tags}`);
  });
  if (notebook && notebook.trim()) out.push('', notebook.trim());
  out.push('');
  return out.join('\n');
};

/* ── One note row ─────────────────────────────────────────── */
const MarkRow = ({ m, editable, onSeek, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text || '');
  const save = () => { onEdit({ ...m, text: text.trim() }); setEditing(false); };
  return (
    <li className={`mark is-${m.kind}`}>
      {m.time != null ? (
        <button className="mark-time mono" onClick={() => onSeek(m.time)} title="Jump to this moment">
          {m.kind === 'bookmark' ? <Flag size={11} /> : <StickyNote size={11} />} {fmt(m.time)}
        </button>
      ) : (
        <span className="mark-time is-static mono"><StickyNote size={11} /></span>
      )}
      {editing ? (
        <div className="mark-edit">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus aria-label="Edit note"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }} />
          <button className="icon-btn is-quiet" onClick={save} aria-label="Save"><Check size={14} /></button>
          <button className="icon-btn is-quiet" onClick={() => setEditing(false)} aria-label="Cancel"><X size={14} /></button>
        </div>
      ) : (
        <div className="mark-body">
          <p className="mark-text">{m.text ? renderInline(m.text, { onTimestamp: onSeek }) : <span className="muted">Bookmark</span>}</p>
          {m.tags?.length > 0 && (
            <div className="mark-tags">{m.tags.map((t) => <span key={t} className={`ntag is-${t}`}>{NOTE_TAGS.find((x) => x.id === t)?.label || t}</span>)}</div>
          )}
        </div>
      )}
      {editable && !editing && (
        <div className="mark-actions">
          <button className="icon-btn is-quiet" onClick={() => { setText(m.text || ''); setEditing(true); }} aria-label="Edit note"><Pencil size={13} /></button>
          <button className="icon-btn is-quiet" onClick={() => onDelete(m.id)} aria-label="Delete note"><Trash2 size={13} /></button>
        </div>
      )}
    </li>
  );
};

/**
 * Notes drawer under the video. Notes are isolated per lesson section;
 * the "Section" and "Course" scopes are read-only overviews.
 */
export const NotesDrawer = forwardRef(function NotesDrawer(
  {
    course, lesson, modules, marksByLesson, notebooksByLesson, onMarksChange, notebook, onNotebookChange, notebookState,
    currentTime, hasVideo, getTime, onSeek, onOpenAt, open: openProp, onToggle, embedded = false
  },
  ref
) {
  const open = embedded || openProp;
  const [scope, setScope] = useState('lesson');
  const [draft, setDraft] = useState('');
  const [draftTags, setDraftTags] = useState([]);
  const [pin, setPin] = useState(true);
  const [pinnedAt, setPinnedAt] = useState(null);
  const [filter, setFilter] = useState(null);
  const [nbMode, setNbMode] = useState('write');
  const composerRef = useRef(null);
  const notebookRef = useRef(null);
  const marks = marksByLesson[lesson.id] || [];
  const module = modules.find((m) => m.lessons.some((l) => l.id === lesson.id));

  useImperativeHandle(ref, () => ({
    startNoteAt(time) {
      if (!open) onToggle(true);
      setScope('lesson');
      setPin(true);
      setPinnedAt(time);
      setTimeout(() => composerRef.current?.focus(), open ? 0 : 380);
    }
  }));

  const visible = useMemo(() => sortMarks(marks).filter((m) => !filter || (m.tags || []).includes(filter)), [marks, filter]);
  const tagCounts = useMemo(() => {
    const c = {};
    marks.forEach((m) => (m.tags || []).forEach((t) => { c[t] = (c[t] || 0) + 1; }));
    return c;
  }, [marks]);

  const captureTime = () => {
    if (!hasVideo || !pin) return null;
    if (pinnedAt != null) return pinnedAt;
    const t = getTime?.();
    return t == null ? null : Math.round(t * 10) / 10;
  };
  const inlineTags = (text) => NOTE_TAGS.filter((t) => new RegExp(`#${t.id}\\b`, 'i').test(text)).map((t) => t.id);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const tags = [...new Set([...draftTags, ...inlineTags(text)])];
    onMarksChange([...marks, { id: newId(), kind: 'note', time: captureTime(), text, tags, createdAt: new Date().toISOString() }], 'note');
    setDraft('');
    setDraftTags([]);
    setPinnedAt(null);
  };
  const addBookmark = () => {
    const t = getTime?.();
    if (t == null) return;
    onMarksChange([...marks, { id: newId(), kind: 'bookmark', time: Math.round(t * 10) / 10, text: draft.trim(), tags: draftTags, createdAt: new Date().toISOString() }], 'bookmark');
    setDraft('');
    setDraftTags([]);
    setPinnedAt(null);
  };

  // Notebook helpers (markdown toolbar)
  const wrap = (before, after = before, placeholder = 'text') => {
    const el = notebookRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = notebook.slice(s, e) || placeholder;
    const next = notebook.slice(0, s) + before + sel + after + notebook.slice(e);
    onNotebookChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const insertAtLineStart = (prefix) => {
    const el = notebookRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = notebook.lastIndexOf('\n', s - 1) + 1;
    onNotebookChange(notebook.slice(0, lineStart) + prefix + notebook.slice(lineStart));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length); });
  };
  const insertTimestamp = () => {
    const t = getTime?.();
    if (t == null) return;
    const el = notebookRef.current;
    const pos = el ? el.selectionStart : notebook.length;
    const stamp = `[${fmt(t)}] `;
    onNotebookChange(notebook.slice(0, pos) + stamp + notebook.slice(pos));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + stamp.length, pos + stamp.length); });
  };

  const exportLesson = () => download(`${slug(course.title)}-lesson-${lesson.number}-notes.md`, `# ${course.title}\n\n${lessonMarkdown(lesson, marks, notebook)}`);
  const exportCourse = () => {
    const parts = [`# ${course.title} — notes`, ''];
    modules.forEach((m) => {
      const withNotes = m.lessons.filter((l) => (marksByLesson[l.id] || []).length || (notebooksByLesson[l.id] || '').trim());
      if (!withNotes.length) return;
      parts.push(`# ${m.title}`, '');
      withNotes.forEach((l) => parts.push(lessonMarkdown(l, marksByLesson[l.id] || [], l.id === lesson.id ? notebook : notebooksByLesson[l.id])));
    });
    download(`${slug(course.title)}-notes.md`, parts.join('\n'));
  };

  const totalHere = marks.length + (notebook.trim() ? 1 : 0);
  const liveTime = pinnedAt ?? currentTime;
  const overviewLessons = scope === 'section' ? module?.lessons || [] : modules.flatMap((m) => m.lessons);

  return (
    <section className={`drawer ${open ? 'is-open' : ''} ${embedded ? 'is-embedded' : ''}`} aria-labelledby="drawer-title">
      {embedded ? (
        <h2 id="drawer-title" className="sr-only">My notes</h2>
      ) : (
      <button className="drawer-handle" onClick={() => onToggle(!open)} aria-expanded={open} aria-controls="drawer-body">
        <span className="drawer-icon" aria-hidden="true"><NotebookPen size={16} /></span>
        <span className="drawer-heading">
          <span id="drawer-title" className="drawer-title">My notes</span>
          <span className="drawer-context mono">Section {lesson.number} · {lesson.title}</span>
        </span>
        {totalHere > 0 && <span className="drawer-count mono" key={totalHere}>{totalHere}</span>}
        <span className="drawer-chevron" aria-hidden="true"><ChevronDown size={18} /></span>
        <span className="drawer-sweep" aria-hidden="true" />
      </button>
      )}

      <div id="drawer-body" className="drawer-body" inert={!open}>
        <div className="drawer-clip">
          <div className="drawer-inner">
            <div className="drawer-toolbar">
              <div className="seg" role="radiogroup" aria-label="Notes scope">
                {[['lesson', 'This lesson'], ['section', 'Section'], ['course', 'Course']].map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => setScope(id)}>{label}</button>
                ))}
              </div>
              {scope === 'lesson' && (
                <div className="tag-filter" role="group" aria-label="Filter by tag">
                  {NOTE_TAGS.filter((t) => tagCounts[t.id]).map((t) => (
                    <button key={t.id} className={`ntag is-${t.id} ${filter === t.id ? 'is-active' : ''}`} aria-pressed={filter === t.id} onClick={() => setFilter(filter === t.id ? null : t.id)}>
                      {t.label} <span className="mono">{tagCounts[t.id]}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="drawer-export">
                <button className="btn btn-ghost btn-sm" onClick={exportLesson} disabled={!totalHere} title="Download this lesson's notes as Markdown"><Download size={13} /> Lesson</button>
                <button className="btn btn-ghost btn-sm" onClick={exportCourse} title="Download all notes in this course"><Download size={13} /> Course</button>
              </div>
            </div>

            {scope === 'lesson' ? (
              <div className="drawer-grid">
                <div className="drawer-col">
                  <div className="composer">
                    <label className="sr-only" htmlFor="note-draft">Write a note</label>
                    <textarea
                      id="note-draft"
                      ref={composerRef}
                      className="composer-input"
                      rows={2}
                      value={draft}
                      placeholder={hasVideo ? 'Note this moment… (Markdown, #question works too)' : 'Write a note…'}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
                        if (e.key === 'Escape') setPinnedAt(null);
                      }}
                    />
                    <div className="composer-tags" role="group" aria-label="Tags for the new note">
                      {NOTE_TAGS.map((t) => (
                        <button key={t.id} className={`ntag is-${t.id} ${draftTags.includes(t.id) ? 'is-active' : ''}`} aria-pressed={draftTags.includes(t.id)}
                          onClick={() => setDraftTags((d) => (d.includes(t.id) ? d.filter((x) => x !== t.id) : [...d, t.id]))}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="composer-row">
                      {hasVideo ? (
                        <button className={`composer-pin mono ${pin ? 'is-on' : ''}`} onClick={() => setPin((p) => !p)} aria-pressed={pin} title="Pin the note to the current video time">
                          <Clock size={12} /> {pin ? `at ${fmt(liveTime || 0)}` : 'no time'}
                        </button>
                      ) : <span />}
                      <div className="composer-actions">
                        {hasVideo && <button className="btn btn-ghost btn-sm" onClick={addBookmark} title="Bookmark this moment (B in the player)"><Flag size={13} /> Bookmark</button>}
                        <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!draft.trim()}><Plus size={13} /> Add</button>
                      </div>
                    </div>
                  </div>
                  {visible.length ? (
                    <ol className="marks">
                      {visible.map((m) => (
                        <MarkRow key={m.id} m={m} editable onSeek={onSeek}
                          onEdit={(next) => onMarksChange(marks.map((x) => (x.id === next.id ? next : x)))}
                          onDelete={(id) => onMarksChange(marks.filter((x) => x.id !== id))} />
                      ))}
                    </ol>
                  ) : (
                    <p className="notes-empty">
                      {filter ? 'No notes with this tag.' : hasVideo
                        ? <>Pin thoughts to moments and jump back later. In the player press <kbd>B</kbd> to bookmark or <kbd>N</kbd> to note.</>
                        : 'Notes you write here belong to this lesson only.'}
                    </p>
                  )}
                </div>

                <div className="drawer-col notebook">
                  <div className="notebook-bar">
                    <span className="notebook-label mono">Notebook</span>
                    <div className="notebook-tools" role="toolbar" aria-label="Formatting">
                      {nbMode === 'write' && (
                        <>
                          <button className="icon-btn is-quiet" onClick={() => wrap('**')} aria-label="Bold" title="Bold"><Bold size={14} /></button>
                          <button className="icon-btn is-quiet" onClick={() => wrap('*')} aria-label="Italic" title="Italic"><Italic size={14} /></button>
                          <button className="icon-btn is-quiet" onClick={() => wrap('`', '`', 'code')} aria-label="Inline code" title="Code"><Code size={14} /></button>
                          <button className="icon-btn is-quiet" onClick={() => insertAtLineStart('- ')} aria-label="Bulleted list" title="List"><List size={14} /></button>
                          {hasVideo && <button className="icon-btn is-quiet" onClick={insertTimestamp} aria-label="Insert current time" title="Insert timestamp"><Clock size={14} /></button>}
                        </>
                      )}
                      <button className={`btn btn-ghost btn-sm nb-mode`} onClick={() => setNbMode(nbMode === 'write' ? 'preview' : 'write')} aria-pressed={nbMode === 'preview'}>
                        {nbMode === 'write' ? <><Eye size={13} /> Preview</> : <><PenLine size={13} /> Write</>}
                      </button>
                    </div>
                  </div>
                  {nbMode === 'write' ? (
                    <textarea
                      ref={notebookRef}
                      className="notebook-input"
                      value={notebook}
                      onChange={(e) => onNotebookChange(e.target.value)}
                      placeholder={'Your own notes in Markdown — **bold**, `code`, - lists, and [1:23] timestamps you can click.'}
                      aria-label="Notebook for this lesson"
                    />
                  ) : (
                    <div className="notebook-preview">
                      {notebook.trim() ? <Markdown text={notebook} onTimestamp={onSeek} /> : <p className="muted">Nothing written yet.</p>}
                    </div>
                  )}
                  <div className="notebook-foot mono muted" aria-live="polite">{notebookState === 'saving' ? 'Saving…' : 'Saved · this lesson only'}</div>
                </div>
              </div>
            ) : (
              <div className="overview">
                {overviewLessons.map((l) => {
                  const lm = sortMarks(marksByLesson[l.id] || []);
                  const nb = (l.id === lesson.id ? notebook : notebooksByLesson[l.id]) || '';
                  if (!lm.length && !nb.trim()) return null;
                  return (
                    <div key={l.id} className={`overview-lesson ${l.id === lesson.id ? 'is-current' : ''}`}>
                      <div className="overview-head">
                        <span className="mono">{String(l.number).padStart(2, '0')}</span>
                        <span className="overview-title">{l.title}</span>
                        {l.id !== lesson.id && <button className="btn btn-ghost btn-sm" onClick={() => onOpenAt(l.id, null)}><CornerDownRight size={13} /> Open</button>}
                      </div>
                      {lm.length > 0 && (
                        <ol className="marks is-readonly">
                          {lm.map((m) => (
                            <MarkRow key={m.id} m={m} editable={false} onSeek={(t) => onOpenAt(l.id, t)} />
                          ))}
                        </ol>
                      )}
                      {nb.trim() && <div className="overview-nb"><Markdown text={nb} onTimestamp={(t) => onOpenAt(l.id, t)} /></div>}
                    </div>
                  );
                })}
                {!overviewLessons.some((l) => (marksByLesson[l.id] || []).length || ((l.id === lesson.id ? notebook : notebooksByLesson[l.id]) || '').trim()) && (
                  <p className="notes-empty">No notes in this {scope === 'section' ? 'section' : 'course'} yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
