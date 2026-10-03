import React, { useId, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Reveal } from './Reveal';

const GOALS = ['Full-stack development', 'AI for real work', 'Mobile apps', 'UI/UX design', 'Not sure yet'];
const LEVELS = ['New to this', 'Some experience', 'Working professionally'];
const STORE_KEY = 'monklogy.earlyAccess';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isPhone = (v) => /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15;

// TODO: there is no early-access endpoint on the API yet, so the request is
// only kept in this browser. Replace with a POST once the backend accepts it.
const submitEarlyAccess = async (entry) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...entry, at: new Date().toISOString() }));
  } catch { /* storage blocked: nothing else to do */ }
};

const Choice = ({ name, options, value, onChange }) => (
  <div className="ea-choices">
    {options.map((o) => (
      <label key={o} className={`ea-chip ${value === o ? 'is-on' : ''}`}>
        <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} />
        {o}
      </label>
    ))}
  </div>
);

export const EarlyAccess = ({ onExplore }) => {
  const id = useId();
  const [goal, setGoal] = useState(GOALS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = contact.trim();
    if (!EMAIL.test(value) && !isPhone(value)) {
      setError('Enter an email address, or a WhatsApp number with country code.');
      return;
    }
    setError('');
    setStatus('sending');
    await submitEarlyAccess({ goal, level, contact: value });
    setStatus('done');
  };

  return (
    <section className="early-access" aria-labelledby="ea-title">
      <div className="container ea-grid">
        <Reveal className="ea-copy">
          <p className="eyebrow is-accent">Early access</p>
          <h2 id="ea-title">
            <span className="ea-line">Stop collecting courses.</span>{' '}
            <span className="ea-line ea-muted">Start building mastery.</span>
          </h2>
          <p>We’re opening in small cohorts. Tell us your goal and where you’re starting, and your first step will be a short skill check.</p>
          <button type="button" className="ea-link" onClick={onExplore}>
            Explore Monklogy <ArrowRight size={15} />
          </button>
        </Reveal>

        <Reveal delay={100}>
          {status === 'done' ? (
            <div className="ea-card ea-done" role="status">
              <span className="ea-done-icon" aria-hidden="true"><Check size={20} /></span>
              <h3>You’re on the list.</h3>
              <p>
                We’ll reach you at <strong>{contact.trim()}</strong> when your cohort opens, with a short assessment
                for <strong>{goal.toLowerCase()}</strong>.
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus('idle')}>Change my details</button>
            </div>
          ) : (
            <form className="ea-card" onSubmit={onSubmit} noValidate>
              <fieldset className="ea-field">
                <legend><span className="ea-n mono">01</span> What’s your goal?</legend>
                <Choice name={`${id}-goal`} options={GOALS} value={goal} onChange={setGoal} />
              </fieldset>
              <fieldset className="ea-field">
                <legend><span className="ea-n mono">02</span> Where are you starting?</legend>
                <Choice name={`${id}-level`} options={LEVELS} value={level} onChange={setLevel} />
              </fieldset>
              <div className="ea-field">
                <label htmlFor={`${id}-contact`} className="ea-legend"><span className="ea-n mono">03</span> Email or WhatsApp number</label>
                <div className="ea-row">
                  <input
                    id={`${id}-contact`}
                    className="ea-input"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com or +91 98765 43210"
                    value={contact}
                    onChange={(e) => { setContact(e.target.value); if (error) setError(''); }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={`${id}-hint`}
                  />
                  <button type="submit" className="btn btn-accent ea-submit" disabled={status === 'sending'}>
                    Reserve my spot <ArrowRight size={15} />
                  </button>
                </div>
                <p id={`${id}-hint`} className={`ea-hint ${error ? 'is-error' : ''}`}>
                  {error || 'Small cohorts. We’ll only message you about your invite.'}
                </p>
              </div>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
};
