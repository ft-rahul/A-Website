import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EMAIL_RE, MIN_PASSWORD } from '../lib/auth';
import { Modal } from './Modal';
import { Logo } from './Logo';

/**
 * Log in and Sign up are separate modes of one dialog.
 *  • Log in: email + password. An email with no account is refused with a
 *    pointer to Sign up — nothing is created silently.
 *  • Sign up: email + password, then first + last name for the profile. An
 *    email that already has an account is pointed to Log in.
 */
export const AuthModal = () => {
  const { prompt, closeLogin, signIn, signUp, accountExists } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState('credentials'); // signup only: 'credentials' | 'names'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null); // { text, switchTo?: 'login' | 'signup' }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prompt.open) {
      setMode(prompt.mode || 'login');
      setStep('credentials');
      setPassword('');
      setShowPass(false);
      setFirstName('');
      setLastName('');
      setError(null);
      setBusy(false);
    }
  }, [prompt.open, prompt.mode]);

  const switchMode = (m) => {
    setMode(m);
    setStep('credentials');
    setError(null);
  };

  const checkCredentials = () => {
    if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
    if (!password) return 'Enter your password.';
    if (mode === 'signup' && password.length < MIN_PASSWORD) return `Choose a password with at least ${MIN_PASSWORD} characters.`;
    return '';
  };

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError(null);
    const bad = checkCredentials();
    if (bad) return setError({ text: bad });
    let exists;
    setBusy(true);
    try {
      exists = await accountExists(email);
    } catch (err) {
      setBusy(false);
      return setError({ text: err?.status === 429 ? 'Too many attempts. Wait a minute and try again.' : err?.message || 'Could not reach Monklogy. Try again.' });
    }
    setBusy(false);

    if (mode === 'signup') {
      if (exists) return setError({ text: 'An account with this email already exists. Log in instead.', switchTo: 'login' });
      setStep('names');
      return undefined;
    }

    // log in: the email must already be registered on this site
    if (!exists) {
      return setError({ text: 'You don’t have an account on Monklogy with this email. Sign up first to continue.', switchTo: 'signup' });
    }
    setBusy(true);
    const r = await signIn(email, password);
    if (!r.ok) {
      setBusy(false);
      setError({ text: r.error, switchTo: r.code === 'no-account' ? 'signup' : undefined });
    }
    return undefined;
  };

  const submitNames = async (e) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError({ text: 'Enter your first name.' });
    if (!lastName.trim()) return setError({ text: 'Enter your last name.' });
    setBusy(true);
    const r = await signUp({ email, password, firstName, lastName });
    if (!r.ok) {
      setBusy(false);
      setError({ text: r.error, switchTo: r.code === 'exists' ? 'login' : undefined });
    }
    return undefined;
  };

  const isSignup = mode === 'signup';
  const isNames = isSignup && step === 'names';

  const errorLine = error && (
    <div className="auth-error" role="alert">
      <AlertCircle size={15} aria-hidden="true" />
      <span>
        {error.text}{' '}
        {error.switchTo && (
          <button type="button" className="auth-link" onClick={() => switchMode(error.switchTo)}>
            {error.switchTo === 'signup' ? 'Create an account' : 'Go to log in'}
          </button>
        )}
      </span>
    </div>
  );

  return (
    <Modal open={prompt.open} onClose={busy ? undefined : closeLogin} labelledBy="auth-title" className="auth">
      <div className="auth-head">
        {isNames ? (
          <button type="button" className="icon-btn is-quiet" onClick={() => { setStep('credentials'); setError(null); }} aria-label="Back to email and password">
            <ArrowLeft size={16} />
          </button>
        ) : (
          <Logo size={22} />
        )}
        <button type="button" className="icon-btn is-quiet" onClick={closeLogin} aria-label="Close" disabled={busy}>
          <X size={16} />
        </button>
      </div>

      <div className="auth-body">
        {!isNames && (
          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={!isSignup} className={`auth-tab ${!isSignup ? 'is-active' : ''}`} onClick={() => switchMode('login')}>Log in</button>
            <button type="button" role="tab" aria-selected={isSignup} className={`auth-tab ${isSignup ? 'is-active' : ''}`} onClick={() => switchMode('signup')}>Sign up</button>
          </div>
        )}
        {isSignup && <p className="auth-step mono">Step {isNames ? 2 : 1} of 2</p>}
        <h2 id="auth-title" className="auth-title">
          {isNames ? 'Set up your profile' : isSignup ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="auth-lede">
          {isNames
            ? <>Creating an account for <strong>{email.trim().toLowerCase()}</strong>. This name appears on your profile and receipts.</>
            : isSignup
              ? 'Sign up to browse courses, buy them and keep your progress.'
              : prompt.reason || 'Log in with the email and password you signed up with.'}
        </p>

        {isNames ? (
          <form onSubmit={submitNames} className="auth-form" noValidate key="names">
            <div className="auth-row">
              <label className="auth-field">
                <span>First name</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={30} autoFocus />
              </label>
              <label className="auth-field">
                <span>Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={30} />
              </label>
            </div>
            {errorLine}
            <button type="submit" className="btn btn-accent btn-block btn-lg" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCredentials} className="auth-form" noValidate key={mode}>
            <label className="auth-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" data-autofocus autoFocus />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <span className="auth-pass">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                />
                <button type="button" className="auth-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {errorLine}
            <button type="submit" className="btn btn-accent btn-block btn-lg" disabled={busy}>
              {busy ? (isSignup ? 'Checking…' : 'Logging in…') : isSignup ? 'Continue' : 'Log in'}
            </button>
            <p className="auth-note">
              {isSignup ? 'Already have an account?' : 'New to Monklogy?'}{' '}
              <button type="button" className="auth-link" onClick={() => switchMode(isSignup ? 'login' : 'signup')}>
                {isSignup ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </form>
        )}
      </div>
    </Modal>
  );
};
