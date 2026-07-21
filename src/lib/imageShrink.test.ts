import { describe, expect, it } from 'vitest';
import {
  bytesToLabel,
  defaultOutputName,
  fitDimensions,
  outputFilename,
  pickOutputFormat,
  savingsPercent,
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
});
