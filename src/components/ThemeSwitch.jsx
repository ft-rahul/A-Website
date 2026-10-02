import React from 'react';
import { Sun, Moon } from 'lucide-react';

/** Two-state switch with a sliding thumb. role="switch" for assistive tech. */
export const ThemeSwitch = ({ value, onChange, label = 'Dark mode' }) => {
  const dark = value === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      className={`theme-switch ${dark ? 'is-dark' : ''}`}
      onClick={() => onChange(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light' : 'Switch to dark'}
    >
      <span className="theme-switch-icon is-sun" aria-hidden="true"><Sun size={13} /></span>
      <span className="theme-switch-icon is-moon" aria-hidden="true"><Moon size={13} /></span>
      <span className="theme-switch-thumb" aria-hidden="true" />
    </button>
  );
};
