import React, { useEffect, useState } from 'react';
import {
  ToastItem,
  PendingConfirm,
  subscribeToToasts,
  subscribeToConfirm,
} from '../lib/feedback';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const FeedbackHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    const unsubToast = subscribeToToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4200);
    });

    const unsubConfirm = subscribeToConfirm((req) => {
      setPendingConfirm(req);
    });

    return () => {
      unsubToast();
      unsubConfirm();
    };
  }, []);

  useEffect(() => {
    if (!pendingConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pendingConfirm.resolve(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingConfirm]);

  return (
    <>
      {/* Non-blocking Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-80 flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl border px-3.5 py-3 shadow-lg flex items-start gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
                t.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : t.tone === 'success'
                  ? 'bg-white border-[#C69A35] text-[#172033]'
                  : 'bg-white border-[#E5E8EF] text-[#172033]'
              }`}
            >
              {t.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              ) : t.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#C69A35] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-[#C69A35] shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-snug">{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="p-0.5 text-[#596273] hover:text-[#172033] cursor-pointer"
                aria-label="Fermer la notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Non-blocking Confirmation Modal */}
      {pendingConfirm && (
        <div
          onClick={() => pendingConfirm.resolve(false)}
          className="fixed inset-0 z-80 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white border border-[#E5E8EF] p-5 shadow-2xl text-[#172033] space-y-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  pendingConfirm.danger
                    ? 'bg-red-50 border border-red-200 text-red-600'
                    : 'bg-amber-50 border border-[#C69A35]/40 text-[#C69A35]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#172033]">{pendingConfirm.title}</h3>
                <p className="text-xs text-[#596273] leading-relaxed">{pendingConfirm.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => pendingConfirm.resolve(false)}
                className="px-4 py-2.5 rounded-xl bg-[#F8F9FC] hover:bg-[#F1F4F9] border border-[#E5E8EF] text-xs font-bold text-[#172033] cursor-pointer min-h-[40px]"
              >
                {pendingConfirm.cancelText || 'Annuler'}
              </button>
              <button
                type="button"
                onClick={() => pendingConfirm.resolve(true)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer min-h-[40px] shadow-xs ${
                  pendingConfirm.danger
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] hover:brightness-105'
                }`}
              >
                {pendingConfirm.confirmText || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
