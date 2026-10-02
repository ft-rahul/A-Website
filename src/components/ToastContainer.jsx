import React from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ICONS = { success: CheckCircle2, warning: AlertTriangle, info: Info };

export const ToastContainer = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Icon size={18} className="toast-icon" aria-hidden="true" />
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
