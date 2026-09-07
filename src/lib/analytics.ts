export type ImageTool = 'meta_stripper' | 'redactor' | 'compressor';

type Gtag = (command: 'event', eventName: 'image_export', parameters: { tool: ImageTool }) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function trackImageExport(tool: ImageTool): void {
  window.gtag?.('event', 'image_export', { tool });
}
