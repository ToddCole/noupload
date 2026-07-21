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
  decoded.image.close();

  return {
    blob: encoded.blob,
    filename: outputFilename(file.name, outputFormat, outputName),
    outputFormat,
    originalWidth: decoded.width,
    originalHeight: decoded.height,
    width: encoded.width,
    height: encoded.height,
    originalBytes: file.size,
    outputBytes: encoded.blob.size,
    encodedQuality: encoded.quality,
    metTarget: target === undefined || encoded.blob.size <= target,
  };
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
