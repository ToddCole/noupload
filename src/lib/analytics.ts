export type ImageTool = 'meta_stripper' | 'redactor' | 'compressor';

const GA_MEASUREMENT_ID = 'G-4BLE09VH6H';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

let analyticsInitialized = false;

// Loaded after mount (not from a static <head> tag) so GTM's DOM/global mutations
// never race with React hydration; racing them causes hydration-mismatch errors
// in the production build.
export function initAnalytics(): void {
  if (analyticsInitialized || typeof window === 'undefined') {
    return;
  }
  analyticsInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

export function trackImageExport(tool: ImageTool): void {
  if (window.gtag) {
    window.gtag('event', 'image_export', { tool });
    return;
  }

  const dataLayer = window.dataLayer ?? (window.dataLayer = []);
  dataLayer.push(['event', 'image_export', { tool }]);
}
