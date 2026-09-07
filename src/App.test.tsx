import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.stubGlobal('scrollTo', vi.fn());

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('app routes', () => {
  it('renders the suite hub at /', () => {
    window.history.replaceState({}, '', '/');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'NoUpload private file tools' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Privacy Check/i })).toHaveAttribute('href', '/privacy-check');
    expect(screen.getByRole('link', { name: /Open Compressor/i })).toHaveAttribute('href', '/compress');
  });

  it('renders Privacy Check at /privacy-check', () => {
    window.history.replaceState({}, '', '/privacy-check');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Image Privacy Check' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check images/i })).toBeDisabled();
  });

  it('renders Photo Compressor at /compress', () => {
    window.history.replaceState({}, '', '/compress');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Photo Compressor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Develop/i })).toBeDisabled();
  });
});
