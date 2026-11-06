// Register Service Worker and manage lifecycle & deployment updates for Afrique Business

export interface UpdateInfo {
  version?: string;
  hasWaitingWorker: boolean;
  serverUpdated?: boolean;
}

type UpdateCallback = (info: UpdateInfo) => void;
const updateListeners: Set<UpdateCallback> = new Set();

let swRegistration: ServiceWorkerRegistration | null = null;
let currentClientBuildTimestamp: number | null = null;
let currentClientVersion: string | null = null;
let isUpdatePending = false;
let updateCheckInterval: any = null;

export function onServiceWorkerUpdate(callback: UpdateCallback): () => void {
  updateListeners.add(callback);
  if (isUpdatePending) {
    callback({
      version: currentClientVersion || '2.5.0',
      hasWaitingWorker: Boolean(swRegistration?.waiting),
      serverUpdated: true,
    });
  }
  return () => {
    updateListeners.delete(callback);
  };
}

/**
 * Force skips waiting, cleans all old caches and triggers a hard reload
 */
export async function activateWaitingWorkerAndHardReload(): Promise<void> {
  console.log('[Afrique Business PWA] Applying update and rebooting application...');

  try {
    // 1. Send SKIP_WAITING to waiting or active service worker
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    // 2. Clear all cache storage keys so the new bundle loads immediately
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      console.log('[Afrique Business PWA] Caches cleared successfully.');
    }
  } catch (err) {
    console.warn('[Afrique Business PWA] Error during cache cleanup:', err);
  }

  // 3. Give 150ms for worker state change, then force reload
  setTimeout(() => {
    // Add cache-busting timestamp query parameter on reload to force CDN / browser reload
    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    window.location.href = cleanUrl;
    window.location.reload();
  }, 150);
}

// Backwards compatibility alias
export const activateWaitingWorker = activateWaitingWorkerAndHardReload;

/**
 * Checks for both service worker update and server deployment version
 */
export async function checkForUpdates(): Promise<boolean> {
  let found = false;

  // 1. Service Worker update check
  if (swRegistration) {
    try {
      await swRegistration.update();
      if (swRegistration.waiting) {
        found = true;
        notifyUpdateAvailable({
          version: currentClientVersion || '2.5.0',
          hasWaitingWorker: true,
        });
      }
    } catch (err) {
      console.warn('[Afrique Business PWA] Service worker update check failed:', err);
    }
  }

  // 2. Server API version check (deployment detection)
  try {
    const res = await fetch(`/api/app-version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.buildTimestamp) {
        if (!currentClientBuildTimestamp) {
          // Initialize baseline on first check
          currentClientBuildTimestamp = data.buildTimestamp;
          currentClientVersion = data.version;
        } else if (
          data.buildTimestamp > currentClientBuildTimestamp + 5000 ||
          (data.version && currentClientVersion && data.version !== currentClientVersion)
        ) {
          console.log('[Afrique Business PWA] New server deployment detected:', data);
          found = true;
          notifyUpdateAvailable({
            version: data.version,
            hasWaitingWorker: Boolean(swRegistration?.waiting),
            serverUpdated: true,
          });
        }
      }
    }
  } catch {
    // Ignore network dropouts in offline mode
  }

  return found;
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
        console.log('[Afrique Business PWA] Service Worker registered on scope:', reg.scope);

        // Immediate check if worker is already waiting
        if (reg.waiting) {
          notifyUpdateAvailable({
            version: '2.5.0',
            hasWaitingWorker: true,
          });
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
              console.log('[Afrique Business PWA] New Service Worker version waiting activation.');
              notifyUpdateAvailable({
                version: '2.5.0',
                hasWaitingWorker: true,
              });
            }
          });
        });

        // Run baseline version check
        checkForUpdates();

        // Recurring check every 60 seconds
        if (!updateCheckInterval) {
          updateCheckInterval = setInterval(() => {
            checkForUpdates();
          }, 60 * 1000);
        }
      })
      .catch((err) => {
        console.warn('[Afrique Business PWA] Service Worker registration failed:', err);
      });

    // Automatically check when tab becomes active / focused
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    });

    window.addEventListener('focus', () => {
      checkForUpdates();
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

function notifyUpdateAvailable(info: UpdateInfo) {
  isUpdatePending = true;
  updateListeners.forEach((cb) => {
    try {
      cb(info);
    } catch (e) {
      console.error(e);
    }
  });
}
