import { useEffect, useRef, useState } from 'react';

/**
 * Progress (0 → 1) of an element scrolling through the viewport, written to
 * a CSS custom property (--progress) on the element without re-rendering.
 * Optionally reports a discrete step to React when it changes.
 *
 * mode "through": 0 when the element's top reaches the top of the viewport,
 *                 1 when its bottom reaches the bottom (for sticky sections).
 * mode "pass":    0 when the element enters at the bottom, 1 when it leaves at the top.
 */
export const useScrollProgress = ({ mode = 'through', steps = 0, disabled = false } = {}) => {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return undefined;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      let p;
      if (mode === 'through') {
        const distance = rect.height - vh;
        p = distance > 0 ? -rect.top / distance : rect.top < 0 ? 1 : 0;
      } else {
        p = (vh - rect.top) / (vh + rect.height);
      }
      p = Math.min(1, Math.max(0, p));
      el.style.setProperty('--progress', p.toFixed(4));
      if (steps > 0) {
        const s = Math.min(steps - 1, Math.floor(p * steps));
        if (s !== stepRef.current) {
          stepRef.current = s;
          setStep(s);
        }
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mode, steps, disabled]);

  return { ref, step };
};
