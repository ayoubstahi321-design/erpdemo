/**
 * Unregister any lingering service workers and clear their caches.
 * The old PWA service worker (azmol-erp-v1) was caching JS bundles indefinitely,
 * preventing new code from loading. The kill-switch sw.js handles this on the SW
 * side; this function handles cleanup from the app side.
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));

        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch (e) {
        console.error('[SW] Cleanup failed:', e);
      }
    });
  }
}

export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
}

export async function clearCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  }
  return null;
}
