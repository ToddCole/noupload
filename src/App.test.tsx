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
    expect(screen.getByRole('link', { name: /Open Meta Stripper/i })).toHaveAttribute('href', '/meta-stripper');
    expect(screen.getByRole('link', { name: /Open Image Compressor/i })).toHaveAttribute('href', '/compress');
  });

  it('renders Image Meta Stripper at /meta-stripper', () => {
    window.history.replaceState({}, '', '/meta-stripper');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Image Meta Stripper' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check images/i })).toBeDisabled();
    expect(document.title).toBe('Image Meta Stripper - Strip Image Metadata Locally | NoUpload');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://noupload.services/meta-stripper',
    );
  });

  it('renders Image Meta Stripper with a trailing slash', () => {
    window.history.replaceState({}, '', '/meta-stripper/');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Image Meta Stripper' })).toBeInTheDocument();
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://noupload.services/meta-stripper',
    );
  });

  it('keeps the old privacy-check route working as an alias', () => {
    window.history.replaceState({}, '', '/privacy-check');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Image Meta Stripper' })).toBeInTheDocument();
  });

  it('renders Image Compressor at /compress', () => {
    window.history.replaceState({}, '', '/compress');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Image Compressor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Develop/i })).toBeDisabled();
    expect(document.title).toBe('Image Compressor - Compress Images Locally | NoUpload');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://noupload.services/compress',
    );
  });
});
