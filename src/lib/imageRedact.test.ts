import { describe, expect, it } from 'vitest';
import { normalizeRedactionRect, rectToPercentStyle } from './imageRedact';

describe('image redaction helpers', () => {
  it('normalizes drag direction into a redaction rectangle', () => {
    expect(
      normalizeRedactionRect(
        {
          startX: 0.8,
          startY: 0.7,
          currentX: 0.2,
          currentY: 0.3,
        },
        'black',
        'rect-1',
      ),
    ).toEqual({
      id: 'rect-1',
      mode: 'black',
      x: 0.2,
      y: 0.3,
      width: 0.6000000000000001,
      height: 0.39999999999999997,
    });
  });

  it('clamps redaction rectangles to the image bounds', () => {
    expect(
      normalizeRedactionRect(
        {
          startX: -0.2,
          startY: 0.25,
          currentX: 1.4,
          currentY: 1.1,
        },
        'pixelate',
        'rect-2',
      ),
    ).toEqual({
      id: 'rect-2',
      mode: 'pixelate',
      x: 0,
      y: 0.25,
      width: 1,
      height: 0.75,
    });
  });

  it('ignores tiny accidental drags', () => {
    expect(
      normalizeRedactionRect(
        {
          startX: 0.1,
          startY: 0.1,
          currentX: 0.105,
          currentY: 0.105,
        },
        'blur',
        'rect-3',
      ),
    ).toBeNull();
  });

  it('converts redaction rectangles to percentage styles', () => {
    expect(rectToPercentStyle({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      left: '10%',
      top: '20%',
      width: '30%',
      height: '40%',
    });
  });
});
