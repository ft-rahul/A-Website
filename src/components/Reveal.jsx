import React, { useEffect, useRef } from 'react';

/**
 * Fades and lifts its content in the first time it enters the viewport.
 * With reduced motion the CSS shows content immediately.
 */
export const Reveal = ({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-revealed');
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-revealed');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
};
