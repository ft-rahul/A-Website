import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { courses } from '../data/catalog';
import { Logo } from './Logo';

export const Footer = () => {
  const { navigateTo } = useApp();
  const { user, requestLogin, requestSignup } = useAuth();
  const core = courses.slice(0, 4);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo size={24} />
            <p>
              Software development courses that explain what your code actually does — in video, in a live workspace,
              and line by line.
            </p>
          </div>

          <div>
            <h2 className="footer-heading">Core tracks</h2>
            <ul className="footer-list">
              {core.map((c) => (
                <li key={c.id}>
                  <button onClick={() => navigateTo('course-details', { courseId: c.id })}>{c.title}</button>
                </li>
              ))}
              {user && (
                <li>
                  <button onClick={() => navigateTo('courses')}>All courses</button>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h2 className="footer-heading">{user ? 'Learn' : 'Account'}</h2>
            <ul className="footer-list">
              {user ? (
                <>
                  <li><button onClick={() => navigateTo('my-courses')}>My courses</button></li>
                  <li><button onClick={() => navigateTo('tutor')}>Tutor workspace</button></li>
                  <li><button onClick={() => navigateTo('profile')}>Profile and progress</button></li>
                </>
              ) : (
                <>
                  <li><button onClick={() => requestLogin()}>Log in</button></li>
                  <li><button onClick={() => requestSignup()}>Create an account</button></li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h2 className="footer-heading">Commitments</h2>
            <ul className="footer-list is-static">
              <li>One-time purchase, lifetime access</li>
              <li>30-day refund</li>
              <li>No tracking scripts</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Monklogy</span>
          <span className="mono">Your account and progress are saved in this browser</span>
        </div>
      </div>
    </footer>
  );
};
