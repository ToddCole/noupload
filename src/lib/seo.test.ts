import { afterEach, describe, expect, it } from 'vitest';
import compressHtml from '../../compress/index.html?raw';
import homeHtml from '../../index.html?raw';
import metaStripperHtml from '../../meta-stripper/index.html?raw';
import shareSafeHtml from '../../share-safe/index.html?raw';
import removeGpsHtml from '../../remove-gps-from-photo/index.html?raw';
import redactHtml from '../../redact/index.html?raw';
import vercelConfig from '../../vercel.json?raw';
import { applySeo, canonicalUrl, SEO_BY_ROUTE } from './seo';

afterEach(() => {
  document.head.innerHTML = '';
});

describe('seo helpers', () => {
  it('builds canonical URLs for root and tool routes', () => {
    expect(canonicalUrl('/')).toBe('https://noupload.services/');
    expect(canonicalUrl('/meta-stripper')).toBe('https://noupload.services/meta-stripper');
    expect(canonicalUrl('/redact')).toBe('https://noupload.services/redact');
    expect(canonicalUrl('/compress')).toBe('https://noupload.services/compress');
  });

  it('applies route-specific title, description, canonical, and social tags', () => {
    applySeo(SEO_BY_ROUTE['/meta-stripper']);

    expect(document.title).toBe('Image Meta Stripper - Strip Image Metadata Locally | NoUpload');
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toContain(
      'Show and strip image metadata',
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://noupload.services/meta-stripper',
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
      'https://noupload.services/meta-stripper',
    );
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toContain(
      'Image Meta Stripper',
    );
  });

  it('applies Image Redactor SEO during client-side navigation', () => {
    applySeo(SEO_BY_ROUTE['/redact']);

    expect(document.title).toBe('Image Redactor - Redact Images Locally | NoUpload');
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toContain(
      'Manually cover faces',
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://noupload.services/redact',
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
      'https://noupload.services/redact',
    );
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toBe(
      'Image Redactor - Redact Images Locally | NoUpload',
    );
  });

  it('ships route-specific static HTML for crawlers before React loads', () => {
    expect(homeHtml).toContain('<title>Prepare Photos Safely Before Sharing | NoUpload</title>');
    expect(homeHtml).toContain('Remove photo metadata, cover sensitive details');
    expect(homeHtml).toContain('<link rel="canonical" href="https://noupload.services/" />');
    expect(metaStripperHtml).toContain(
      '<title>Image Meta Stripper - Strip Image Metadata Locally | NoUpload</title>',
    );
    expect(metaStripperHtml).toContain('<link rel="canonical" href="https://noupload.services/meta-stripper" />');
    expect(metaStripperHtml).toContain('<meta property="og:url" content="https://noupload.services/meta-stripper" />');
    expect(shareSafeHtml).toContain('<title>Share-Safe Image Cleaner - Strip, Check, and Verify | NoUpload</title>');
    expect(shareSafeHtml).toContain('<link rel="canonical" href="https://noupload.services/share-safe" />');
    expect(shareSafeHtml).toContain('"@type": "SoftwareApplication"');
    expect(shareSafeHtml).toContain('"name": "NoUpload Share-Safe Image Cleaner"');
    expect(removeGpsHtml).toContain('<title>Remove GPS Location Data from Photos | NoUpload</title>');
    expect(removeGpsHtml).toContain('<link rel="canonical" href="https://noupload.services/remove-gps-from-photo" />');
    expect(redactHtml).toContain('<title>Image Redactor - Redact Images Locally | NoUpload</title>');
    expect(redactHtml).toContain('<link rel="canonical" href="https://noupload.services/redact" />');
    expect(redactHtml).toContain('<meta property="og:url" content="https://noupload.services/redact" />');
    expect(compressHtml).toContain('<title>Image Compressor - Compress Images Locally | NoUpload</title>');
    expect(compressHtml).toContain('<link rel="canonical" href="https://noupload.services/compress" />');
    expect(compressHtml).toContain('<meta property="og:url" content="https://noupload.services/compress" />');
  });

  it('keeps the Image Redactor JSON-LD hash available for CSP', () => {
    expect(vercelConfig).toContain('sha256-n6yp7paxTxqZwjcG53MVD67B+eF3BnEGfta8CTIJCgw=');
    expect(vercelConfig).toContain('sha256-LMMG26AyUIxLH3nAhSUzMhuPSfZDiW2HchDZfbZ47rk=');
    expect(vercelConfig).toContain('sha256-P937eCXqdgHQfd+KpiJWei/pZtMysB5xuEgF7p2oRbo=');
    expect(vercelConfig).toContain('sha256-FPRRq34zGuXv/GsYGyi3AerJNPVtp5/RrpRBb2aXAPY=');
  });
});
