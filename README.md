# NoUpload

Private image tools that run entirely in your browser. NoUpload helps people inspect and strip image metadata, redact sensitive areas, and compress images without uploading the original files.

Image processing happens on-device via browser APIs and `<canvas>`. Your images are not uploaded, stored, or processed on a NoUpload server.

## Features

- **Image Meta Stripper** — inspect common image metadata, show the detected fields, and download a cleaned copy
- **Image Redactor** — draw areas over sensitive content using black, blur, or pixelate modes, then export a flattened JPEG
- **Image Compressor** — batch resize and compress JPEG, PNG, and WebP files locally
- Drag-and-drop or file-picker workflows
- Metadata stripping during supported exports
- Per-image preview and download
- Download compressor results individually or as a zip

## Routes

- `/` — suite home
- `/meta-stripper` — image metadata inspection and cleaning
- `/redact` — manual image redaction
- `/compress` — image resizing and compression

The old `/privacy-check` path remains as an alias for `/meta-stripper`.

## Privacy and analytics

NoUpload does not send image blobs, filenames, metadata values, file sizes, dimensions, or file counts to analytics. File inspection and processing do not make external requests.

Google Analytics records normal page views and one aggregate custom event after a successful download:

```text
image_export
tool: meta_stripper | redactor | compressor
```

The event measures completed tool usage only. Selecting a file, inspecting metadata, drawing a redaction area, or starting a failed operation does not send a custom usage event.

GA4 account configuration is manual. After deployment, confirm `image_export` in Realtime, register the `tool` event parameter as a custom dimension if tool-level reporting is needed, and mark `image_export` as a key event when appropriate. Use UTM-tagged links for advertising campaign attribution.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL and choose a tool. All three tools process files locally in the browser.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run test` — run the test suite

Before shipping, run:

```bash
npm test
npm run build
git diff --check
```
