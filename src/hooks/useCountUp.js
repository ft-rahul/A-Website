import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './useMediaQuery';

/** Animates a number from its previous value to the new one. */
export const useCountUp = (value, duration = 700) => {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return undefined;
    }
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return shown;
};
