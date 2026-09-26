import { afterEach, describe, expect, it, vi } from 'vitest';
import { centeredCrop, clampCrop, cropFilenames, DEFAULT_PRESETS, exportCrop, loadCropImage, panCrop, readPreferences, validPreset, zoomCrop } from './imageCrop';

afterEach(() => vi.restoreAllMocks());

describe('crop geometry and preferences', () => {
  it('centres landscape and portrait crops inside the source', () => {
    expect(centeredCrop(1600, 900, 1)).toEqual({ x: 350, y: 0, width: 900, height: 900 });
    const portrait = centeredCrop(1600, 900, 9 / 16);
    expect(portrait.height).toBe(900);
    expect(portrait.width / portrait.height).toBeCloseTo(9 / 16);
  });
  it('clamps panning to all source boundaries', () => {
    const rect = centeredCrop(1600, 900, 1);
    expect(panCrop(rect, -10000, 10000, 1600, 900)).toEqual({ ...rect, x: 0, y: 0 });
    expect(panCrop(rect, 10000, -10000, 1600, 900)).toEqual({ ...rect, x: 700, y: 0 });
  });
  it('zooms around the crop centre and preserves bounds on zooming out', () => {
    const rect = centeredCrop(1600, 900, 1);
    expect(zoomCrop(rect, 1600, 900, 2)).toEqual({ x: 575, y: 225, width: 450, height: 450 });
    const edge = { x: 0, y: 0, width: 450, height: 450 };
    expect(zoomCrop(edge, 1600, 900, 1)).toEqual({ x: 0, y: 0, width: 900, height: 900 });
    expect(clampCrop(rect, 1600, 900)).toEqual(rect);
  });
  it('validates settings and rejects malformed saved data', () => {
    expect(validPreset(DEFAULT_PRESETS[0])).toBe(true);
    for (const patch of [{ width: 0 }, { height: 4097 }, { width: 1.5 }, { targetKb: -1 }, { quality: 44 }, { name: '' }]) {
      expect(validPreset({ ...DEFAULT_PRESETS[0], ...patch })).toBe(false);
    }
    expect(readPreferences('{bad')).toBeNull();
    expect(readPreferences(JSON.stringify({ presets: [null], selected: [] }))).toBeNull();
    const saved = { presets: DEFAULT_PRESETS, selected: ['square', 'square', 'missing'] };
    expect(readPreferences(JSON.stringify(saved))?.selected).toEqual(['square']);
  });
  it('uses unique safe filenames even for identical preset names', () => {
    const preset = { ...DEFAULT_PRESETS[0], name: 'Front / page' };
    expect(cropFilenames('my photo', [preset, preset])).toEqual(['my-photo-Front-page-1200x675.webp', 'my-photo-Front-page-1200x675-2.webp']);
  });
  it('rejects unsupported sources before decoding', async () => {
    await expect(loadCropImage(new File(['x'], 'photo.gif', { type: 'image/gif' }))).rejects.toThrow('JPEG, PNG or WebP');
  });
});

describe('fixed-dimension crop export', () => {
  it('uses the source rectangle and keeps output dimensions when the target cannot be met', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const dimensions: number[][] = [];
    const qualities: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
      dimensions.push([this.width, this.height]); qualities.push(quality!);
      const blob = new Blob([new Uint8Array(4000)], { type });
      Object.defineProperty(blob, 'arrayBuffer', { value: async () => new ArrayBuffer(4000) });
      callback(blob);
    });
    const bitmap = {} as ImageBitmap;
    const preset = { ...DEFAULT_PRESETS[0], targetKb: 1 };
    const rect = centeredCrop(2400, 1600, 1200 / 675);
    const result = await exportCrop({ image: bitmap, width: 2400, height: 1600 }, rect, preset, 'photo.webp');
    expect(drawImage).toHaveBeenCalledWith(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, 1200, 675);
    expect(dimensions.every(([w, h]) => w === 1200 && h === 675)).toBe(true);
    expect(qualities[qualities.length - 1]).toBe(0.45);
    expect(result.metTarget).toBe(false);
    expect(result.width).toBe(1200);
  });
  it('reports unsupported encoders instead of mislabelling PNG as WebP', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })));
    await expect(exportCrop({ image: {} as ImageBitmap, width: 1600, height: 900 }, centeredCrop(1600, 900, 16 / 9), DEFAULT_PRESETS[0], 'x.webp')).rejects.toThrow('cannot export WEBP');
  });
});
