import JSZip from 'jszip';

export type OutputFormat = 'auto' | 'webp' | 'jpeg' | 'png';
export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface ShrinkSettings {
  format: OutputFormat;
  maxSize: 'original' | 2400 | 1600 | 1200 | 800;
  quality: number;
  targetEnabled: boolean;
  targetKb: number;
  stripMetadata: boolean;
}

export interface DecodedImage {
  image: ImageBitmap;
  width: number;
  height: number;
}

export interface ShrinkResult {
  blob: Blob;
  filename: string;
  outputFormat: Exclude<OutputFormat, 'auto'>;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
  encodedQuality?: number;
  metTarget: boolean;
}

export interface ImageJob {
  id: string;
  file: File;
  previewUrl: string;
  outputName: string;
  outputPreviewUrl?: string;
  status: JobStatus;
  originalWidth?: number;
  originalHeight?: number;
  result?: ShrinkResult;
  error?: string;
}

const MIME_BY_FORMAT = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
} as const;

const EXT_BY_FORMAT = {
  webp: 'webp',
  jpeg: 'jpg',
  png: 'png',
} as const;

const WEBP_METADATA_CHUNKS = new Set(['ICCP', 'EXIF', 'XMP ']);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'iCCP', 'tEXt', 'zTXt', 'iTXt', 'cHRM', 'gAMA', 'sRGB', 'pHYs', 'tIME']);
const MIN_LOSSY_QUALITY = 45;
const MIN_TARGET_EDGE = 320;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function bytesToLabel(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function savingsPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) {
    return 0;
  }

  return Math.round(((originalBytes - outputBytes) / originalBytes) * 100);
}

export function targetBytes(settings: Pick<ShrinkSettings, 'targetEnabled' | 'targetKb'>): number | undefined {
  if (!settings.targetEnabled || !Number.isFinite(settings.targetKb) || settings.targetKb <= 0) {
    return undefined;
  }

  return Math.round(settings.targetKb * 1024);
}

export function pickOutputFormat(file: File, requested: OutputFormat): Exclude<OutputFormat, 'auto'> {
  if (requested !== 'auto') {
    return requested;
  }

  if (file.type === 'image/png') {
    return 'png';
  }

  return 'webp';
}

export function defaultOutputName(inputName: string): string {
  return `${baseNameFromInput(inputName)}-shrunk`;
}

export function outputFilename(
  inputName: string,
  format: Exclude<OutputFormat, 'auto'>,
  outputName?: string,
): string {
  const baseName = sanitizeOutputName(outputName) || defaultOutputName(inputName);
  return `${baseName}.${EXT_BY_FORMAT[format]}`;
}

export function fitDimensions(
  width: number,
  height: number,
  maxSize: ShrinkSettings['maxSize'],
): { width: number; height: number } {
  if (maxSize === 'original') {
    return { width, height };
  }

  const ratio = Math.min(1, maxSize / width, maxSize / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function loadImage(file: File): Promise<DecodedImage> {
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    image,
    width: image.width,
    height: image.height,
  };
}

export async function shrinkImage(file: File, settings: ShrinkSettings, outputName?: string): Promise<ShrinkResult> {
  if (!isImageFile(file)) {
    throw new Error('Only image files are supported.');
  }

  const decoded = await loadImage(file);
  const outputFormat = pickOutputFormat(file, settings.format);
  const startingDimensions = fitDimensions(decoded.width, decoded.height, settings.maxSize);
  const target = targetBytes(settings);
  const encoded = await encodeToTarget(decoded, outputFormat, startingDimensions, settings.quality, target);
  const blob = settings.stripMetadata ? await stripEncodedMetadata(encoded.blob, outputFormat) : encoded.blob;
  decoded.image.close();

  return {
    blob,
    filename: outputFilename(file.name, outputFormat, outputName),
    outputFormat,
    originalWidth: decoded.width,
    originalHeight: decoded.height,
    width: encoded.width,
    height: encoded.height,
    originalBytes: file.size,
    outputBytes: blob.size,
    encodedQuality: encoded.quality,
    metTarget: target === undefined || blob.size <= target,
  };
}

export async function stripEncodedMetadata(
  blob: Blob,
  format: Exclude<OutputFormat, 'auto'>,
): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const stripped =
    format === 'webp' ? stripWebpMetadata(bytes) : format === 'png' ? stripPngMetadata(bytes) : stripJpegMetadata(bytes);

  return new Blob([arrayBufferFromBytes(stripped)], { type: MIME_BY_FORMAT[format] });
}

export async function zipResults(results: ShrinkResult[]): Promise<Blob> {
  const zip = new JSZip();
  results.forEach((result) => {
    zip.file(result.filename, result.blob);
  });
  return zip.generateAsync({ type: 'blob' });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('This browser could not encode the image.'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function encodeToTarget(
  decoded: DecodedImage,
  format: Exclude<OutputFormat, 'auto'>,
  startingDimensions: { width: number; height: number },
  startingQuality: number,
  target: number | undefined,
): Promise<{ blob: Blob; width: number; height: number; quality?: number }> {
  const lossy = format !== 'png';
  const initialQuality = lossy ? clampQuality(startingQuality) : undefined;
  let dimensions = startingDimensions;
  let best = await encodeAt(decoded, format, dimensions, initialQuality);

  if (!target || best.blob.size <= target) {
    return best;
  }

  if (lossy) {
    for (let quality = initialQuality! - 5; quality >= MIN_LOSSY_QUALITY; quality -= 5) {
      const candidate = await encodeAt(decoded, format, dimensions, quality);
      best = smallerOutput(best, candidate);
      if (candidate.blob.size <= target) {
        return candidate;
      }
    }
  }

  while (best.blob.size > target && Math.max(dimensions.width, dimensions.height) > MIN_TARGET_EDGE) {
    dimensions = {
      width: Math.max(1, Math.round(dimensions.width * 0.9)),
      height: Math.max(1, Math.round(dimensions.height * 0.9)),
    };

    const candidate = await encodeAt(decoded, format, dimensions, lossy ? best.quality : undefined);
    best = smallerOutput(best, candidate);
    if (candidate.blob.size <= target) {
      return candidate;
    }
  }

  return best;
}

async function encodeAt(
  decoded: DecodedImage,
  format: Exclude<OutputFormat, 'auto'>,
  dimensions: { width: number; height: number },
  quality: number | undefined,
): Promise<{ blob: Blob; width: number; height: number; quality?: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext('2d', { alpha: format !== 'jpeg' });
  if (!context) {
    throw new Error('This browser could not create an image canvas.');
  }

  if (format === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  context.drawImage(decoded.image, 0, 0, dimensions.width, dimensions.height);

  return {
    blob: await canvasToBlob(canvas, MIME_BY_FORMAT[format], (quality ?? 100) / 100),
    width: dimensions.width,
    height: dimensions.height,
    quality,
  };
}

function smallerOutput<T extends { blob: Blob }>(current: T, candidate: T): T {
  return candidate.blob.size < current.blob.size ? candidate : current;
}

function clampQuality(quality: number): number {
  return Math.min(100, Math.max(MIN_LOSSY_QUALITY, Math.round(quality)));
}

function baseNameFromInput(inputName: string): string {
  return inputName.replace(/\.[^/.]+$/, '') || 'image';
}

function sanitizeOutputName(outputName: string | undefined): string {
  if (!outputName) {
    return '';
  }

  return outputName
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return bytes;
  }

  const chunks: Uint8Array[] = [bytes.slice(0, 12)];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = offset + 8 + paddedSize;

    if (chunkEnd > bytes.length) {
      return bytes;
    }

    if (!WEBP_METADATA_CHUNKS.has(chunkType)) {
      const chunk = bytes.slice(offset, chunkEnd);
      if (chunkType === 'VP8X' && chunkSize >= 1) {
        chunk[8] = chunk[8] & ~0x2c;
      }
      chunks.push(chunk);
    }

    offset = chunkEnd;
  }

  const stripped = concatBytes(chunks);
  writeUint32LE(stripped, 4, stripped.length - 8);
  return stripped;
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return bytes;
  }

  const chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const chunkLength = readUint32BE(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + chunkLength;

    if (chunkEnd > bytes.length) {
      return bytes;
    }

    if (!PNG_METADATA_CHUNKS.has(chunkType)) {
      chunks.push(bytes.slice(offset, chunkEnd));
    }

    offset = chunkEnd;
    if (chunkType === 'IEND') {
      break;
    }
  }

  return concatBytes(chunks);
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }

  const segments: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      segments.push(bytes.slice(offset));
      break;
    }

    while (bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xda) {
      segments.push(bytes.slice(offset - 2));
      break;
    }

    if (marker === 0xd9) {
      segments.push(new Uint8Array([0xff, marker]));
      break;
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      segments.push(new Uint8Array([0xff, marker]));
      continue;
    }

    if (offset + 2 > bytes.length) {
      return bytes;
    }

    const segmentLength = readUint16BE(bytes, offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) {
      return bytes;
    }

    const isAppSegment = marker >= 0xe0 && marker <= 0xef;
    const isCommentSegment = marker === 0xfe;
    if (!isAppSegment && !isCommentSegment) {
      segments.push(bytes.slice(offset - 2, segmentEnd));
    }

    offset = segmentEnd;
  }

  return concatBytes(segments);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });

  return result;
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
