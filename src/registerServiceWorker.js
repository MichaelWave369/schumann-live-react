const SW_PATH = `${import.meta.env.BASE_URL}eirm-sw.js`;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: import.meta.env.BASE_URL })
      .catch((error) => {
        console.info('[EIRM] Service worker registration skipped:', error);
      });
  });
}
