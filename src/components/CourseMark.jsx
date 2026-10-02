import React from 'react';

/*
 * Generated course artwork. One geometric motif per category, drawn in ink
 * with a single accent stroke, so the catalog stays visually coherent.
 */
const MOTIFS = {
  'Full-Stack': (
    <>
      <rect x="14" y="16" width="36" height="8" rx="1" />
      <rect x="14" y="28" width="36" height="8" rx="1" />
      <rect x="14" y="40" width="36" height="8" rx="1" className="cm-accent-fill" />
    </>
  ),
  Frontend: (
    <>
      <rect x="12" y="14" width="40" height="36" rx="2" />
      <path d="M12 22h40" />
      <rect x="18" y="28" width="12" height="16" className="cm-accent" />
      <path d="M34 30h12M34 36h12M34 42h8" />
    </>
  ),
  Backend: (
    <>
      <circle cx="18" cy="32" r="5" />
      <circle cx="46" cy="18" r="5" />
      <circle cx="46" cy="46" r="5" className="cm-accent" />
      <path d="M23 30l18-10M23 34l18 10" />
    </>
  ),
  DevOps: (
    <>
      <path d="M32 32c-6-8-18-8-18 0s12 8 18 0" />
      <path d="M32 32c6 8 18 8 18 0s-12-8-18 0" className="cm-accent" />
    </>
  ),
  Languages: (
    <>
      <path d="M24 16c-6 0-6 4-6 8s-4 8-4 8 4 0 4 8 0 8 6 8" />
      <path d="M40 16c6 0 6 4 6 8s4 8 4 8-4 0-4 8 0 8-6 8" />
      <path d="M27 32h10M33 28l4 4-4 4" className="cm-accent" />
    </>
  ),
  Tools: (
    <>
      <path d="M16 22l8 8-8 8" />
      <path d="M28 40h20" className="cm-accent" />
    </>
  )
};

export const CourseMark = ({ course, size = 64, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={`course-mark ${className}`}
    aria-hidden="true"
  >
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {MOTIFS[course?.category] || MOTIFS.Tools}
    </g>
  </svg>
);
