import { describe, expect, it } from 'vitest';
import sitemap from '../../public/sitemap.xml?raw';

describe('sitemap', () => {
  it('lists canonical public routes', () => {
    expect(sitemap).toContain('<loc>https://noupload.services/</loc>');
    expect(sitemap).toContain('<loc>https://noupload.services/meta-stripper</loc>');
    expect(sitemap).toContain('<loc>https://noupload.services/share-safe</loc>');
    expect(sitemap).toContain('<loc>https://noupload.services/redact</loc>');
    expect(sitemap).toContain('<loc>https://noupload.services/compress</loc>');
    expect(sitemap).not.toContain('privacy-check');
  });
});
