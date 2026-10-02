import React, { useEffect, useState } from 'react';
import { formatPrice, formatPriceExact } from '../lib/money';
import { X, Lock, ShieldCheck, AlertCircle, CreditCard, Smartphone, Landmark, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { CourseMark } from './CourseMark';

const CHECK = {
  question: 'Quick check: which element marks a group of navigation links?',
  answer: '<nav>',
  options: ['<menu-links>', '<nav>', '<div class="nav">', '<header-nav>']
};

export const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / debit card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
  { id: 'wallet', label: 'Wallet', icon: Wallet }
];

export const CheckoutModal = () => {
  const { checkoutModal, setCheckoutModal, completePurchase, closeCheckoutModal, profile } = useApp();
  const [picked, setPicked] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [method, setMethod] = useState('card');

  useEffect(() => {
    if (checkoutModal.isOpen) {
      setPicked(null);
      setProcessing(false);
      setMethod('card');
    }
  }, [checkoutModal.isOpen]);

  const { step, items, totalPrice } = checkoutModal;
  const wrong = picked && picked !== CHECK.answer;

  const choose = (opt) => {
    setPicked(opt);
    if (opt === CHECK.answer) setTimeout(() => setCheckoutModal((m) => ({ ...m, step: 'payment' })), 350);
  };

  const pay = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);
    const m = PAYMENT_METHODS.find((x) => x.id === method) || PAYMENT_METHODS[0];
    const ok = await completePurchase({ method: m.id });
    // On success the dialog closes; on failure let the learner try again.
    if (!ok) setProcessing(false);
  };

  return (
    <Modal open={checkoutModal.isOpen} onClose={processing ? undefined : closeCheckoutModal} labelledBy="checkout-title" className="checkout">
      <div className="modal-header">
        <div>
          <p className="modal-step mono">Step {step === 'verify' ? 1 : 2} of 2</p>
          <h2 id="checkout-title" className="modal-title">{step === 'verify' ? 'Before you check out' : 'Confirm enrolment'}</h2>
        </div>
        <button className="icon-btn" onClick={closeCheckoutModal} aria-label="Close checkout" disabled={processing}>
          <X size={16} />
        </button>
      </div>

      <div className="modal-body">
        <ul className="checkout-items">
          {items.map((c) => (
            <li key={c.id}>
              <CourseMark course={c} size={36} />
              <span className="checkout-item-title">{c.title}</span>
              <span className="mono">{formatPrice(c.price)}</span>
            </li>
          ))}
        </ul>

        {step === 'verify' && (
          <fieldset className="verify">
            <legend>{CHECK.question}</legend>
            <div className="verify-options">
              {CHECK.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`verify-option mono ${picked === opt ? (opt === CHECK.answer ? 'is-right' : 'is-wrong') : ''}`}
                  aria-pressed={picked === opt}
                  onClick={() => choose(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {wrong && (
              <p className="verify-hint" role="alert">
                <AlertCircle size={14} /> Not quite — it is a three-letter HTML element.
              </p>
            )}
          </fieldset>
        )}

        {step === 'payment' && (
          <form onSubmit={pay} className="pay">
            <p className="notice">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>This is a prototype checkout. No payment is taken and no card details are collected.</span>
            </p>
            <fieldset className="pay-methods" disabled={processing}>
              <legend>Payment method</legend>
              <div className="pay-method-grid">
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <label key={id} className={`pay-method ${method === id ? 'is-on' : ''}`}>
                    <input type="radio" name="pay-method" value={id} checked={method === id} onChange={() => setMethod(id)} />
                    <Icon size={16} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <dl className="pay-summary">
              <div><dt>Learner</dt><dd>{profile.name}</dd></div>
              <div><dt>Access</dt><dd>Lifetime</dd></div>
              <div className="pay-total"><dt>Total</dt><dd>{formatPriceExact(totalPrice)}</dd></div>
            </dl>
            <button type="submit" className="btn btn-accent btn-block btn-lg" disabled={processing} data-autofocus>
              {processing ? 'Confirming…' : (<><Lock size={15} /> Pay {formatPrice(totalPrice)}</>)}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
