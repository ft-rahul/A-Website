import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, Download, Check, X, Clock, Flag, CornerDownRight, ChevronDown } from 'lucide-react';
import { fmt } from './VideoPlayer';
import { Markdown, renderInline } from '../lib/markdown';

// Tags are still recognised when typed inline (#question) and shown on notes.
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

/* ── One note ─────────────────────────────────────────────── */
const MarkRow = ({ m, editable, onSeek, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text || '');
  const save = () => { onEdit({ ...m, text: text.trim() }); setEditing(false); };
  return (
    <li className={`mark is-${m.kind}`}>
      {m.time != null ? (
        <button className="mark-time mono" onClick={() => onSeek(m.time)} title="Play the video from here">
          {m.kind === 'bookmark' && <Flag size={11} />} {fmt(m.time)}
        </button>
      ) : <span />}
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
          <button className="icon-btn is-quiet" onClick={() => { setText(m.text || ''); setEditing(true); }} aria-label="Edit note" title="Edit"><Pencil size={13} /></button>
          <button className="icon-btn is-quiet" onClick={() => onDelete(m.id)} aria-label="Delete note" title="Delete"><Trash2 size={13} /></button>
        </div>
      )}
    </li>
  );
};

/**
 * Notes for the Tutor rail. One simple flow: type a note, press Enter.
 * With a video, each note is linked to the moment it was written, so a click
 * on its time plays the video from there. "All lessons" shows every note in
 * the course; "Longer notes" is a free-form text area for this lesson.
 */
export const NotesDrawer = forwardRef(function NotesDrawer(
  {
    course, lesson, modules, marksByLesson, notebooksByLesson, onMarksChange, notebook, onNotebookChange, notebookState,
    currentTime, hasVideo, getTime, onSeek, onOpenAt
  },
  ref
) {
  const [scope, setScope] = useState('lesson');
  const [draft, setDraft] = useState('');
  const [linkTime, setLinkTime] = useState(true);
  const [pinnedAt, setPinnedAt] = useState(null); // set when a note is started from the player
  const [longOpen, setLongOpen] = useState(() => Boolean(notebook.trim()));
  const composerRef = useRef(null);
  const marks = marksByLesson[lesson.id] || [];

  useImperativeHandle(ref, () => ({
    startNoteAt(time) {
      setScope('lesson');
      setLinkTime(true);
      setPinnedAt(time);
      setTimeout(() => composerRef.current?.focus(), 0);
    }
  }));

  const sorted = useMemo(() => sortMarks(marks), [marks]);
  const inlineTags = (text) => NOTE_TAGS.filter((t) => new RegExp(`#${t.id}\\b`, 'i').test(text)).map((t) => t.id);

  const noteTime = () => {
    if (!hasVideo || !linkTime) return null;
    if (pinnedAt != null) return pinnedAt;
    const t = getTime?.();
    return t == null ? null : Math.round(t * 10) / 10;
  };
  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    onMarksChange([...marks, { id: newId(), kind: 'note', time: noteTime(), text, tags: inlineTags(text), createdAt: new Date().toISOString() }], 'note');
    setDraft('');
    setPinnedAt(null);
  };

  const exportCourse = () => {
    const parts = [`# ${course.title} — notes`, ''];
    modules.forEach((m) => {
      const withNotes = m.lessons.filter((l) => (marksByLesson[l.id] || []).length || ((l.id === lesson.id ? notebook : notebooksByLesson[l.id]) || '').trim());
      if (!withNotes.length) return;
      parts.push(`# ${m.title}`, '');
      withNotes.forEach((l) => parts.push(lessonMarkdown(l, marksByLesson[l.id] || [], l.id === lesson.id ? notebook : notebooksByLesson[l.id])));
    });
    download(`${slug(course.title)}-notes.md`, parts.join('\n'));
  };

  const allLessons = modules.flatMap((m) => m.lessons);
  const lessonsWithNotes = allLessons.filter((l) => (marksByLesson[l.id] || []).length || ((l.id === lesson.id ? notebook : notebooksByLesson[l.id]) || '').trim());
  const shownTime = pinnedAt ?? currentTime;

  return (
    <section className="notes" aria-labelledby="notes-title">
      <h2 id="notes-title" className="sr-only">My notes</h2>

      <div className="notes-head">
        <div className="seg" role="radiogroup" aria-label="Which notes to show">
          {[['lesson', 'This lesson'], ['all', 'All lessons']].map(([id, label]) => (
            <button key={id} role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => setScope(id)}>{label}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportCourse} disabled={!lessonsWithNotes.length} title="Download all your notes for this course">
          <Download size={13} /> Download
        </button>
      </div>

      {scope === 'lesson' ? (
        <>
          <div className="composer">
            <label className="sr-only" htmlFor="note-draft">Write a note</label>
            <textarea
              id="note-draft"
              ref={composerRef}
              className="composer-input"
              rows={2}
              value={draft}
              placeholder="Write something you want to remember…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
                if (e.key === 'Escape') setPinnedAt(null);
              }}
            />
            <div className="composer-row">
              {hasVideo ? (
                <label className="composer-link">
                  <input type="checkbox" checked={linkTime} onChange={(e) => setLinkTime(e.target.checked)} />
                  <Clock size={12} aria-hidden="true" /> Link to video at <span className="mono">{fmt(shownTime || 0)}</span>
                </label>
              ) : <span className="composer-hint">Press Enter to save</span>}
              <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!draft.trim()}>Save note</button>
            </div>
          </div>

          {sorted.length ? (
            <ol className="marks">
              {sorted.map((m) => (
                <MarkRow key={m.id} m={m} editable onSeek={onSeek}
                  onEdit={(next) => onMarksChange(marks.map((x) => (x.id === next.id ? next : x)))}
                  onDelete={(id) => onMarksChange(marks.filter((x) => x.id !== id))} />
              ))}
            </ol>
          ) : (
            <p className="notes-empty">
              No notes yet. {hasVideo ? 'Each note remembers the video time — click the time later to watch that part again.' : 'Your notes are saved with this lesson.'}
            </p>
          )}

          <div className={`notes-long ${longOpen ? 'is-open' : ''}`}>
            <button className="notes-long-toggle" onClick={() => setLongOpen((o) => !o)} aria-expanded={longOpen} aria-controls="notes-long-body">
              <ChevronDown size={14} aria-hidden="true" /> Longer notes
              <span className="notes-long-state mono">{notebookState === 'saving' ? 'Saving…' : notebook.trim() ? 'Saved' : ''}</span>
            </button>
            {longOpen && (
              <textarea
                id="notes-long-body"
                className="notebook-input"
                value={notebook}
                onChange={(e) => onNotebookChange(e.target.value)}
                placeholder="A place for longer thoughts about this lesson. Saved as you type."
                aria-label="Longer notes for this lesson"
              />
            )}
          </div>
        </>
      ) : (
        <div className="overview">
          {lessonsWithNotes.map((l) => {
            const lm = sortMarks(marksByLesson[l.id] || []);
            const nb = (l.id === lesson.id ? notebook : notebooksByLesson[l.id]) || '';
            return (
              <div key={l.id} className={`overview-lesson ${l.id === lesson.id ? 'is-current' : ''}`}>
                <div className="overview-head">
                  <span className="mono">{String(l.number).padStart(2, '0')}</span>
                  <span className="overview-title">{l.title}</span>
                  {l.id !== lesson.id && <button className="btn btn-ghost btn-sm" onClick={() => onOpenAt(l.id, null)}><CornerDownRight size={13} /> Open</button>}
                </div>
                {lm.length > 0 && (
                  <ol className="marks is-readonly">
                    {lm.map((m) => <MarkRow key={m.id} m={m} editable={false} onSeek={(t) => onOpenAt(l.id, t)} />)}
                  </ol>
                )}
                {nb.trim() && <div className="overview-nb"><Markdown text={nb} onTimestamp={(t) => onOpenAt(l.id, t)} /></div>}
              </div>
            );
          })}
          {!lessonsWithNotes.length && <p className="notes-empty">You haven’t written any notes in this course yet.</p>}
        </div>
      )}
    </section>
  );
});
