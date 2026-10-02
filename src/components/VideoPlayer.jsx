import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw, Film, AlertTriangle,
  Settings2, Flag, PictureInPicture2, SkipForward, X, ArrowRight
} from 'lucide-react';
import { storage } from '../lib/storage';
import { getPlaybackPositions, savePlaybackPosition } from '../lib/userData';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIPS = [5, 10, 15, 30];
const COMPLETE_AT = 0.9;
const DOUBLE_TAP_MS = 280;
const DEFAULT_PREFS = { volume: 1, muted: false, rate: 1, skip: 10, loop: false, autoNext: true, showMarkers: true };

export const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return h ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const loadPositions = getPlaybackPositions;
const savePosition = savePlaybackPosition;

const Switch = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} className={`pset-switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
    <span>{label}</span>
    <i aria-hidden="true" />
  </button>
);

/**
 * Reusable lesson video player.
 *
 * Imperative handle: getTime(), seekTo(seconds, { play }), hasVideo()
 * Props:
 *  video        { url, type, fileName } | null
 *  storageKey   key for remembering the playback position
 *  markers      [{ id, time, kind: 'bookmark' | 'note', text }] shown on the timeline
 *  onTime       (seconds) — called about once a second while playing
 *  onComplete   called once when 90% has been watched
 *  onBookmark   (seconds) — B key / flag button
 *  onNote       (seconds) — N key
 *  next { title, number, duration, hasVideo, locked } + onNext — the animated Next controller
 *  startAt  seconds to start from (used when jumping to a note in another lesson)
 */
export const VideoPlayer = forwardRef(function VideoPlayer(
  { video, storageKey, title, markers = [], startAt, onTime, onComplete, onBookmark, onNote, next, onNext, emptyTitle, emptyText, emptyHint },
  ref
) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const hideTimer = useRef(0);
  const completedRef = useRef(false);
  const lastSaved = useRef(0);
  const lastReported = useRef(-1);

  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...storage.get('player_prefs', {}) }));
  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  useEffect(() => storage.set('player_prefs', prefs), [prefs]);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [resumedFrom, setResumedFrom] = useState(0);
  const [flash, setFlash] = useState(null);
  const [skipHint, setSkipHint] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const [hover, setHover] = useState(null);
  const [upNext, setUpNext] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const nextTitle = next?.title;

  // Animated hand-off to the next lesson
  const goNext = useCallback(() => {
    if (!onNext || leaving) return;
    setUpNext(null);
    videoRef.current?.pause();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { onNext(); return; }
    setLeaving(true);
    setTimeout(() => onNext(), 560);
  }, [onNext, leaving]);

  // ── Reset per video ───────────────────────────────────────
  // Layout effect + re-sync from the element: media events (loadedmetadata)
  // can fire before a normal effect runs, which used to wipe the duration and
  // leave the seek bar unusable.
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (!firstRender.current) {
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
      setBuffered([]);
      setError(false);
      setWaiting(false);
      setResumedFrom(0);
      setUpNext(null);
      setScrubTime(null);
      completedRef.current = false;
    }
    firstRender.current = false;
  }, [video?.url]);

  const syncFromElement = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    setCurrent(v.currentTime);
    setPlaying(!v.paused);
  }, []);
  useEffect(() => {
    syncFromElement();
    // Safety net: if metadata arrived before listeners mattered, pick it up.
    const t = setTimeout(syncFromElement, 400);
    return () => clearTimeout(t);
  }, [video?.url, syncFromElement]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = prefs.volume;
    v.muted = prefs.muted;
    v.playbackRate = prefs.rate;
    v.loop = prefs.loop;
  }, [prefs.volume, prefs.muted, prefs.rate, prefs.loop, video?.url]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => () => {
    const v = videoRef.current;
    if (v && v.currentTime > 3 && !completedRef.current) savePosition(storageKey, v.currentTime);
  }, [storageKey, video?.url]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // Close settings on outside click / Escape
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.pset, .pset-trigger')) setSettingsOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setSettingsOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  // "Up next" countdown
  useEffect(() => {
    if (!upNext) return undefined;
    if (upNext.left <= 0) {
      goNext();
      return undefined;
    }
    const t = setTimeout(() => setUpNext((u) => (u ? { left: u.left - 1 } : u)), 1000);
    return () => clearTimeout(t);
  }, [upNext, goNext]);

  // ── Helpers ───────────────────────────────────────────────
  const showFlash = (text) => setFlash({ text, id: Date.now() + Math.random() });

  const poke = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setUpNext(null);
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => setPlaying(false));
    } else v.pause();
  }, []);

  const seekTo = useCallback((t, { play = false, fast = false } = {}) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    const target = clamp(t, 0, v.duration - 0.05);
    if (fast && typeof v.fastSeek === 'function') v.fastSeek(target);
    else v.currentTime = target;
    setCurrent(target);
    if (play && v.paused) v.play().catch(() => {});
  }, []);

  const skip = useCallback((dir, amount = prefs.skip) => {
    const v = videoRef.current;
    if (!v) return;
    seekTo(v.currentTime + dir * amount);
  }, [prefs.skip, seekTo]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }, []);

  const togglePip = async () => {
    const v = videoRef.current;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v?.requestPictureInPicture?.();
    } catch {
      showFlash('Picture-in-picture unavailable');
    }
  };

  const changeVolume = (val) => {
    const next = clamp(val, 0, 1);
    setPrefs((p) => ({ ...p, volume: next, muted: next === 0 }));
  };

  const bookmark = () => {
    const v = videoRef.current;
    if (!v || !onBookmark) return;
    onBookmark(v.currentTime);
    showFlash(`Bookmarked ${fmt(v.currentTime)}`);
  };

  useImperativeHandle(ref, () => ({
    getTime: () => (videoRef.current && Number.isFinite(videoRef.current.duration) ? videoRef.current.currentTime : null),
    seekTo,
    hasVideo: () => Boolean(video)
  }), [seekTo, video]);

  // ── Scrubber (custom, so dragging never fights timeupdate) ─
  const dragging = useRef(false);
  const pendingSeek = useRef(null);
  const seekFrame = useRef(0);
  const liveDuration = () => {
    const d = videoRef.current?.duration;
    return Number.isFinite(d) && d > 0 ? d : duration;
  };
  const timeAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return { time: clamp((clientX - r.left) / r.width, 0, 1) * liveDuration(), x: clamp(clientX - r.left, 0, r.width) };
  };
  const queueSeek = (t) => {
    pendingSeek.current = t;
    if (!seekFrame.current) {
      seekFrame.current = requestAnimationFrame(() => {
        seekFrame.current = 0;
        if (pendingSeek.current != null) seekTo(pendingSeek.current, { fast: true });
      });
    }
  };
  const onScrubDown = (e) => {
    if (!liveDuration() || e.button > 0) return;
    if (!duration) setDuration(liveDuration());
    e.preventDefault();
    trackRef.current.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    const { time } = timeAt(e.clientX);
    setScrubTime(time);
    queueSeek(time);
  };
  const onScrubMove = (e) => {
    if (!liveDuration()) return;
    const { time, x } = timeAt(e.clientX);
    setHover({ time, x });
    if (dragging.current) {
      setScrubTime(time);
      queueSeek(time);
    }
  };
  const onScrubUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    const { time } = timeAt(e.clientX);
    cancelAnimationFrame(seekFrame.current);
    seekFrame.current = 0;
    seekTo(time);
    setScrubTime(null);
    if (e.pointerType !== 'mouse') setHover(null);
  };
  const onScrubKey = (e) => {
    const map = { ArrowLeft: -5, ArrowRight: 5, PageDown: -prefs.skip * 3, PageUp: prefs.skip * 3 };
    if (map[e.key] !== undefined) {
      e.preventDefault();
      e.stopPropagation();
      skip(1, map[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo(duration - 1);
    }
  };

  // ── Gestures on the video surface ─────────────────────────
  const tap = useRef({ last: 0, side: null, count: 0, timer: 0 });
  const swipe = useRef(null);
  const sideOf = (clientX) => {
    const r = wrapRef.current.getBoundingClientRect();
    const k = (clientX - r.left) / r.width;
    return k < 0.33 ? 'left' : k > 0.67 ? 'right' : 'center';
  };
  const showSkip = (side, amount) => setSkipHint({ side, amount, id: Date.now() });

  const onSurfaceDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY, type: e.pointerType, start: videoRef.current?.currentTime || 0, active: false, target: null };
  };
  const onSurfaceMove = (e) => {
    const s = swipe.current;
    if (!s || s.type === 'mouse' || !liveDuration()) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.active && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      s.active = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (s.active) {
      const d = liveDuration();
      const width = wrapRef.current.getBoundingClientRect().width;
      const range = Math.min(d, 180);
      s.target = clamp(s.start + (dx / width) * range, 0, d);
      const delta = s.target - s.start;
      setFlash({ text: `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}  →  ${fmt(s.target)}`, id: 'swipe' });
      setScrubTime(s.target);
    }
  };
  const onSurfaceUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (s?.active) {
      seekTo(s.target);
      setScrubTime(null);
      return;
    }
    const side = sideOf(e.clientX);
    const now = Date.now();
    const t = tap.current;
    const isDouble = now - t.last < DOUBLE_TAP_MS && t.side === side;
    t.last = now;
    t.side = side;
    clearTimeout(t.timer);

    if (isDouble) {
      t.count += 1;
      if (side === 'center') {
        if (e.pointerType === 'mouse') {
          toggle(); // undo the single-click toggle
          toggleFullscreen();
        }
        return;
      }
      if (t.count === 1 && e.pointerType === 'mouse') toggle(); // undo first click's toggle
      const dir = side === 'left' ? -1 : 1;
      skip(dir);
      showSkip(side, prefs.skip * t.count);
      return;
    }
    t.count = 0;
    if (e.pointerType === 'mouse') {
      toggle();
    } else {
      // Touch: a single tap reveals controls (or plays when paused)
      t.timer = setTimeout(() => {
        if (videoRef.current?.paused) toggle();
        else if (controlsVisible) toggle();
        poke();
      }, DOUBLE_TAP_MS);
    }
  };

  // ── Keyboard ──────────────────────────────────────────────
  const onKeyDown = (e) => {
    if (e.target.closest?.('.pset') || e.target.getAttribute?.('role') === 'slider' || e.target.type === 'range') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const actions = {
      ' ': toggle,
      k: toggle,
      K: toggle,
      j: () => { skip(-1); showSkip('left', prefs.skip); },
      l: () => { skip(1); showSkip('right', prefs.skip); },
      ArrowLeft: () => { skip(-1, 5); showSkip('left', 5); },
      ArrowRight: () => { skip(1, 5); showSkip('right', 5); },
      ArrowUp: () => { changeVolume(prefs.volume + 0.1); showFlash(`Volume ${Math.round(clamp(prefs.volume + 0.1, 0, 1) * 100)}%`); },
      ArrowDown: () => { changeVolume(prefs.volume - 0.1); showFlash(`Volume ${Math.round(clamp(prefs.volume - 0.1, 0, 1) * 100)}%`); },
      m: () => setPref('muted', !prefs.muted),
      f: toggleFullscreen,
      N: () => goNext(),
      b: bookmark,
      n: () => videoRef.current && onNote?.(videoRef.current.currentTime),
      '>': () => { const r = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(prefs.rate) + 1)]; setPref('rate', r); showFlash(`${r}×`); },
      '<': () => { const r = SPEEDS[Math.max(0, SPEEDS.indexOf(prefs.rate) - 1)]; setPref('rate', r); showFlash(`${r}×`); },
      ',': () => videoRef.current?.paused && seekTo(videoRef.current.currentTime - 1 / 30),
      '.': () => videoRef.current?.paused && seekTo(videoRef.current.currentTime + 1 / 30)
    }[k];
    if (actions && !(k === ' ' && e.target.tagName === 'BUTTON')) {
      e.preventDefault();
      actions();
      poke();
    } else if (/^[0-9]$/.test(k) && duration) {
      e.preventDefault();
      seekTo((Number(k) / 10) * duration);
    }
  };

  // ── Empty state ───────────────────────────────────────────
  if (!video) {
    return (
      <div className="player player-empty">
        <div className="player-empty-inner">
          <Film size={28} aria-hidden="true" />
          <h3>{emptyTitle || 'Video not available yet'}</h3>
          {emptyText && <p>{emptyText}</p>}
          {emptyHint && <p className="player-dev-hint mono">{emptyHint}</p>}
          {next && onNext && (
            <button className="btn btn-secondary btn-sm empty-next" onClick={onNext}>
              Next: {next.title} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const shown = scrubTime ?? current;
  const pct = duration ? (shown / duration) * 100 : 0;
  const nearMarker = hover && duration ? markers.find((m) => Math.abs(m.time - hover.time) < duration * 0.012) : null;
  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled;

  return (
    <div
      ref={wrapRef}
      className={`player ${leaving ? 'is-leaving' : ''} ${playing ? 'is-playing' : 'is-paused'} ${controlsVisible || !playing || settingsOpen ? 'show-controls' : ''} ${scrubTime != null ? 'is-scrubbing' : ''}`}
      onMouseMove={poke}
      onMouseLeave={() => { if (playing && !settingsOpen) setControlsVisible(false); setHover(null); }}
      onKeyDown={onKeyDown}
      role="region"
      tabIndex={0}
      aria-label={`Video player: ${title}. Space plays or pauses, J and L skip, B adds a bookmark, N writes a note, F is full screen.`}
    >
      <video
        key={video.url}
        ref={videoRef}
        className="player-video"
        preload="metadata"
        playsInline
        onPlay={() => { setPlaying(true); setUpNext(null); poke(); }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          const v = videoRef.current;
          if (v && v.currentTime > 3 && !completedRef.current) savePosition(storageKey, v.currentTime);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onSeeked={() => setWaiting(false)}
        onError={() => setError(true)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          v.volume = prefs.volume;
          v.muted = prefs.muted;
          v.playbackRate = prefs.rate;
          v.loop = prefs.loop;
          const saved = loadPositions()[storageKey];
          if (startAt != null && startAt < v.duration) {
            v.currentTime = startAt;
            setCurrent(startAt);
            v.play().catch(() => {});
          } else if (saved && saved < v.duration - 5) {
            v.currentTime = saved;
            setCurrent(saved);
            setResumedFrom(saved);
          }
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (!v.duration) return;
          const ranges = [];
          for (let i = 0; i < v.buffered.length; i++) ranges.push([v.buffered.start(i) / v.duration, v.buffered.end(i) / v.duration]);
          setBuffered(ranges);
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!dragging.current) setCurrent(v.currentTime);
          const sec = Math.floor(v.currentTime);
          if (sec !== lastReported.current) {
            lastReported.current = sec;
            onTime?.(v.currentTime);
          }
          if (Math.abs(v.currentTime - lastSaved.current) > 5) {
            lastSaved.current = v.currentTime;
            if (!completedRef.current) savePosition(storageKey, v.currentTime);
          }
          if (!completedRef.current && v.duration && v.currentTime / v.duration >= COMPLETE_AT) {
            completedRef.current = true;
            savePosition(storageKey, null);
            onComplete?.();
          }
        }}
        onEnded={() => {
          setPlaying(false);
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          savePosition(storageKey, null);
          if (prefs.autoNext && onNext && !prefs.loop) setUpNext({ left: 5 });
        }}
      >
        <source src={video.url} type={video.type} />
      </video>

      {/* Gesture surface: tap, double-tap sides to skip, swipe to scrub */}
      <div
        className="player-surface"
        onPointerDown={onSurfaceDown}
        onPointerMove={onSurfaceMove}
        onPointerUp={onSurfaceUp}
        onPointerCancel={() => { swipe.current = null; setScrubTime(null); }}
        aria-hidden="true"
      />

      {skipHint && (
        <div key={skipHint.id} className={`player-skip is-${skipHint.side}`} aria-hidden="true" onAnimationEnd={() => setSkipHint(null)}>
          <span className="player-skip-arrows">{skipHint.side === 'left' ? '‹‹‹' : '›››'}</span>
          <span className="mono">{skipHint.amount}s</span>
        </div>
      )}

      {error && (
        <div className="player-error" role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <p>This video could not be played. Your browser may not support the file format of “{video.fileName}”.</p>
        </div>
      )}

      {!error && !playing && !upNext && scrubTime == null && (
        <button className="player-bigplay" onClick={toggle} aria-label={resumedFrom ? `Resume from ${fmt(resumedFrom)}` : 'Play'}>
          <Play size={26} fill="currentColor" />
          {resumedFrom > 0 && Math.abs(current - resumedFrom) < 1 && <span className="player-resume mono">Resume {fmt(resumedFrom)}</span>}
        </button>
      )}

      {upNext && (
        <div className="player-upnext" role="status">
          <div className="upnext-top">
            <svg className="upnext-ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" className="upnext-ring-track" />
              <circle cx="18" cy="18" r="15" className="upnext-ring-fill" />
            </svg>
            <span className="upnext-num mono">{upNext.left}</span>
            <div>
              <span className="mono player-upnext-k">Up next · section {next?.number}</span>
              <strong>{nextTitle}</strong>
            </div>
          </div>
          <div className="player-upnext-actions">
            <button className="btn btn-accent btn-sm" onClick={goNext}><SkipForward size={14} /> Play now</button>
            <button className="btn btn-sm player-upnext-cancel" onClick={() => setUpNext(null)}>Cancel</button>
          </div>
        </div>
      )}

      {waiting && playing && <div className="player-spinner" aria-hidden="true" />}
      {leaving && (
        <div className="player-leave" aria-hidden="true">
          <span className="player-leave-k mono">Next · section {next?.number}</span>
          <span className="player-leave-title">{nextTitle}</span>
        </div>
      )}
      {flash && (
        <div key={flash.id} className="player-flash mono" aria-hidden="true" onAnimationEnd={() => setFlash(null)}>
          {flash.text}
        </div>
      )}

      <div className="player-controls">
        <div
          ref={trackRef}
          className="scrub"
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(shown)}
          aria-valuetext={`${fmt(shown)} of ${fmt(duration)}`}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          onPointerLeave={() => !dragging.current && setHover(null)}
          onKeyDown={onScrubKey}
        >
          <div className="scrub-rail">
            {buffered.map(([s, e], i) => (
              <span key={i} className="scrub-buf" style={{ left: `${s * 100}%`, width: `${(e - s) * 100}%` }} />
            ))}
            {hover && <span className="scrub-hover" style={{ width: `${(hover.time / duration) * 100}%` }} />}
            <span className="scrub-fill" style={{ width: `${pct}%` }} />
          </div>
          {prefs.showMarkers && duration > 0 && markers.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`scrub-marker is-${m.kind}`}
              style={{ left: `${(m.time / duration) * 100}%` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); seekTo(m.time, { play: true }); }}
              aria-label={`${m.kind === 'bookmark' ? 'Bookmark' : 'Note'} at ${fmt(m.time)}${m.text ? `: ${m.text}` : ''}`}
              tabIndex={-1}
            />
          ))}
          <span className="scrub-thumb" style={{ left: `${pct}%` }} aria-hidden="true" />
          {hover && (
            <span className="scrub-tip mono" style={{ left: `${hover.x}px` }} aria-hidden="true">
              {nearMarker ? (
                <><Flag size={11} /> {nearMarker.text ? nearMarker.text.slice(0, 40) : fmt(nearMarker.time)}<br /></>
              ) : null}
              {fmt(dragging.current ? scrubTime ?? hover.time : hover.time)}
            </span>
          )}
        </div>

        <div className="player-row">
          <div className="player-group">
            <button className="player-btn" onClick={toggle} aria-label={playing ? 'Pause (K)' : 'Play (K)'}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button className="player-btn player-skipbtn" onClick={() => { skip(-1); showSkip('left', prefs.skip); }} aria-label={`Back ${prefs.skip} seconds (J)`}>
              <RotateCcw size={16} /><span className="mono">{prefs.skip}</span>
            </button>
            <button className="player-btn player-skipbtn" onClick={() => { skip(1); showSkip('right', prefs.skip); }} aria-label={`Forward ${prefs.skip} seconds (L)`}>
              <RotateCw size={16} /><span className="mono">{prefs.skip}</span>
            </button>
            <div className="player-volume">
              <button className="player-btn" onClick={() => setPref('muted', !prefs.muted)} aria-label={prefs.muted ? 'Unmute (M)' : 'Mute (M)'}>
                {prefs.muted || prefs.volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={prefs.muted ? 0 : prefs.volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Volume" />
            </div>
            <span className="player-time mono" aria-hidden="true">
              {fmt(shown)} <span className="player-time-sep">/</span> {fmt(duration)}
            </span>
          </div>

          <div className="player-group">
            {next && (
              <div className={`pnext ${next.locked ? 'is-locked' : ''}`}>
                <button className="player-btn pnext-btn" onClick={goNext} disabled={!onNext} aria-label={next.locked ? `Next lesson is locked: ${next.title}` : `Next lesson (Shift+N): ${next.title}`}>
                  <span className="pnext-label">Next</span>
                  <SkipForward size={16} className="pnext-icon" />
                </button>
                <div className="pnext-card" aria-hidden="true">
                  <span className="pnext-k mono">Up next · section {next.number}</span>
                  <strong className="pnext-title">{next.title}</strong>
                  <span className="pnext-meta mono">{next.duration}{next.hasVideo ? ' · video' : ''}{next.locked ? ' · enrol to unlock' : ''}</span>
                  <i className="pnext-bar" />
                </div>
              </div>
            )}
            {onBookmark && (
              <button className="player-btn" onClick={bookmark} aria-label="Bookmark this moment (B)" title="Bookmark this moment (B)">
                <Flag size={16} />
              </button>
            )}
            <button
              className={`player-btn pset-trigger ${settingsOpen ? 'is-on' : ''}`}
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Player settings"
              aria-expanded={settingsOpen}
              title="Settings"
            >
              <Settings2 size={17} />
              {prefs.rate !== 1 && <span className="player-rate-badge mono">{prefs.rate}×</span>}
            </button>
            {pipSupported && (
              <button className="player-btn hide-narrow" onClick={togglePip} aria-label="Picture in picture" title="Picture in picture">
                <PictureInPicture2 size={16} />
              </button>
            )}
            <button className="player-btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}>
              {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="pset" role="dialog" aria-label="Player settings">
          <div className="pset-head">
            <span>Player settings</span>
            <button className="player-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={15} /></button>
          </div>
          <div className="pset-group">
            <span className="pset-label">Speed</span>
            <div className="pset-chips">
              {SPEEDS.map((s) => (
                <button key={s} className={`pset-chip mono ${prefs.rate === s ? 'is-on' : ''}`} onClick={() => setPref('rate', s)} aria-pressed={prefs.rate === s}>{s}×</button>
              ))}
            </div>
          </div>
          <div className="pset-group">
            <span className="pset-label">Skip length</span>
            <div className="pset-chips">
              {SKIPS.map((s) => (
                <button key={s} className={`pset-chip mono ${prefs.skip === s ? 'is-on' : ''}`} onClick={() => setPref('skip', s)} aria-pressed={prefs.skip === s}>{s}s</button>
              ))}
            </div>
          </div>
          <div className="pset-group">
            <Switch checked={prefs.autoNext} onChange={(v) => setPref('autoNext', v)} label="Autoplay next lesson" />
            <Switch checked={prefs.loop} onChange={(v) => setPref('loop', v)} label="Loop this video" />
            <Switch checked={prefs.showMarkers} onChange={(v) => setPref('showMarkers', v)} label="Show bookmarks on timeline" />
          </div>
          <details className="pset-keys">
            <summary>Keyboard and gestures</summary>
            <dl>
              <div><dt><kbd>Space</kbd> <kbd>K</kbd></dt><dd>Play / pause</dd></div>
              <div><dt><kbd>J</kbd> <kbd>L</kbd></dt><dd>Skip {prefs.skip}s</dd></div>
              <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Skip 5s</dd></div>
              <div><dt><kbd>B</kbd></dt><dd>Bookmark moment</dd></div>
              <div><dt><kbd>N</kbd></dt><dd>Note at this time</dd></div>
              <div><dt><kbd>&lt;</kbd> <kbd>&gt;</kbd></dt><dd>Speed</dd></div>
              <div><dt><kbd>,</kbd> <kbd>.</kbd></dt><dd>Frame step (paused)</dd></div>
              <div><dt><kbd>0</kbd>–<kbd>9</kbd></dt><dd>Jump to 0–90%</dd></div>
              <div><dt><kbd>F</kbd></dt><dd>Full screen</dd></div>
              <div><dt><kbd>Shift</kbd> <kbd>N</kbd></dt><dd>Next lesson</dd></div>
              <div><dt>Double-tap sides</dt><dd>Skip back / forward</dd></div>
              <div><dt>Swipe sideways</dt><dd>Scrub (touch)</dd></div>
            </dl>
          </details>
        </div>
      )}
    </div>
  );
});
