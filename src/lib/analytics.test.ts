import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackImageExport } from './analytics';

describe('image export analytics', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'gtag');
    Reflect.deleteProperty(window, 'dataLayer');
  });

  it('records only the approved event and tool value', () => {
    const gtag = vi.fn();
    Reflect.set(window, 'gtag', gtag);

    trackImageExport('meta_stripper');

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'image_export', { tool: 'meta_stripper' });
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/filename|metadata|size|dimension|blob|count/i);
  });

  it('queues the event in the data layer when gtag is unavailable', () => {
    window.dataLayer = [];

    trackImageExport('compressor');

    expect(window.dataLayer).toEqual([['event', 'image_export', { tool: 'compressor' }]]);
  });
});
