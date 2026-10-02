import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: Escape closes, focus moves into the dialog and is
 * trapped there, focus returns to the trigger on close, and the page
 * behind does not scroll.
 */
export const Modal = ({ open, onClose, labelledBy, className = '', children, closeOnBackdrop = true }) => {
  const dialogRef = useRef(null);
  const returnFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const first = dialog?.querySelector('[data-autofocus]') || dialog?.querySelector(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === 'Tab' && dialog) {
        const items = Array.from(dialog.querySelectorAll(FOCUSABLE));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`modal ${className}`}>
        {children}
      </div>
    </div>,
    document.body
  );
};
