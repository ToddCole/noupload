import ExifReader from 'exifreader';
import { OutputFormat, pickOutputFormat, shrinkImage, ShrinkSettings } from './imageShrink';

export type PrivacyFindingKey =
  | 'location'
  | 'device'
  | 'dates'
  | 'author'
  | 'thumbnail'
  | 'formatMismatch'
  | 'unknownType';

export type PrivacyStatus = 'Looks clean' | 'Metadata found' | 'Could not inspect' | 'Unsupported for cleaning';

export interface PrivacyFinding {
  key: PrivacyFindingKey;
  label: string;
  risk: 'high' | 'medium' | 'low';
}

export interface PrivacyReport {
  status: PrivacyStatus;
  findings: PrivacyFinding[];
  metadata: PrivacyMetadataEntry[];
  canClean: boolean;
  canInspect: boolean;
  message: string;
}

export interface CleanVerification {
  passed: boolean;
  remainingFindings: PrivacyFinding[];
  remainingMetadata: number;
  sha256: string | null;
}

type ExifTags = Record<string, unknown>;

export interface PrivacyMetadataEntry {
  group: string;
  tag: string;
  value: string;
}

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
]);

const CLEANABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SIGNATURES: Array<{ type: string; matches: (bytes: Uint8Array) => boolean }> = [
  { type: 'image/jpeg', matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  {
    type: 'image/png',
    matches: (bytes) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    type: 'image/gif',
    matches: (bytes) =>
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61,
  },
  {
    type: 'image/webp',
    matches: (bytes) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
  {
    type: 'image/avif',
    matches: (bytes) => bytesToAscii(bytes.slice(4, 12)) === 'ftypavif' || bytesToAscii(bytes.slice(4, 12)) === 'ftypavis',
  },
  {
    type: 'image/heic',
    matches: (bytes) => {
      const brand = bytesToAscii(bytes.slice(8, 12));
      return bytesToAscii(bytes.slice(4, 8)) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
    },
  },
];

const CLEAN_SETTINGS: ShrinkSettings = {
  format: 'auto',
  maxSize: 'original',
  quality: 95,
  targetEnabled: false,
  targetKb: 0,
  stripMetadata: true,
};

export function isPrivacyImageFile(file: File): boolean {
  return file.type.startsWith('image/') || SUPPORTED_IMAGE_TYPES.has(file.type);
}

export async function inspectPrivacy(file: File): Promise<PrivacyReport> {
  if (!isPrivacyImageFile(file)) {
    return unsupportedReport(false);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  const canClean = CLEANABLE_TYPES.has(file.type) || (detectedType ? CLEANABLE_TYPES.has(detectedType) : false);
  const mismatch = Boolean(file.type && detectedType && file.type !== detectedType);

  let tags: ExifTags = {};
  try {
    tags = ExifReader.load(bytes.buffer, { expanded: true }) as ExifTags;
  } catch {
    if (!detectedType && !SUPPORTED_IMAGE_TYPES.has(file.type)) {
      return unsupportedReport(false);
    }

    return {
      status: canClean ? 'Could not inspect' : 'Unsupported for cleaning',
      findings: [
        ...(mismatch ? [finding('formatMismatch')] : []),
        ...(!detectedType ? [finding('unknownType')] : []),
      ],
      metadata: [],
      canClean,
      canInspect: false,
      message: canClean
        ? 'This image can be cleaned, but its metadata could not be inspected first.'
        : 'This image format can be checked only where browser and parser support allows.',
    };
  }

  return classifyPrivacyTags(tags, {
    canClean,
    detectedType,
    declaredType: file.type,
  });
}

export function classifyPrivacyTags(
  tags: ExifTags,
  options: { canClean: boolean; declaredType?: string; detectedType?: string | null },
): PrivacyReport {
  const keys = flattenTagKeys(tags);
  const metadata = metadataEntriesFromTags(tags);
  const findings: PrivacyFinding[] = [];

  if (hasAny(keys, ['gps', 'location', 'latitude', 'longitude'])) {
    findings.push(finding('location'));
  }

  if (hasAny(keys, ['make', 'model', 'lensmodel', 'serialnumber', 'bodyserialnumber', 'device', 'camera'])) {
    findings.push(finding('device'));
  }

  if (hasAny(keys, ['date', 'datetime', 'createdate', 'modifydate', 'timeoriginal', 'timestamp'])) {
    findings.push(finding('dates'));
  }

  if (hasAny(keys, ['artist', 'author', 'creator', 'copyright', 'comment', 'software', 'ownername', 'by-line'])) {
    findings.push(finding('author'));
  }

  if (hasAny(keys, ['thumbnail', 'previewimage', 'jpeginterchangeformat'])) {
    findings.push(finding('thumbnail'));
  }

  if (options.declaredType && options.detectedType && options.declaredType !== options.detectedType) {
    findings.push(finding('formatMismatch'));
  }

  if (!options.detectedType && options.declaredType) {
    findings.push(finding('unknownType'));
  }

  if (!options.canClean) {
    return {
      status: 'Unsupported for cleaning',
      findings,
      metadata,
      canClean: false,
      canInspect: true,
      message:
        metadata.length > 0
          ? 'Metadata was found, but this format is report-only in this browser.'
          : 'No common sensitive metadata was found, but this format is report-only in this browser.',
    };
  }

  return {
    status: metadata.length > 0 || findings.length > 0 ? 'Metadata found' : 'Looks clean',
    findings,
    metadata,
    canClean: true,
    canInspect: true,
    message:
      findings.length > 0
        ? 'Clean and download will re-encode the image through canvas to remove embedded metadata.'
        : metadata.length > 0
          ? 'Metadata was found, but no common sensitive categories were detected.'
        : 'No common sensitive metadata categories were detected.',
  };
}

export async function cleanPrivacyImage(file: File, outputIndex: number): Promise<{ blob: Blob; filename: string }> {
  const outputFormat = pickOutputFormat(file, CLEAN_SETTINGS.format);
  const result = await shrinkImage(file, CLEAN_SETTINGS, `privacy-clean-${String(outputIndex).padStart(2, '0')}`);
  return {
    blob: result.blob,
    filename: ensureCleanExtension(result.filename, outputFormat),
  };
}

export async function verifyCleanImage(blob: Blob): Promise<CleanVerification> {
  const file = new File([blob], 'noupload-clean-output', { type: blob.type });
  const report = await inspectPrivacy(file);
  const remainingFindings = report.findings.filter((finding) => !['formatMismatch', 'unknownType'].includes(finding.key));
  const sha256 = await hashBlob(blob);

  return {
    passed: report.canInspect && remainingFindings.length === 0,
    remainingFindings,
    remainingMetadata: report.metadata.length,
    sha256,
  };
}

async function hashBlob(blob: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    return null;
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function unsupportedReport(canInspect: boolean): PrivacyReport {
  return {
    status: 'Unsupported for cleaning',
    findings: [finding('unknownType')],
    metadata: [],
    canClean: false,
    canInspect,
    message: 'Image Meta Stripper supports image files only.',
  };
}

function finding(key: PrivacyFindingKey): PrivacyFinding {
  const labels: Record<PrivacyFindingKey, PrivacyFinding> = {
    location: { key, label: 'Location data found', risk: 'high' },
    device: { key, label: 'Camera or device info found', risk: 'medium' },
    dates: { key, label: 'Creation or edit dates found', risk: 'medium' },
    author: { key, label: 'Author, copyright, comment, or software fields found', risk: 'medium' },
    thumbnail: { key, label: 'Embedded thumbnail or preview metadata found', risk: 'low' },
    formatMismatch: { key, label: 'Format mismatch detected', risk: 'medium' },
    unknownType: { key, label: 'Unknown image type', risk: 'low' },
  };
  return labels[key];
}

function flattenTagKeys(value: unknown, prefix = '', keys: string[] = []): string[] {
  if (!value || typeof value !== 'object') {
    return keys;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const normalized = `${prefix}${key}`.toLowerCase().replace(/[\s_-]/g, '');
    keys.push(normalized);
    if (child && typeof child === 'object' && !(child instanceof Uint8Array) && !(child instanceof ArrayBuffer)) {
      flattenTagKeys(child, `${normalized}.`, keys);
    }
  });

  return keys;
}

function hasAny(keys: string[], needles: string[]): boolean {
  return keys.some((key) => needles.some((needle) => key.includes(needle)));
}

function metadataEntriesFromTags(tags: ExifTags): PrivacyMetadataEntry[] {
  const entries: PrivacyMetadataEntry[] = [];
  collectMetadataEntries(tags, [], entries);
  return entries.sort((a, b) => `${a.group}.${a.tag}`.localeCompare(`${b.group}.${b.tag}`));
}

function collectMetadataEntries(value: unknown, path: string[], entries: PrivacyMetadataEntry[]): void {
  if (!value || typeof value !== 'object') {
    if (path.length > 0) {
      const display = formatMetadataValue(value);
      if (display) {
        entries.push({
          group: path.slice(0, -1).join(' / ') || 'Metadata',
          tag: path[path.length - 1],
          value: display,
        });
      }
    }
    return;
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    if (path.length > 0) {
      entries.push({
        group: path.slice(0, -1).join(' / ') || 'Metadata',
        tag: path[path.length - 1],
        value: '[binary data]',
      });
    }
    return;
  }

  const objectValue = value as Record<string, unknown>;
  const tagValue = formatExifTagValue(objectValue);
  if (tagValue && path.length > 0) {
    entries.push({
      group: path.slice(0, -1).join(' / ') || 'Metadata',
      tag: path[path.length - 1],
      value: tagValue,
    });
    return;
  }

  Object.entries(objectValue).forEach(([key, child]) => {
    if (['id', 'description', 'value'].includes(key) && path.length > 0) {
      return;
    }
    collectMetadataEntries(child, [...path, key], entries);
  });
}

function formatExifTagValue(value: Record<string, unknown>): string {
  const description = formatMetadataValue(value.description);
  if (description) {
    return description;
  }

  return formatMetadataValue(value.value);
}

function formatMetadataValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return '[binary data]';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '';
    }
    if (value.every((item) => ['string', 'number', 'boolean', 'bigint'].includes(typeof item))) {
      return value.map((item) => String(item)).join(', ');
    }
    return `[${value.length} values]`;
  }

  return '';
}

function detectImageType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.type ?? null;
}

function bytesToAscii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function ensureCleanExtension(filename: string, format: Exclude<OutputFormat, 'auto'>): string {
  const extensionByFormat = {
    webp: 'webp',
    jpeg: 'jpg',
    png: 'png',
  };
  return filename.replace(/\.[a-z0-9]+$/i, `.${extensionByFormat[format]}`);
}
