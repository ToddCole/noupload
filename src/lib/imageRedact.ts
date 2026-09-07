import { stripEncodedMetadata } from './imageShrink';

export type RedactionMode = 'black' | 'blur' | 'pixelate';

export interface RedactionRect {
  id: string;
  mode: RedactionMode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DraftRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MIN_RECT_SIZE = 0.01;

export function normalizeRedactionRect(draft: DraftRect, mode: RedactionMode, id: string): RedactionRect | null {
  const x = clamp01(Math.min(draft.startX, draft.currentX));
  const y = clamp01(Math.min(draft.startY, draft.currentY));
  const right = clamp01(Math.max(draft.startX, draft.currentX));
  const bottom = clamp01(Math.max(draft.startY, draft.currentY));
  const width = right - x;
  const height = bottom - y;

  if (width < MIN_RECT_SIZE || height < MIN_RECT_SIZE) {
    return null;
  }

  return {
    id,
    mode,
    x,
    y,
    width,
    height,
  };
}

export function rectToPercentStyle(rect: Pick<RedactionRect, 'x' | 'y' | 'width' | 'height'>): Record<string, string> {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

export async function redactImage(
  file: File,
  rects: RedactionRect[],
): Promise<{ blob: Blob; filename: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Image Redactor supports image files only.');
  }

  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  if (!context) {
    image.close();
    throw new Error('This browser could not create an image canvas.');
  }

  context.drawImage(image, 0, 0);
  rects.forEach((rect) => applyRedaction(context, canvas, rect));
  image.close();

  const encoded = await canvasToBlob(canvas, 'image/jpeg', 0.95);
  const stripped = await stripEncodedMetadata(encoded, 'jpeg');

  return {
    blob: stripped,
    filename: 'redacted-image.jpg',
    width: canvas.width,
    height: canvas.height,
  };
}

function applyRedaction(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rect: RedactionRect): void {
  const x = Math.round(rect.x * canvas.width);
  const y = Math.round(rect.y * canvas.height);
  const width = Math.max(1, Math.round(rect.width * canvas.width));
  const height = Math.max(1, Math.round(rect.height * canvas.height));

  if (rect.mode === 'black') {
    context.fillStyle = '#05070d';
    context.fillRect(x, y, width, height);
    return;
  }

  const region = document.createElement('canvas');
  region.width = width;
  region.height = height;
  const regionContext = region.getContext('2d');
  if (!regionContext) {
    context.fillStyle = '#05070d';
    context.fillRect(x, y, width, height);
    return;
  }

  regionContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  if (rect.mode === 'blur') {
    context.save();
    context.filter = 'blur(18px)';
    context.drawImage(region, x, y, width, height);
    context.restore();
    return;
  }

  const pixelSize = Math.max(8, Math.round(Math.min(width, height) / 16));
  const smallWidth = Math.max(1, Math.ceil(width / pixelSize));
  const smallHeight = Math.max(1, Math.ceil(height / pixelSize));
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = smallWidth;
  pixelCanvas.height = smallHeight;
  const pixelContext = pixelCanvas.getContext('2d');

  if (!pixelContext) {
    context.fillStyle = '#05070d';
    context.fillRect(x, y, width, height);
    return;
  }

  pixelContext.imageSmoothingEnabled = false;
  pixelContext.drawImage(region, 0, 0, smallWidth, smallHeight);
  context.imageSmoothingEnabled = false;
  context.drawImage(pixelCanvas, 0, 0, smallWidth, smallHeight, x, y, width, height);
  context.imageSmoothingEnabled = true;
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
