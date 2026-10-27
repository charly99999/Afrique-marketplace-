// Register Service Worker and manage lifecycle updates for Afrique Business

type UpdateCallback = (registration: ServiceWorkerRegistration) => void;
const updateListeners: Set<UpdateCallback> = new Set();

let swRegistration: ServiceWorkerRegistration | null = null;

export function onServiceWorkerUpdate(callback: UpdateCallback): () => void {
  updateListeners.add(callback);
  if (swRegistration && swRegistration.waiting) {
    callback(swRegistration);
  }
  return () => {
    updateListeners.delete(callback);
  };
}

export function activateWaitingWorker() {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

export function registerSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        swRegistration = reg;
        console.log('[Afrique Business PWA] Service Worker registered:', reg.scope);

        // Check if there's already a waiting worker
        if (reg.waiting) {
          notifyUpdateAvailable(reg);
        }

        // Detect new worker installed and waiting
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              notifyUpdateAvailable(reg);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[Afrique Business PWA] Service Worker registration failed:', err);
      });

    // Auto-reload when new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

function notifyUpdateAvailable(reg: ServiceWorkerRegistration) {
  updateListeners.forEach((cb) => {
    try {
      cb(reg);
    } catch (e) {
      console.error(e);
    }
  });
}
