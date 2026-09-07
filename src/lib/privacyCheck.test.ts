import { describe, expect, it, vi } from 'vitest';
import { classifyPrivacyTags, inspectPrivacy } from './privacyCheck';

vi.mock('exifreader', () => ({
  default: {
    load: vi.fn(() => ({
      exif: {
        GPSLatitude: { description: '27.4705 S' },
        GPSLongitude: { description: '153.0260 E' },
        Make: { description: 'Secret Camera Co' },
        DateTimeOriginal: { description: '2026:09:05 10:00:00' },
        Artist: { description: 'Private Person' },
        Thumbnail: { description: 'embedded preview' },
      },
    })),
  },
}));

function imageFile(name: string, type = 'image/jpeg'): File {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00, 0xff, 0xd9]);
  return new File([jpegBytes], name, { type });
}

describe('privacy metadata classification', () => {
  it('summarizes sensitive categories and includes local metadata values', () => {
    const report = classifyPrivacyTags(
      {
        gps: { GPSLatitude: { description: 'private latitude' } },
        exif: { Model: { description: 'private model' }, DateTimeOriginal: { description: 'private date' } },
        iptc: { Copyright: { description: 'private copyright' } },
      },
      { canClean: true, declaredType: 'image/jpeg', detectedType: 'image/jpeg' },
    );

    expect(report.status).toBe('Metadata found');
    expect(report.canClean).toBe(true);
    expect(report.findings.map((finding) => finding.key)).toEqual(['location', 'device', 'dates', 'author']);
    expect(report.metadata).toEqual([
      { group: 'exif', tag: 'DateTimeOriginal', value: 'private date' },
      { group: 'exif', tag: 'Model', value: 'private model' },
      { group: 'gps', tag: 'GPSLatitude', value: 'private latitude' },
      { group: 'iptc', tag: 'Copyright', value: 'private copyright' },
    ]);
  });

  it('reports clean images plainly', () => {
    const report = classifyPrivacyTags({}, { canClean: true, declaredType: 'image/png', detectedType: 'image/png' });

    expect(report.status).toBe('Looks clean');
    expect(report.findings).toHaveLength(0);
    expect(report.message).toContain('No common sensitive metadata');
  });

  it('reports metadata even when no sensitive category matches', () => {
    const report = classifyPrivacyTags(
      { file: { ImageWidth: { description: '1024px' }, ImageHeight: { description: '768px' } } },
      { canClean: true, declaredType: 'image/png', detectedType: 'image/png' },
    );

    expect(report.status).toBe('Metadata found');
    expect(report.findings).toHaveLength(0);
    expect(report.metadata.map((entry) => entry.tag)).toEqual(['ImageHeight', 'ImageWidth']);
    expect(report.message).toContain('Metadata was found');
  });

  it('marks inspectable but non-cleanable image formats as report-only', () => {
    const report = classifyPrivacyTags(
      { exif: { Software: { description: 'private app' } } },
      { canClean: false, declaredType: 'image/gif', detectedType: 'image/gif' },
    );

    expect(report.status).toBe('Unsupported for cleaning');
    expect(report.canClean).toBe(false);
    expect(report.findings.map((finding) => finding.key)).toEqual(['author']);
    expect(report.metadata).toEqual([{ group: 'exif', tag: 'Software', value: 'private app' }]);
  });
});

describe('privacy report data safety', () => {
  it('does not call analytics or external requests while inspecting files', async () => {
    if (!window.fetch) {
      vi.stubGlobal('fetch', vi.fn());
    }
    if (!navigator.sendBeacon) {
      Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn() });
    }
    const fetchSpy = vi.spyOn(window, 'fetch');
    const beaconSpy = vi.spyOn(navigator, 'sendBeacon');
    const gtag = vi.fn();
    Reflect.set(window, 'gtag', gtag);

    const report = await inspectPrivacy(imageFile('passport-secret-home-address.jpg'));
    const serialized = JSON.stringify(report);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
    expect(serialized).not.toContain('passport-secret-home-address.jpg');
    expect(serialized).toContain('Secret Camera Co');
    expect(serialized).toContain('Private Person');

    fetchSpy.mockRestore();
    beaconSpy.mockRestore();
  });
});
