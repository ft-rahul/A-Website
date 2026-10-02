import React, { useMemo, useState } from 'react';
import { Pencil, Check, Flame, BookOpen, CheckCircle2, NotebookPen, Lock, Award, ArrowRight, RotateCcw, Sun, Moon, LogOut, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { learnerStats, achievements, RANKS } from '../lib/stats';
import { todayKey } from '../lib/storage';
import { getCourse, getCurriculum } from '../data/catalog';
import { useCountUp } from '../hooks/useCountUp';
import { CourseMark } from '../components/CourseMark';
import { Reveal } from '../components/Reveal';
import { Modal } from '../components/Modal';

const WEEKS = 18;

const relativeTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

/* Monogram inside a ring that fills toward the next rank. */
const IdentityRing = ({ initials, fraction }) => {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="id-ring">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="id-ring-track" />
        <circle cx="64" cy="64" r={r} className="id-ring-fill" style={{ strokeDasharray: c, '--dash-target': c * (1 - Math.max(0.02, fraction)) }} />
      </svg>
      <span className="id-initials">{initials}</span>
    </div>
  );
};

const Stat = ({ id, icon: Icon, value, label, active, onSelect }) => {
  const shown = useCountUp(value);
  return (
    <button className={`stat ${active ? 'is-active' : ''}`} onClick={() => onSelect(id)} aria-pressed={active} aria-controls="stat-detail">
      <Icon size={16} className="stat-icon" aria-hidden="true" />
      <span className="stat-value">{shown}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
};

const Heatmap = ({ days }) => {
  const cells = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (WEEKS - 1) * 7 - end.getDay());
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = todayKey(d);
      const n = days[key] || 0;
      out.push({ key, n, level: n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4 });
    }
    return out;
  }, [days]);
  const activeCount = cells.filter((c) => c.n).length;
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label={`Activity over the last ${WEEKS} weeks: active on ${activeCount} days`}>
        {cells.map((c) => (
          <span key={c.key} className={`hm l${c.level}`} title={`${c.key}: ${c.n} activit${c.n === 1 ? 'y' : 'ies'}`} />
        ))}
      </div>
      <div className="heatmap-legend mono" aria-hidden="true">
        less <span className="hm l0" /><span className="hm l1" /><span className="hm l2" /><span className="hm l3" /><span className="hm l4" /> more
      </div>
    </div>
  );
};

const EVENT_TEXT = {
  enrolled: (e) => `Enrolled in ${getCourse(e.courseId)?.title}`,
  lesson_completed: (e) => `Completed “${getCurriculum(e.courseId).lessons.find((l) => l.id === e.lessonId)?.title}”`,
  bookmark_added: (e) => `Bookmarked a moment in “${getCurriculum(e.courseId).lessons.find((l) => l.id === e.lessonId)?.title}”`,
  note_created: (e) => `Wrote notes on “${getCurriculum(e.courseId).lessons.find((l) => l.id === e.lessonId)?.title}”`
};

export const ProfilePage = () => {
  const { profile, updateProfileName, purchasedCourseIds, courseProgress, activity, navigateTo, theme, toggleTheme, resetAllDemoData } = useApp();
  const { signOut } = useAuth();
  const s = learnerStats({ purchasedCourseIds, courseProgress, activity });
  const awards = achievements(s, activity);
  const unlocked = awards.filter((a) => a.done).length;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const [detail, setDetail] = useState('streak');
  // Reset asks twice: an inline "are you sure", then a final disclaimer dialog.
  const [confirmReset, setConfirmReset] = useState(false);
  const [finalReset, setFinalReset] = useState(false);

  const initials = profile.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const since = profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
  const events = (activity.events || []).filter((e) => EVENT_TEXT[e.type] && getCourse(e.courseId)).slice(0, 8);
  const certificates = s.perCourse.filter((p) => p.total && p.completed >= p.total);
  const closest = [...s.perCourse].filter((p) => p.completed < p.total).sort((a, b) => b.percent - a.percent)[0];

  const saveName = (e) => {
    e.preventDefault();
    updateProfileName(draft);
    setEditing(false);
  };

  return (
    <div className="page profile">
      <div className="container">
        {/* Identity */}
        <section className="identity" aria-labelledby="profile-name">
          <IdentityRing initials={initials} fraction={s.rank.fraction} />
          <div className="identity-main">
            <p className="eyebrow is-accent">{s.rank.current.name}</p>
            {editing ? (
              <form onSubmit={saveName} className="name-form">
                <label className="sr-only" htmlFor="name-input">Your name</label>
                <input id="name-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoFocus />
                <button className="icon-btn" type="submit" aria-label="Save name"><Check size={16} /></button>
              </form>
            ) : (
              <h1 id="profile-name" className="identity-name">
                {profile.name}
                <button className="icon-btn is-quiet" onClick={() => { setDraft(profile.name); setEditing(true); }} aria-label="Edit your name">
                  <Pencil size={14} />
                </button>
              </h1>
            )}
            <p className="identity-sub">{profile.email} · Learning since {since}</p>
            <div className="rank-track" aria-label="Rank progress">
              {RANKS.map((r, i) => (
                <span key={r.name} className={`rank-step ${i <= s.rank.index ? 'is-reached' : ''} ${i === s.rank.index ? 'is-current' : ''}`}>
                  <span className="rank-dot" aria-hidden="true" />
                  <span className="rank-name">{r.name}</span>
                </span>
              ))}
            </div>
            <p className="identity-next mono">
              {s.rank.next ? `${s.rank.toNext} lesson${s.rank.toNext === 1 ? '' : 's'} to ${s.rank.next.name}` : 'Highest rank reached'}
            </p>
          </div>
        </section>

        {/* Stats + detail */}
        <section className="stats-block" aria-label="Learning statistics">
          <div className="stats">
            <Stat id="courses" icon={BookOpen} value={s.owned.length} label="Courses" active={detail === 'courses'} onSelect={setDetail} />
            <Stat id="lessons" icon={CheckCircle2} value={s.lessonsCompleted} label="Lessons done" active={detail === 'lessons'} onSelect={setDetail} />
            <Stat id="streak" icon={Flame} value={s.streak} label="Day streak" active={detail === 'streak'} onSelect={setDetail} />
            <Stat id="notes" icon={NotebookPen} value={s.notes.length} label="Notes" active={detail === 'notes'} onSelect={setDetail} />
          </div>

          <div id="stat-detail" className="stat-detail" key={detail}>
            {detail === 'streak' && (
              <>
                <div className="stat-detail-head">
                  <h2>Activity</h2>
                  <p className="mono muted">current {s.streak} · longest {s.longest} · {s.activeDays} active day{s.activeDays === 1 ? '' : 's'}</p>
                </div>
                <Heatmap days={activity.days || {}} />
                {!s.activeDays && <p className="muted">Complete a lesson or write a note to light up your first square.</p>}
              </>
            )}
            {(detail === 'courses' || detail === 'lessons') && (
              <>
                <div className="stat-detail-head">
                  <h2>{detail === 'courses' ? 'Your courses' : 'Lessons by course'}</h2>
                  <p className="mono muted">{s.lessonsCompleted} of {s.totalLessons} lessons across {s.owned.length} course{s.owned.length === 1 ? '' : 's'}</p>
                </div>
                <ul className="bars">
                  {s.perCourse.map((p) => (
                    <li key={p.course.id}>
                      <button className="bar-row" onClick={() => navigateTo('tutor', { courseId: p.course.id, lessonId: p.current?.id })}>
                        <span className="bar-label">{p.course.title}</span>
                        <span className="meter"><span style={{ width: `${p.percent}%` }} /></span>
                        <span className="mono bar-val">{detail === 'courses' ? `${p.percent}%` : `${p.completed}/${p.total}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {detail === 'notes' && (
              <>
                <div className="stat-detail-head">
                  <h2>Your notes</h2>
                  <p className="mono muted">{s.notes.length} lesson{s.notes.length === 1 ? '' : 's'} with notes</p>
                </div>
                {s.notes.length ? (
                  <ul className="note-list">
                    {s.notes.slice(0, 6).map((n) => (
                      <li key={`${n.course.id}-${n.lesson.id}`}>
                        <button onClick={() => navigateTo('tutor', { courseId: n.course.id, lessonId: n.lesson.id })}>
                          <span className="note-lesson">{n.lesson.title}</span>
                          <span className="note-excerpt">{n.text.replace(/[#*`-]/g, '').trim().slice(0, 120)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Notes you write in a lesson appear here.</p>
                )}
              </>
            )}
          </div>
        </section>

        <div className="profile-cols">
          {/* Skills */}
          <Reveal as="section" className="panel" aria-labelledby="skills-title">
            <h2 id="skills-title" className="panel-title">Skills</h2>
            {s.skills.length ? (
              <ul className="skills">
                {s.skills.map((sk) => (
                  <li key={sk.name} className="skill" tabIndex={0} aria-label={`${sk.name}: ${Math.round(sk.level * 100)}%, from ${sk.courses.join(', ')}`}>
                    <span className="skill-name">{sk.name}</span>
                    <span className="skill-bar"><span style={{ '--w': `${Math.max(2, sk.level * 100)}%` }} /></span>
                    <span className="skill-val mono">{Math.round(sk.level * 100)}%</span>
                    <span className="skill-tip" aria-hidden="true">from {sk.courses.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Enrol in a course to start building skills.</p>
            )}
          </Reveal>

          {/* Achievements */}
          <Reveal as="section" className="panel" aria-labelledby="awards-title" delay={80}>
            <div className="panel-head">
              <h2 id="awards-title" className="panel-title">Achievements</h2>
              <span className="mono muted">{unlocked} of {awards.length}</span>
            </div>
            <ul className="awards">
              {awards.map((a) => (
                <li key={a.id} className={`award ${a.done ? 'is-done' : 'is-locked'}`} tabIndex={0}>
                  <span className="award-icon" aria-hidden="true">{a.done ? <Award size={18} /> : <Lock size={14} />}</span>
                  <span className="award-title">{a.done ? a.title : 'Locked'}</span>
                  <span className="award-hint">{a.hint}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="profile-cols">
          {/* Journey */}
          <Reveal as="section" className="panel" aria-labelledby="journey-title">
            <h2 id="journey-title" className="panel-title">Journey</h2>
            {events.length ? (
              <ol className="journey">
                {events.map((e) => (
                  <li key={e.at + e.type}>
                    <span className="journey-dot" aria-hidden="true" />
                    <span className="journey-text">{EVENT_TEXT[e.type](e)}</span>
                    <time className="mono muted" dateTime={e.at}>{relativeTime(e.at)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Your enrolments, completed lessons and notes will build a timeline here.</p>
            )}
          </Reveal>

          {/* Certificates */}
          <Reveal as="section" className="panel" aria-labelledby="cert-title" delay={80}>
            <h2 id="cert-title" className="panel-title">Certificates</h2>
            {certificates.length ? (
              <ul className="certs">
                {certificates.map((p) => (
                  <li key={p.course.id} className="cert">
                    <CourseMark course={p.course} size={40} />
                    <div>
                      <div className="cert-title">{p.course.title}</div>
                      <div className="mono muted">Completed · {p.total} lessons</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : closest ? (
              <div className="cert-pending">
                <CourseMark course={closest.course} size={40} />
                <div>
                  <p>Your first certificate is closest in <strong>{closest.course.title}</strong>.</p>
                  <div className="meter"><span style={{ width: `${closest.percent}%` }} /></div>
                  <p className="mono muted">{closest.total - closest.completed} lessons to go</p>
                  <button className="btn btn-sm btn-secondary" onClick={() => navigateTo('tutor', { courseId: closest.course.id, lessonId: closest.current?.id })}>
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Complete every lesson of a course to earn its certificate.</p>
            )}
          </Reveal>
        </div>

        {/* Preferences */}
        <section className="prefs" aria-labelledby="prefs-title">
          <h2 id="prefs-title" className="panel-title">Preferences</h2>
          <div className="prefs-row">
            <div>
              <div className="prefs-label">Site theme</div>
              <div className="muted">Light or dark. The Tutor has its own switch.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
          <div className="prefs-row">
            <div>
              <div className="prefs-label">Learning data</div>
              <div className="muted">Clears this account's enrolments, progress, notes and activity in this browser.</div>
            </div>
            {confirmReset ? (
              <div className="prefs-confirm">
                <button className="btn btn-sm btn-danger" onClick={() => { setConfirmReset(false); setFinalReset(true); }}>Yes, reset</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset</button>
            )}
          </div>
          <div className="prefs-row">
            <div>
              <div className="prefs-label">Account</div>
              <div className="muted">Signed in as {profile.email}.</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={signOut}><LogOut size={14} /> Sign out</button>
          </div>
        </section>
      </div>

      <Modal open={finalReset} onClose={() => setFinalReset(false)} labelledBy="reset-title" className="confirm">
        <div className="confirm-body">
          <span className="confirm-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
          <h2 id="reset-title" className="confirm-title">Reset all learning data?</h2>
          <p className="confirm-text">This permanently deletes the following for <strong>{profile.email}</strong> on this browser:</p>
          <ul className="confirm-list">
            <li>All course enrolments ({purchasedCourseIds.length})</li>
            <li>Lesson progress, completed lessons and certificates</li>
            <li>Your notes, bookmarks and saved activity</li>
            <li>Code you wrote in lesson workspaces, and video positions</li>
            <li>Items in your cart</li>
          </ul>
          <p className="confirm-warn">This cannot be undone. Courses you bought will need to be enrolled in again. Your account and login stay as they are.</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={() => setFinalReset(false)} data-autofocus>Keep my data</button>
            <button className="btn btn-danger" onClick={() => { resetAllDemoData(); setFinalReset(false); }}>Delete permanently</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
