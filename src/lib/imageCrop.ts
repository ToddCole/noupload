import JSZip from 'jszip';
import { loadImage, outputFilename, stripEncodedMetadata, type DecodedImage } from './imageShrink';

export type CropFormat = 'webp' | 'jpeg' | 'png';
export interface CropPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  format: CropFormat;
  quality: number;
  targetKb: number | null;
}
export interface CropRect { x: number; y: number; width: number; height: number }
export interface CropExport {
  presetId: string;
  filename: string;
  blob: Blob;
  width: number;
  height: number;
  metTarget: boolean;
}
export const STORAGE_KEY = 'noupload.crop.v1';
export const DEFAULT_PRESETS: CropPreset[] = [
  { id: 'featured', name: 'Featured', width: 1200, height: 675, format: 'webp', quality: 82, targetKb: null },
  { id: 'article', name: 'Article', width: 1600, height: 900, format: 'webp', quality: 82, targetKb: null },
  { id: 'square', name: 'Square', width: 1080, height: 1080, format: 'jpeg', quality: 82, targetKb: null },
  { id: 'portrait', name: 'Portrait', width: 1080, height: 1350, format: 'jpeg', quality: 82, targetKb: null },
  { id: 'story', name: 'Story', width: 1080, height: 1920, format: 'jpeg', quality: 82, targetKb: null },
];
export function validPreset(p: CropPreset): boolean {
  return typeof p.id === 'string' && !!p.id && typeof p.name === 'string' && !!p.name.trim()
    && [p.width, p.height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)
    && ['webp', 'jpeg', 'png'].includes(p.format)
    && Number.isFinite(p.quality) && p.quality >= 45 && p.quality <= 100
    && (p.targetKb === null || (Number.isFinite(p.targetKb) && p.targetKb > 0));
}
export function readPreferences(raw: string | null): { presets: CropPreset[]; selected: string[] } | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !Array.isArray(value.presets) || value.presets.length !== DEFAULT_PRESETS.length
      || !value.presets.every((p: CropPreset | null) => p && validPreset(p))
      || !DEFAULT_PRESETS.every(p => value.presets.some((v: CropPreset) => v.id === p.id))
      || !Array.isArray(value.selected) || !value.selected.every((id: unknown) => typeof id === 'string')) return null;
    return { presets: value.presets, selected: [...new Set<string>(value.selected)].filter(id => value.presets.some((p: CropPreset) => p.id === id)) };
  } catch { return null; }
}
export function centeredCrop(width: number, height: number, aspect: number): CropRect {
  const cropWidth = Math.min(width, height * aspect);
  const cropHeight = cropWidth / aspect;
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}
export function clampCrop(rect: CropRect, width: number, height: number): CropRect {
  return { ...rect, x: Math.max(0, Math.min(width - rect.width, rect.x)), y: Math.max(0, Math.min(height - rect.height, rect.y)) };
}
export function panCrop(rect: CropRect, dx: number, dy: number, width: number, height: number): CropRect {
  return clampCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, width, height);
}
export function zoomCrop(rect: CropRect, width: number, height: number, zoom: number): CropRect {
  const base = centeredCrop(width, height, rect.width / rect.height);
  const nextWidth = base.width / Math.max(1, Math.min(8, zoom));
  const nextHeight = base.height / Math.max(1, Math.min(8, zoom));
  return clampCrop({ x: rect.x + (rect.width - nextWidth) / 2, y: rect.y + (rect.height - nextHeight) / 2, width: nextWidth, height: nextHeight }, width, height);
}
export async function loadCropImage(file: File): Promise<DecodedImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  try { return await loadImage(file); } catch { throw new Error('This image could not be opened. Try another JPEG, PNG or WebP file.'); }
}
export function cropFilenames(base: string, presets: CropPreset[]): string[] {
  const used = new Set<string>();
  return presets.map(p => {
    const stem = `${base.trim() || 'image'}-${p.name}-${p.width}x${p.height}`;
    let name = outputFilename('image', p.format, stem);
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = outputFilename('image', p.format, `${stem}-${suffix++}`);
    used.add(name.toLowerCase());
    return name;
  });
}
export async function exportCrop(decoded: DecodedImage, rect: CropRect, preset: CropPreset, filename: string): Promise<CropExport> {
  if (!validPreset(preset)) throw new Error('Enter a name and whole-number dimensions between 1 and 4096.');
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0
    || rect.x < 0 || rect.y < 0 || rect.x + rect.width > decoded.width + 0.01 || rect.y + rect.height > decoded.height + 0.01
    || Math.abs(rect.width / rect.height - preset.width / preset.height) > 0.001) throw new Error('The crop is outside the image or has the wrong proportions. Reset this crop.');
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  try {
    const context = canvas.getContext('2d', { alpha: preset.format !== 'jpeg' });
    if (!context) throw new Error('This browser could not create an image canvas.');
    if (preset.format === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.image, rect.x, rect.y, rect.width, rect.height, 0, 0, preset.width, preset.height);
    const mime = `image/${preset.format}`;
    const encode = async (quality: number) => {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image export failed. Try smaller dimensions.')), mime, quality / 100));
      if (blob.type !== mime) throw new Error(`This browser cannot export ${preset.format.toUpperCase()}. Choose another format.`);
      return stripEncodedMetadata(blob, preset.format);
    };
    let blob = await encode(preset.quality);
    const target = preset.targetKb === null ? null : preset.targetKb * 1024;
    if (target && preset.format !== 'png') {
      let quality = preset.quality;
      while (blob.size > target && quality > 45) {
        quality = Math.max(45, quality - 5);
        const next = await encode(quality);
        if (next.size < blob.size) blob = next;
      }
    }
    return { presetId: preset.id, filename, blob, width: preset.width, height: preset.height, metTarget: target === null || blob.size <= target };
  } finally { canvas.width = 0; canvas.height = 0; }
}
export async function zipCrops(results: CropExport[]): Promise<Blob> {
  const zip = new JSZip();
  for (const result of results) zip.file(result.filename, result.blob);
  return zip.generateAsync({ type: 'blob' });
}
