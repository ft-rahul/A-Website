import { useEffect, useState } from 'react';

export const useMediaQuery = (query) => {
  const get = () => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia(query);
    } catch {
      return undefined;
    }
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
