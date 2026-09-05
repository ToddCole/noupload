# NoUpload

Big photos in, tiny files out. A local, in-browser tool for squishing oversized images — Shutterstock exports, camera dumps, whatever — down to web-friendly sizes.

Image processing happens on-device via `<canvas>`. Your images are not uploaded, stored, or processed on a server.

## Features

- Drag-and-drop or file-picker batch upload
- Output format: Auto, WebP, JPEG, or PNG
- Max edge resizing (800 / 1200 / 1600 / 2400px, or original)
- Quality slider, or aim for a target file size (KB) and let it iterate down to fit
- Strip metadata
- Per-image rename, preview (original vs. optimized), and download
- Download everything at once as a zip

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL, drop in some images, and hit **Squish**.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run test` — run the test suite
