// In-app Toast & Confirmation Dialog event bus (replaces blocking window.alert / window.confirm)

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  text: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

type ToastListener = (toast: ToastItem) => void;
type ConfirmListener = (req: PendingConfirm | null) => void;

const toastListeners = new Set<ToastListener>();
const confirmListeners = new Set<ConfirmListener>();

export function subscribeToToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function subscribeToConfirm(listener: ConfirmListener): () => void {
  confirmListeners.add(listener);
  return () => {
    confirmListeners.delete(listener);
  };
}

export function appToast(text: string, tone: ToastTone = 'info'): void {
  const item: ToastItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    tone,
  };
  toastListeners.forEach((listener) => {
    try {
      listener(item);
    } catch (err) {
      console.error('Toast listener error:', err);
    }
  });
}

export function appConfirm(options: ConfirmOptions): Promise<boolean> {
  if (confirmListeners.size === 0) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    const req: PendingConfirm = {
      ...options,
      resolve: (accepted: boolean) => {
        confirmListeners.forEach((l) => l(null));
        resolve(accepted);
      },
    };
    confirmListeners.forEach((listener) => listener(req));
  });
}
