import React from 'react';

/** The Monklogy mark: an open ensō circle — one stroke, deliberately unfinished. */
export const LogoMark = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      d="M22.6 9.2A9 9 0 1 0 25 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const Logo = ({ size = 26 }) => (
  <span className="logo">
    <LogoMark size={size} className="logo-mark" />
    <span className="logo-word">Monklogy</span>
  </span>
);
