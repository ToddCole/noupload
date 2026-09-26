# NoUpload

Private image tools that run entirely in your browser. NoUpload helps people inspect and strip image metadata, redact sensitive areas, and compress images without uploading the original files.

Image processing happens on-device via browser APIs and `<canvas>`. Your images are not uploaded, stored, or processed on a NoUpload server.

## Crop & Resize — daily image workspace

Open `/crop` to prepare one photo for several destinations. Drop or paste a JPEG, PNG or WebP, select output presets, and drag/zoom each crop independently. Use arrow keys on the preview for precise positioning (Shift moves faster).

Starter presets: Featured 1200×675 and Article 1600×900 in WebP; Square 1080×1080, Portrait 1080×1350 and Story 1080×1920 in JPEG. Edit each preset's name, dimensions, format, quality or optional target KB. Dimensions must be whole numbers from 1 to 4096 pixels per edge. Presets and selections are saved in this browser; source images are held only in memory.

Click **Prepare versions**, then download individual files or **Download selected ZIP**. Filenames include the preset and dimensions, with collision suffixes when necessary. Output dimensions stay exact even when a file-size target cannot be met; the result shows that it is over target. JPEG/WebP quality can decrease to 45 to meet a target. PNG remains lossless. Small crops may be enlarged, with a warning; JPEG exports flatten transparency onto white. Replacing the source clears crops and exports while retaining preferences.

The crop editor is in `src/components/CropWorkspace.tsx`; geometry and export helpers are in `src/lib/imageCrop.ts`. `/crop` is registered in Vite, prerendering, route metadata and Vercel rewrites. No additional runtime dependency or backend is required.

### Implementation verification (2026-09-26)

The crop addition passed 47 Vitest tests, the production build/prerender, and `git diff --check`. Real Chrome checks covered five export formats/sizes, crop pixel accuracy, ZIP contents and download, EXIF rotation, transparency, an unattainable size target, corrupt input, small-source warnings, pointer dragging, stale-export removal, a 390px mobile layout, and a direct production `/crop/` load/export with the configured CSP. Changes are local; production has not been deployed.

## Features

- **Share-Safe Image Cleaner** — inspect an image, create a cleaned copy, and inspect the exported blob again before sharing
- **Image Meta Stripper** — inspect common image metadata, show the detected fields, and download a cleaned copy
- **Image Redactor** — draw areas over sensitive content using black, blur, or pixelate modes, then export a flattened JPEG
- **Image Compressor** — batch resize and compress JPEG, PNG, and WebP files locally
- Drag-and-drop or file-picker workflows
- Metadata stripping during supported exports
- Per-image preview and download
- Download compressor results individually or as a zip

## Routes

- `/` — suite home
- `/crop` — crop one image into saved web/social sizes and export individual files or a ZIP
- `/share-safe` — inspect, clean, and verify an image before sharing
- `/remove-gps-from-photo` — check and remove GPS location metadata from photos
- `/meta-stripper` — image metadata inspection and cleaning
- `/redact` — manual image redaction
- `/compress` — image resizing and compression

The old `/privacy-check` path remains as an alias for `/meta-stripper`.

Share-Safe verification checks the exported file for remaining sensitive categories such as location, device, dates,
author, software, and embedded preview data. Some structural fields can be recreated by a browser encoder, including
dimensions, format, alpha, and colour profile information; those are reported separately and are not treated as
personal metadata findings.

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

Open the printed local URL and choose a tool. All four workflows process files locally in the browser.

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
