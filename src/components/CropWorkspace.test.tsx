import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropWorkspace } from './CropWorkspace';
import { DEFAULT_PRESETS, exportCrop, STORAGE_KEY } from '../lib/imageCrop';

vi.mock('../lib/imageCrop', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/imageCrop')>(),
  loadCropImage: vi.fn(async () => ({ image: { close: vi.fn() }, width: 2400, height: 1600 })),
  exportCrop: vi.fn(async (_image, _rect, preset, filename) => ({ presetId: preset.id, filename, blob: new Blob(['image']), width: preset.width, height: preset.height, metTarget: true })),
}));
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const upload = (name = 'photo.jpg') => fireEvent.change(screen.getByLabelText('Choose source image'), { target: { files: [new File(['image'], name, { type: 'image/jpeg' })] } });

describe('crop workspace', () => {
  it('restores saved presets and export selections', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets: DEFAULT_PRESETS.map(p => p.id === 'featured' ? { ...p, width: 1400 } : p), selected: ['square'] }));
    render(<CropWorkspace />);
    expect(screen.getByLabelText('Width')).toHaveValue(1400);
    expect(screen.getByLabelText('Export Square')).toBeChecked();
    expect(screen.getByLabelText('Export Featured')).not.toBeChecked();
  });
  it('preserves independent crops and invalidates old exports after editing or replacing a source', async () => {
    render(<CropWorkspace />); upload();
    await screen.findByLabelText('Zoom');
    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Square 1080/ }));
    expect(screen.getByLabelText('Zoom')).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: /Featured 1200/ }));
    expect(screen.getByLabelText('Zoom')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Prepare 1 version' }));
    await screen.findByRole('heading', { name: 'Ready to download' });
    expect(vi.mocked(exportCrop).mock.calls[0][1].width).toBe(1200);
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '1000' } });
    expect(screen.queryByRole('heading', { name: 'Ready to download' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare 1 version' }));
    await screen.findByRole('heading', { name: 'Ready to download' });
    upload('second.jpg');
    await waitFor(() => expect(screen.getByLabelText('Filename')).toHaveValue('second'));
    expect(screen.getByLabelText('Zoom')).toHaveValue('1');
    expect(screen.getByLabelText('Width')).toHaveValue(1000);
    expect(screen.queryByRole('heading', { name: 'Ready to download' })).not.toBeInTheDocument();
  });
  it('disables export for invalid dimensions', async () => {
    render(<CropWorkspace />); upload(); await screen.findByLabelText('Zoom');
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '5000' } });
    expect(screen.getByRole('button', { name: 'Prepare 1 version' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('4096');
  });
});
