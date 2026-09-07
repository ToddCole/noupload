import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackImageExport } from './analytics';

describe('image export analytics', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'gtag');
  });

  it('records only the approved event and tool value', () => {
    const gtag = vi.fn();
    Reflect.set(window, 'gtag', gtag);

    trackImageExport('meta_stripper');

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'image_export', { tool: 'meta_stripper' });
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/filename|metadata|size|dimension|blob|count/i);
  });

  it('does nothing when analytics is unavailable', () => {
    expect(() => trackImageExport('compressor')).not.toThrow();
  });
});
