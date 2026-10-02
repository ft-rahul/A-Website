import React, { useEffect, useState } from 'react';
import { ShoppingBag, Sun, Moon, Menu, X, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

const NAV = [
  { label: 'Courses', route: 'courses' },
  { label: 'My courses', route: 'my-courses' },
  { label: 'Profile', route: 'profile' }
];

export const Navbar = () => {
  const { theme, toggleTheme, currentRoute, navigateTo, cart, profile } = useApp();
  const { user, requestLogin, requestSignup, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const go = (route) => {
    navigateTo(route);
    setMobileOpen(false);
  };

  const login = () => {
    setMobileOpen(false);
    requestLogin();
  };
  const signup = () => {
    setMobileOpen(false);
    requestSignup();
  };

  const initials = profile.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <a
          href="/monkology"
          className="nav-brand"
          onClick={(e) => {
            e.preventDefault();
            go('lobby');
          }}
          aria-label="Monklogy home"
        >
          <Logo />
        </a>

        <nav aria-label="Primary" className="nav-primary">
          {user && (
          <ul className="nav-links">
            {NAV.filter((n) => n.route !== 'profile').map((item) => (
              <li key={item.route}>
                <button
                  className={`nav-link ${currentRoute === item.route ? 'is-active' : ''}`}
                  aria-current={currentRoute === item.route ? 'page' : undefined}
                  onClick={() => go(item.route)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          )}
        </nav>

        <div className="nav-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {user ? (
          <>
          <button
            className="icon-btn"
            onClick={() => go('cart')}
            aria-label={`Cart${cart.length ? `, ${cart.length} item${cart.length > 1 ? 's' : ''}` : ''}`}
            title="Cart"
          >
            <ShoppingBag size={16} />
            {cart.length > 0 && <span className="count-badge">{cart.length}</span>}
          </button>
          <button
            className={`avatar-btn ${currentRoute === 'profile' ? 'is-active' : ''}`}
            onClick={() => go('profile')}
            aria-label="Your profile"
            title="Profile"
          >
            {initials}
          </button>
          </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm nav-login" onClick={login}>Log in</button>
              <button className="btn btn-accent btn-sm nav-signup" onClick={signup}>Sign up</button>
            </>
          )}
          <button
            className="icon-btn nav-menu-btn"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
          {(user ? [{ label: 'Home', route: 'lobby' }, ...NAV, { label: 'Cart', route: 'cart' }] : [{ label: 'Home', route: 'lobby' }]).map((item) => (
            <button
              key={item.route}
              className={`mobile-nav-link ${currentRoute === item.route ? 'is-active' : ''}`}
              aria-current={currentRoute === item.route ? 'page' : undefined}
              onClick={() => go(item.route)}
            >
              {item.label}
            </button>
          ))}
          {user ? (
            <button className="mobile-nav-link is-muted" onClick={() => { setMobileOpen(false); signOut(); }}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <>
              <button className="mobile-nav-link" onClick={login}>Log in</button>
              <button className="mobile-nav-link is-accent" onClick={signup}>Sign up</button>
            </>
          )}
        </nav>
      )}
    </header>
  );
};
