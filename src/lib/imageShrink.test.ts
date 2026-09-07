import { describe, expect, it } from 'vitest';
import {
  bytesToLabel,
  defaultOutputName,
  fitDimensions,
  outputFilename,
  pickOutputFormat,
  savingsPercent,
  stripEncodedMetadata,
  targetBytes,
} from './imageShrink';

function file(name: string, type: string): File {
  return new File(['content'], name, { type });
}

describe('image shrink helpers', () => {
  it('formats byte labels', () => {
    expect(bytesToLabel(512)).toBe('512 B');
    expect(bytesToLabel(1536)).toBe('1.5 KB');
    expect(bytesToLabel(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('calculates savings percentage', () => {
    expect(savingsPercent(1000, 250)).toBe(75);
    expect(savingsPercent(0, 250)).toBe(0);
  });

  it('calculates an optional byte target', () => {
    expect(targetBytes({ targetEnabled: true, targetKb: 250 })).toBe(256000);
    expect(targetBytes({ targetEnabled: false, targetKb: 250 })).toBeUndefined();
    expect(targetBytes({ targetEnabled: true, targetKb: Number.NaN })).toBeUndefined();
  });

  it('chooses output formats', () => {
    expect(pickOutputFormat(file('photo.jpg', 'image/jpeg'), 'auto')).toBe('webp');
    expect(pickOutputFormat(file('logo.png', 'image/png'), 'auto')).toBe('png');
    expect(pickOutputFormat(file('photo.jpg', 'image/jpeg'), 'jpeg')).toBe('jpeg');
  });

  it('creates shrunk filenames with the selected extension', () => {
    expect(outputFilename('hero.photo.jpg', 'webp')).toBe('hero.photo-shrunk.webp');
    expect(outputFilename('logo', 'png')).toBe('logo-shrunk.png');
    expect(outputFilename('.hidden', 'jpeg')).toBe('image-shrunk.jpg');
  });

  it('creates renamed output filenames safely', () => {
    expect(defaultOutputName('Hero Shot.JPG')).toBe('Hero Shot-shrunk');
    expect(outputFilename('hero.jpg', 'webp', 'home page hero')).toBe('home-page-hero.webp');
    expect(outputFilename('hero.jpg', 'jpeg', 'folder/bad:name.png')).toBe('folder-bad-name.jpg');
    expect(outputFilename('hero.jpg', 'png', '   ')).toBe('hero-shrunk.png');
  });

  it('fits dimensions without upscaling', () => {
    expect(fitDimensions(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 });
    expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitDimensions(600, 1800, 1200)).toEqual({ width: 400, height: 1200 });
    expect(fitDimensions(600, 400, 'original')).toEqual({ width: 600, height: 400 });
  });

  it('strips WebP ICC, EXIF, and XMP chunks after canvas encoding', async () => {
    const webp = bytes([
      ...text('RIFF'),
      0, 0, 0, 0,
      ...text('WEBP'),
      ...chunk('VP8X', [0x2c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...chunk('ICCP', [1, 2, 3, 4]),
      ...chunk('EXIF', [5, 6, 7, 8]),
      ...chunk('XMP ', [9, 10, 11, 12]),
      ...chunk('VP8 ', [13, 14, 15, 16]),
    ]);
    writeUint32LE(webp, 4, webp.length - 8);

    const stripped = await blobBytes(await stripEncodedMetadata(new Blob([arrayBufferFromBytes(webp)], { type: 'image/webp' }), 'webp'));
    const content = ascii(stripped);

    expect(content).toContain('VP8X');
    expect(content).toContain('VP8 ');
    expect(content).not.toContain('ICCP');
    expect(content).not.toContain('EXIF');
    expect(content).not.toContain('XMP ');
    expect(stripped[20]).toBe(0);
    expect(readUint32LE(stripped, 4)).toBe(stripped.length - 8);
  });

  it('strips PNG metadata chunks while preserving image chunks', async () => {
    const png = bytes([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...pngChunk('IHDR', [1, 2, 3, 4]),
      ...pngChunk('iCCP', [5, 6, 7, 8]),
      ...pngChunk('tEXt', [9, 10, 11, 12]),
      ...pngChunk('IDAT', [13, 14, 15, 16]),
      ...pngChunk('IEND', []),
    ]);

    const stripped = await blobBytes(await stripEncodedMetadata(new Blob([arrayBufferFromBytes(png)], { type: 'image/png' }), 'png'));
    const content = ascii(stripped);

    expect(content).toContain('IHDR');
    expect(content).toContain('IDAT');
    expect(content).toContain('IEND');
    expect(content).not.toContain('iCCP');
    expect(content).not.toContain('tEXt');
  });

  it('strips JPEG APP and comment segments while preserving image data', async () => {
    const jpeg = bytes([
      0xff, 0xd8,
      ...jpegSegment(0xe0, [1, 2, 3, 4]),
      ...jpegSegment(0xe1, [5, 6, 7, 8]),
      ...jpegSegment(0xfe, [9, 10, 11, 12]),
      ...jpegSegment(0xdb, [13, 14, 15, 16]),
      0xff, 0xda, 0x00, 0x02, 0x44, 0x55, 0xff, 0xd9,
    ]);

    const stripped = await blobBytes(await stripEncodedMetadata(new Blob([arrayBufferFromBytes(jpeg)], { type: 'image/jpeg' }), 'jpeg'));

    expect(stripped.slice(0, 2)).toEqual(bytes([0xff, 0xd8]));
    expect(Array.from(stripped)).not.toContain(0xe0);
    expect(Array.from(stripped)).not.toContain(0xe1);
    expect(Array.from(stripped)).not.toContain(0xfe);
    expect(Array.from(stripped)).toContain(0xdb);
    expect(Array.from(stripped)).toContain(0xda);
  });
});

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function text(value: string): number[] {
  return Array.from(value).map((char) => char.charCodeAt(0));
}

function chunk(type: string, data: number[]): number[] {
  return [...text(type), ...uint32LE(data.length), ...data, ...(data.length % 2 ? [0] : [])];
}

function pngChunk(type: string, data: number[]): number[] {
  return [...uint32BE(data.length), ...text(type), ...data, 0, 0, 0, 0];
}

function jpegSegment(marker: number, data: number[]): number[] {
  return [0xff, marker, ...uint16BE(data.length + 2), ...data];
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function arrayBufferFromBytes(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function ascii(value: Uint8Array): string {
  return String.fromCharCode(...value);
}

function uint16BE(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function uint32BE(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function uint32LE(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function readUint32LE(value: Uint8Array, offset: number): number {
  return (value[offset] | (value[offset + 1] << 8) | (value[offset + 2] << 16) | (value[offset + 3] << 24)) >>> 0;
}

function writeUint32LE(value: Uint8Array, offset: number, nextValue: number): void {
  value[offset] = nextValue & 0xff;
  value[offset + 1] = (nextValue >>> 8) & 0xff;
  value[offset + 2] = (nextValue >>> 16) & 0xff;
  value[offset + 3] = (nextValue >>> 24) & 0xff;
}
