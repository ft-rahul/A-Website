import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';

/*
 * The Lobby's interactive centrepiece: a field of particles that assembles
 * into technical symbols and morphs between them —
 *   </>  markup · { }  logic · chip  hardware · >_  terminal · branch  version control
 * The pointer gently pushes nearby dots aside (no connecting lines). After 2 s
 * without cursor movement the push switches off and the dots settle back into
 * the pose; moving again re-enables it. The symbols keep morphing on their own,
 * and a click jumps to the next one.
 * Scrolling down streams the dots out into the page step by step; scrolling back
 * up gathers them home step by step, and at the top the symbol morphs again. Pauses off-screen and when the
 * tab is hidden; renders one static frame with reduced motion.
 */

const HOLD_MS = 3800;
const GLYPHS = ['{', '}', '<', '/>', '=>', ';', '()', '01', '&&', '#'];
const SAMPLE = 320;

const SHAPES = [
  { name: 'markup', text: '</>' },
  { name: 'logic', text: '{ }' },
  {
    name: 'hardware',
    draw: (x, s) => {
      x.lineWidth = s * 0.045;
      x.lineCap = 'round';
      x.strokeRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
      x.fillRect(s * 0.42, s * 0.42, s * 0.16, s * 0.16);
      for (let i = 0; i < 4; i++) {
        const p = s * (0.36 + i * 0.093);
        [[p, s * 0.3, p, s * 0.18], [p, s * 0.7, p, s * 0.82], [s * 0.3, p, s * 0.18, p], [s * 0.7, p, s * 0.82, p]].forEach(([a, b, c, d]) => {
          x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke();
        });
      }
    }
  },
  { name: 'terminal', text: '>_' },
  {
    name: 'version control',
    draw: (x, s) => {
      x.lineWidth = s * 0.04;
      x.lineCap = 'round';
      const dot = (cx, cy) => { x.beginPath(); x.arc(cx, cy, s * 0.065, 0, Math.PI * 2); x.stroke(); };
      x.beginPath(); x.moveTo(s * 0.36, s * 0.27); x.lineTo(s * 0.36, s * 0.73); x.stroke();
      x.beginPath(); x.moveTo(s * 0.64, s * 0.33); x.bezierCurveTo(s * 0.64, s * 0.55, s * 0.36, s * 0.5, s * 0.36, s * 0.66); x.stroke();
      dot(s * 0.36, s * 0.2); dot(s * 0.36, s * 0.8); dot(s * 0.64, s * 0.27);
    }
  }
];

const sampleShape = (shape, count, monoFamily) => {
  const c = document.createElement('canvas');
  c.width = c.height = SAMPLE;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return [];
  x.fillStyle = '#000';
  x.strokeStyle = '#000';
  if (shape.text) {
    x.font = `700 ${SAMPLE * (shape.text.length > 2 ? 0.34 : 0.44)}px ${monoFamily}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(shape.text, SAMPLE / 2, SAMPLE / 2);
  } else {
    shape.draw(x, SAMPLE);
  }
  const data = x.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const pts = [];
  for (let y = 0; y < SAMPLE; y += 2) {
    for (let xx = 0; xx < SAMPLE; xx += 2) {
      if (data[(y * SAMPLE + xx) * 4 + 3] > 120) pts.push([xx / SAMPLE - 0.5, y / SAMPLE - 0.5]);
    }
  }
  if (!pts.length) return [];
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return Array.from({ length: count }, (_, i) => {
    const [px, py] = pts[i % pts.length];
    const jitter = i >= pts.length ? 0.006 : 0;
    return [px + (Math.random() - 0.5) * jitter, py + (Math.random() - 0.5) * jitter];
  });
};

export const TechMorph = ({ className = '', scene = false, sceneRef = null }) => {
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!ctx || typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;

    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        ink: s.getPropertyValue('--text-primary').trim() || '#141413',
        accent: s.getPropertyValue('--brand-primary').trim() || '#c65a12',
        mono: s.getPropertyValue('--font-mono').trim() || 'monospace'
      };
    };
    let colors = readColors();
    let width = 0;
    let height = 0;
    let particles = [];
    let targets = [];
    let shapeIndex = 0;
    let lastSwitch = 0;
    let frame = 0;
    let visible = true;
    let time = 0;
    let disposed = false;
    const pointer = { x: 0, y: 0, active: false, lastMove: 0 };
    const IDLE_MS = 2000;
    const ripples = [];
    const COUNT = () => Math.round(Math.min(1500, Math.max(600, (width * height) / 230)));

    const setLabel = () => {
      if (labelRef.current) labelRef.current.textContent = `${String(shapeIndex + 1).padStart(2, '0')} / ${SHAPES[shapeIndex].name}`;
      canvas.dataset.shape = SHAPES[shapeIndex].name;
    };

    const buildTargets = () => {
      targets = SHAPES.map((sh) => sampleShape(sh, particles.length, colors.mono));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = COUNT();
      if (particles.length !== n) {
        particles = Array.from({ length: n }, (_, i) => ({
          x: width / 2 + (Math.random() - 0.5) * width,
          y: height / 2 + (Math.random() - 0.5) * height,
          vx: 0,
          vy: 0,
          size: Math.random() < 0.88 ? 1.3 + Math.random() * 1.2 : 2.6,
          accent: Math.random() < 0.09,
          glyph: i % 41 === 0 ? GLYPHS[i % GLYPHS.length] : null,
          alpha: 0.45 + Math.random() * 0.55,
          phase: Math.random() * Math.PI * 2,
          delay: Math.random(), // when this particle leaves the symbol
          keep: Math.random(), // decides which dots stay visible once spread out
          bgX: Math.random(), // resting place when spread across the background
          bgY: Math.random()
        }));
        buildTargets();
      }
    };

    const scrollScatter = () => {
      if (scene) return 0;
      const rect = canvas.getBoundingClientRect();
      return Math.min(1, (Math.max(0, -rect.top) / Math.max(1, rect.height)) * 1.4);
    };

    // Scene mode (desktop Lobby), scroll-driven background — follows the scroll both ways:
    //  • from the very first scroll step down, dots start leaving the symbol
    //  • every further step releases more — no pauses, no sudden jumps; at the bottom
    //    of the page they are spread everywhere
    //  • every step back up gathers some home again; at the top the symbol is whole
    //    and morphing again
    //  • spread dots are thinned out and faint so they never compete with the content
    const START_AT = 8; // ignore sub-pixel / rubber-band scroll at the top
    const CURVE = 0.55; // < 1: early steps move visibly, later steps keep adding
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 60;
    const scrollLevel = () => {
      const y = window.scrollY - START_AT;
      if (y <= 0) return 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight - START_AT);
      return Math.pow(Math.min(1, y / max), CURVE);
    };
    let spreadSmooth = scene ? scrollLevel() : 0;
    const sceneSpread = () => {
      if (!scene) return 0;
      const level = scrollLevel();
      // ease toward the scroll position so each step glides rather than snaps
      spreadSmooth += (level - spreadSmooth) * 0.07;
      if (Math.abs(level - spreadSmooth) < 0.0005) spreadSmooth = level;
      return spreadSmooth;
    };

    const anchor = () => {
      if (scene && sceneRef?.current) {
        // the canvas is fixed to the viewport; the symbol follows the hero's visual area
        const r = sceneRef.current.getBoundingClientRect();
        return { cx: r.left + r.width * 0.74, cy: r.top + r.height * 0.5, s: Math.min(r.width * 0.4, r.height * 0.82) };
      }
      return { cx: width / 2, cy: height / 2, s: Math.min(width, height) * 0.95 };
    };

    const targetFor = (i, scatter, spread = 0) => {
      const t = targets[shapeIndex]?.[i];
      const p = particles[i];
      const a = anchor();
      if (!t) return { x: a.cx, y: a.cy };
      const s = a.s * (1 + scatter * 0.8);
      const breathe = Math.sin(time * 0.0012 + p.phase) * 1.2;
      const home = { x: a.cx + t[0] * s + breathe, y: a.cy + t[1] * s + breathe * 0.6 };
      if (spread <= 0.001) return home;
      const smooth = (k) => k * k * (3 - 2 * k);
      const drift = Math.sin(time * 0.0005 + p.phase) * 8;
      // staggered: each dot leaves at its own moment, straight into the background
      const k = smooth(Math.min(1, Math.max(0, spread * 1.45 - p.delay * 0.45)));
      const bg = { x: p.bgX * width + drift * 0.6, y: navH + p.bgY * (height - navH) + drift };
      return { x: home.x + (bg.x - home.x) * k, y: home.y + (bg.y - home.y) * k };
    };

    const draw = (scatter, spread = 0) => {
      // Spread across the page, only a share of the dots stays visible, small and faint,
      // so headings and text above them stay calm and readable.
      const bgShare = scene ? Math.min(1, spread) : 0;
      const keepFrac = 1 - bgShare * 0.62;
      const dim = 1 - bgShare * 0.6;
      ctx.clearRect(0, 0, width, height);
      const fade = 1 - scatter;
      if (fade <= 0.01) return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `11px ${colors.mono}`;
      for (const p of particles) {
        const thin = Math.min(1, Math.max(0, (keepFrac - p.keep) * 12));
        if (thin <= 0.01) continue;
        ctx.globalAlpha = p.alpha * fade * thin * dim;
        ctx.fillStyle = p.accent ? colors.accent : colors.ink;
        if (p.glyph && bgShare < 0.2) ctx.fillText(p.glyph, p.x, p.y);
        else {
          const sz = p.size * (1 - bgShare * 0.3);
          ctx.fillRect(p.x, p.y, sz, sz);
        }
      }
      ctx.globalAlpha = 1;
    };

    const nextShape = () => {
      shapeIndex = (shapeIndex + 1) % SHAPES.length;
      lastSwitch = time;
      setLabel();
      // a small outward kick makes each morph feel alive
      particles.forEach((p) => {
        p.vx += (Math.random() - 0.5) * 4;
        p.vy += (Math.random() - 0.5) * 4;
      });
    };

    const step = (now) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const dt = Math.min(48, now - (time || now));
      time = now;
      if (!lastSwitch) lastSwitch = now;
      const spread = sceneSpread();
      // repel is live only while the cursor has moved in the last 2 s
      const repelOn = pointer.active && performance.now() - pointer.lastMove < IDLE_MS;
      if (spread > 0.02) lastSwitch = now; // hold the pose while the dots are out in the page
      else if (now - lastSwitch > HOLD_MS) nextShape();
      if (labelRef.current) labelRef.current.style.opacity = String(1 - Math.min(1, spread * 2));
      const scatter = scrollScatter();
      // minimal, local push; even softer once the dots sit behind the page content
      const push = Math.max(60, Math.min(width, height) * 0.08) * (spread > 0.05 ? 0.7 : 1);
      const pushForce = spread > 0.05 ? 0.7 : 1.3;

      particles.forEach((p, i) => {
        const h = targetFor(i, scatter, spread);
        p.vx += (h.x - p.x) * 0.018;
        p.vy += (h.y - p.y) * 0.018;
        if (repelOn) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < push * push && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / push) * pushForce; // gentle, straight-out push
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        for (const rp of ripples) {
          const dx = p.x - rp.x;
          const dy = p.y - rp.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const band = Math.abs(d - rp.radius);
          if (band < 28) {
            const f = (1 - band / 28) * 2 * rp.strength;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.84;
        p.vy *= 0.84;
        p.x += p.vx;
        p.y += p.vy;
      });
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].radius += dt * 0.6;
        ripples[i].strength *= 0.96;
        if (ripples[i].strength < 0.05) ripples.splice(i, 1);
      }
      draw(scatter, spread);
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (!frame && !reduced && !disposed) frame = requestAnimationFrame(step);
    };

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    };
    const onMove = (e) => {
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.active = p.inside;
      pointer.lastMove = performance.now();
    };
    const onLeave = () => { pointer.active = false; };
    // While scrolling no pointermove fires, so the stored position is stale: release it.
    const onScroll = () => { pointer.active = false; };
    const onDown = (e) => {
      const p = local(e);
      if (!p.inside || e.target.closest?.('a, button, input, textarea, select, label')) return;
      if (scene) {
        // in the full-page layer, clicks only morph the symbol while it is formed in the hero
        if (spreadSmooth > 0.05 || !sceneRef?.current) return;
        const r = sceneRef.current.getBoundingClientRect();
        if (e.clientX < r.left + r.width * 0.5 || e.clientY < r.top || e.clientY > r.bottom) return;
      }
      ripples.push({ x: p.x, y: p.y, radius: 0, strength: 1 });
      nextShape();
    };

    const settleStatic = () => {
      particles.forEach((p, i) => {
        const h = targetFor(i, 0);
        p.x = h.x;
        p.y = h.y;
      });
      draw(0);
    };

    const init = async () => {
      try {
        await document.fonts?.load(`700 64px ${colors.mono}`);
      } catch { /* fall back to whatever is available */ }
      if (disposed) return;
      resize();
      setLabel();
      if (reduced) settleStatic();
      else start();
    };
    init();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) settleStatic();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { time = 0; lastSwitch = 0; start(); }
    });
    io.observe(canvas);
    const onVisibility = () => { if (!document.hidden) { time = 0; lastSwitch = 0; start(); } };
    document.addEventListener('visibilitychange', onVisibility);
    const mo = new MutationObserver(() => {
      const prevMono = colors.mono;
      colors = readColors();
      if (colors.mono !== prevMono) buildTargets();
      if (reduced) settleStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('pointerleave', onLeave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced, scene, sceneRef]);

  const canvasEl = <canvas ref={canvasRef} className={`enso-field ${scene ? 'is-fixed' : ''} ${className}`} aria-hidden="true" />;
  return (
    <>
      {scene ? createPortal(canvasEl, document.body) : canvasEl}
      <span ref={labelRef} className="morph-label mono" aria-hidden="true" />
    </>
  );
};
