export type ImageTool = 'meta_stripper' | 'redactor' | 'compressor';

type Gtag = (command: 'event', eventName: 'image_export', parameters: { tool: ImageTool }) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export function trackImageExport(tool: ImageTool): void {
  if (window.gtag) {
    window.gtag('event', 'image_export', { tool });
    return;
  }

  const dataLayer = window.dataLayer ?? (window.dataLayer = []);
  dataLayer.push(['event', 'image_export', { tool }]);
}
