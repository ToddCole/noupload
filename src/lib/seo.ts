export interface SeoConfig {
  title: string;
  description: string;
  path: string;
}

const SITE_URL = 'https://noupload.services';

export const SEO_BY_ROUTE = {
  '/': {
    title: 'Prepare Photos Safely Before Sharing | NoUpload',
    description:
      'Remove photo metadata, cover sensitive details, and verify a clean image before sharing. Everything runs locally in your browser.',
    path: '/',
  },
  '/share-safe': {
    title: 'Share-Safe Image Cleaner - Strip, Check, and Verify | NoUpload',
    description:
      'Prepare images before sharing: inspect metadata, remove hidden image details, and verify the cleaned copy entirely in your browser.',
    path: '/share-safe',
  },
  '/meta-stripper': {
    title: 'Image Meta Stripper - Strip Image Metadata Locally | NoUpload',
    description:
      'Show and strip image metadata including EXIF, GPS, ICC, XMP, author fields, camera details, and dates. Images are processed locally in your browser.',
    path: '/meta-stripper',
  },
  '/redact': {
    title: 'Image Redactor - Redact Images Locally | NoUpload',
    description:
      'Manually cover faces, names, addresses, plates, tokens, and other sensitive image areas locally in your browser before sharing.',
    path: '/redact',
  },
  '/compress': {
    title: 'Image Compressor - Compress Images Locally | NoUpload',
    description:
      'Compress and resize JPEG, PNG, and WebP images locally in your browser. NoUpload does not upload your files for processing.',
    path: '/compress',
  },
} as const satisfies Record<string, SeoConfig>;

export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}

export function applySeo(config: SeoConfig): void {
  const url = canonicalUrl(config.path);
  document.title = config.title;

  setMetaByName('description', config.description);
  setCanonical(url);
  setMetaByProperty('og:title', config.title);
  setMetaByProperty('og:description', config.description);
  setMetaByProperty('og:url', url);
  setMetaByName('twitter:title', config.title);
  setMetaByName('twitter:description', config.description);
}

function setCanonical(url: string): void {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = url;
}

function setMetaByName(name: string, content: string): void {
  setMeta(`meta[name="${cssEscape(name)}"]`, 'name', name, content);
}

function setMetaByProperty(property: string, content: string): void {
  setMeta(`meta[property="${cssEscape(property)}"]`, 'property', property, content);
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}
