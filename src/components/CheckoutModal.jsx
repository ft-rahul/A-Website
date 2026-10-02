import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatPrice, formatPriceExact } from '../lib/money';
import { X, ShieldCheck, AlertCircle, CreditCard, Smartphone, Landmark, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { CourseMark } from './CourseMark';
import SlideCommit from './reactbits/SlideCommit';

const CHECK = {
  question: 'Quick check: which element marks a group of navigation links?',
  answer: '<nav>',
  options: ['<menu-links>', '<nav>', '<div class="nav">', '<header-nav>']
};

// SlideCommit picks its text colours from hex values, so it gets literal theme colours, not CSS vars.
const SLIDER_COLORS = {
  light: { track: '#edeae3', handle: '#c65a12', success: '#2f7a4b', danger: '#b4232f' },
  dark: { track: '#1b1b18', handle: '#f08a3c', success: '#5bbe7f', danger: '#f2727c' }
};

const PAY_LOADING_MS = 1500;

export const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / debit card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
  { id: 'wallet', label: 'Wallet', icon: Wallet }
];

export const CheckoutModal = () => {
  const { checkoutModal, setCheckoutModal, completePurchase, closeCheckoutModal, profile, theme } = useApp();
  const [picked, setPicked] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [method, setMethod] = useState('card');
  const sliderBox = useRef(null);
  const [sliderWidth, setSliderWidth] = useState(0);

  useEffect(() => {
    if (checkoutModal.isOpen) {
      setPicked(null);
      setProcessing(false);
      setMethod('card');
    }
  }, [checkoutModal.isOpen]);

  const { step, items, totalPrice } = checkoutModal;

  // The slider takes a pixel width, so track the width of the column it sits in.
  useLayoutEffect(() => {
    const el = sliderBox.current;
    if (!el) return;
    const measure = () => setSliderWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkoutModal.isOpen, step]);
  const wrong = picked && picked !== CHECK.answer;

  const choose = (opt) => {
    setPicked(opt);
    if (opt === CHECK.answer) setTimeout(() => setCheckoutModal((m) => ({ ...m, step: 'payment' })), 350);
  };

  // Resolves on success (the dialog then closes); rejects so the slider shakes and springs home.
  const pay = async () => {
    setProcessing(true);
    const m = PAYMENT_METHODS.find((x) => x.id === method) || PAYMENT_METHODS[0];
    // Hold the slider's spinner for a beat before the purchase closes the dialog.
    await new Promise((r) => setTimeout(r, PAY_LOADING_MS));
    const ok = await completePurchase({ method: m.id });
    if (!ok) {
      setProcessing(false);
      throw new Error('Payment not completed');
    }
  };
  const colors = SLIDER_COLORS[theme] || SLIDER_COLORS.light;

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
          <div className="pay">
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
            <div ref={sliderBox} className="pay-slide">
              {sliderWidth > 0 && (
                <SlideCommit
                  label={`Slide to pay ${formatPrice(totalPrice)}`}
                  doneLabel="Paid"
                  errorLabel="Payment failed"
                  onConfirm={pay}
                  trackColor={colors.track}
                  handleColor={colors.handle}
                  successColor={colors.success}
                  dangerColor={colors.danger}
                  width={sliderWidth}
                  height={52}
                  radius={26}
                  holdMs={0}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
