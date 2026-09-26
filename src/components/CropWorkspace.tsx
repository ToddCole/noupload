import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, ImagePlus, RotateCcw } from 'lucide-react';
import { bytesToLabel, type DecodedImage } from '../lib/imageShrink';
import { downloadBlob } from '../lib/download';
import { centeredCrop, cropFilenames, DEFAULT_PRESETS, exportCrop, loadCropImage, panCrop, readPreferences, STORAGE_KEY, validPreset, zipCrops, zoomCrop, type CropExport, type CropPreset, type CropRect } from '../lib/imageCrop';
import './CropWorkspace.css';

interface Source extends DecodedImage { name: string }
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function CropPreview({ source, rect, onChange, disabled }: { source: Source; rect: CropRect; onChange: (rect: CropRect) => void; disabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; rect: CropRect } | null>(null);
  // This component only mounts after a file is loaded in the browser.
  useLayoutEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ratio = rect.width / rect.height;
    node.width = Math.max(1, Math.round(ratio >= 1 ? 1000 : 650 * ratio));
    node.height = Math.max(1, Math.round(ratio >= 1 ? 1000 / ratio : 650));
    const context = node.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, node.width, node.height);
    context.drawImage(source.image, rect.x, rect.y, rect.width, rect.height, 0, 0, node.width, node.height);
  }, [source, rect]);
  const zoom = centeredCrop(source.width, source.height, rect.width / rect.height).width / rect.width;
  return <>
    <div className="crop-stage">
      <canvas ref={canvas} className="crop-canvas" tabIndex={disabled ? -1 : 0} role="img"
        aria-label="Crop preview. Drag to position the image, or use arrow keys. Shift plus arrow moves faster."
        onPointerDown={event => {
          if (disabled) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, rect };
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || disabled) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          onChange(panCrop(start.rect, -(event.clientX - start.x) * start.rect.width / bounds.width,
            -(event.clientY - start.y) * start.rect.height / bounds.height, source.width, source.height));
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => {
          if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const step = rect.width / 200 * (event.shiftKey ? 10 : 1);
          onChange(panCrop(rect, event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0,
            event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0, source.width, source.height));
        }} />
    </div>
    <div className="crop-position-controls">
      <label>Zoom <input aria-label="Zoom" type="range" min="1" max="8" step="0.01" value={zoom} disabled={disabled}
        onChange={event => onChange(zoomCrop(rect, source.width, source.height, Number(event.target.value)))} /></label>
      <button className="btn btn-ghost" type="button" disabled={disabled} onClick={() => onChange(centeredCrop(source.width, source.height, rect.width / rect.height))}><RotateCcw size={15} /> Reset crop</button>
    </div>
    <p className="crop-hint">Drag to frame your image. Arrow keys move it; Shift moves faster.</p>
  </>;
}

export function CropWorkspace() {
  const [presets, setPresets] = useState<CropPreset[]>(DEFAULT_PRESETS);
  const [selected, setSelected] = useState<string[]>(['featured']);
  const [activeId, setActiveId] = useState('featured');
  const [source, setSource] = useState<Source | null>(null);
  const sourceRef = useRef<Source | null>(null);
  const [crops, setCrops] = useState<Record<string, CropRect>>({});
  const [baseName, setBaseName] = useState('image');
  const [results, setResults] = useState<CropExport[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const active = presets.find(p => p.id === activeId)!;
  const rect = source && validPreset(active) ? crops[activeId] ?? centeredCrop(source.width, source.height, active.width / active.height) : null;
  const locked = busy || loading;

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = readPreferences(localStorage.getItem(STORAGE_KEY));
      if (saved) { setPresets(saved.presets); setSelected(saved.selected); }
    } catch { setStorageNote('Browser storage is unavailable. Settings will last for this visit only.'); }
    setReady(true);
    return () => { mounted.current = false; generation.current++; sourceRef.current?.image.close(); sourceRef.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !presets.every(validPreset)) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets, selected })); }
    catch { setStorageNote('Could not save settings in this browser. You can still use the tool.'); }
  }, [presets, selected, ready]);

  const addFile = useCallback(async (file?: File) => {
    if (!file || busyRef.current) return;
    const token = ++generation.current;
    setLoading(true); setError(''); setResults([]); setCrops({});
    sourceRef.current?.image.close(); sourceRef.current = null; setSource(null);
    try {
      const decoded = await loadCropImage(file);
      if (!mounted.current || token !== generation.current) { decoded.image.close(); return; }
      const next = { ...decoded, name: file.name };
      sourceRef.current = next; setSource(next);
      setBaseName(file.name.replace(/\.[^.]+$/, '') || 'image');
    } catch (e) { if (mounted.current && token === generation.current) setError(errorText(e)); }
    finally { if (mounted.current && token === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (file) { event.preventDefault(); void addFile(file); }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [addFile]);

  const updatePreset = (patch: Partial<CropPreset>) => {
    setPresets(current => current.map(p => p.id === activeId ? { ...p, ...patch } : p));
    if ('width' in patch || 'height' in patch) setCrops(current => { const next = { ...current }; delete next[activeId]; return next; });
    setResults([]); setError('');
  };
  const selectedPresets = presets.filter(p => selected.includes(p.id));
  const exportImages = async () => {
    if (!source || locked || busyRef.current || !selectedPresets.length || !selectedPresets.every(validPreset)) return;
    busyRef.current = true; setBusy(true); setError(''); setResults([]);
    const token = generation.current;
    try {
      const names = cropFilenames(baseName, selectedPresets);
      const exported: CropExport[] = [];
      for (const [index, preset] of selectedPresets.entries()) {
        if (!mounted.current || token !== generation.current) return;
        const crop = crops[preset.id] ?? centeredCrop(source.width, source.height, preset.width / preset.height);
        exported.push(await exportCrop(source, crop, preset, names[index]));
      }
      if (mounted.current && token === generation.current) setResults(exported);
    } catch (e) { if (mounted.current) setError(errorText(e)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const downloadZip = async () => {
    if (busyRef.current || !results.length) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const blob = await zipCrops(results);
      if (mounted.current) downloadBlob(blob, 'cropped-images.zip');
    } catch (e) { if (mounted.current) setError(errorText(e)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };

  return <section className="crop-workspace wrap" aria-label="Crop and resize workspace"
    onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); void addFile(event.dataTransfer.files[0]); }}>
    <div className="crop-heading"><div><h1>Crop &amp; Resize</h1><p>One photo. Every size you need.</p></div>
      <button type="button" className="btn btn-primary" disabled={locked} onClick={() => input.current?.click()}><ImagePlus size={18} /> {source ? 'Replace image' : 'Choose image'}</button>
      <input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose source image"
        onChange={event => { void addFile(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    {error && <p className="crop-error" role="alert">{error}</p>}
    {storageNote && <p className="crop-hint" role="status">{storageNote}</p>}
    <div className="crop-layout">
      <aside className="crop-panel"><h2>Output sizes</h2><p className="crop-hint">Tick to export. Click a name to adjust its crop.</p>
        <div className="crop-presets">{presets.map(p => <div key={p.id} className={`crop-preset ${activeId === p.id ? 'is-active' : ''}`}>
          <input type="checkbox" aria-label={`Export ${p.name}`} checked={selected.includes(p.id)} disabled={locked} onChange={() => { setSelected(current => current.includes(p.id) ? current.filter(id => id !== p.id) : [...current, p.id]); setResults([]); }} />
          <button type="button" aria-pressed={activeId === p.id} disabled={locked} onClick={() => setActiveId(p.id)}><strong>{p.name || 'Unnamed preset'}</strong>{' '}<span>{p.width || '—'} × {p.height || '—'} · {p.format.toUpperCase()}</span></button>
        </div>)}</div>
        <label className="crop-field">Filename<input value={baseName} disabled={locked} onChange={event => { setBaseName(event.target.value); setResults([]); }} /></label>
        <p className="crop-hint">Preset name and dimensions are added automatically.</p>
        <button type="button" className="btn btn-primary crop-export" disabled={locked || !source || !selectedPresets.length || !selectedPresets.every(validPreset)} onClick={() => void exportImages()}>{busy ? 'Working…' : `Prepare ${selected.length} ${selected.length === 1 ? 'version' : 'versions'}`}</button>
      </aside>
      <div className="crop-editor">
        <div className="crop-editor-title"><h2>{active.name || 'Unnamed preset'}</h2>{source && <span>{source.width} × {source.height} source</span>}</div>
        {loading ? <div className="crop-empty" role="status">Opening image…</div> : source && rect ? <>
          <CropPreview key={activeId} source={source} rect={rect} disabled={locked} onChange={next => { setCrops(current => ({ ...current, [activeId]: next })); setResults([]); }} />
          {(rect.width < active.width || rect.height < active.height) && <p className="crop-warning">This crop will be enlarged to {active.width} × {active.height}; it may look softer.</p>}
        </> : <button type="button" className="crop-empty" disabled={locked} onClick={() => input.current?.click()}><ImagePlus size={40} /><strong>{source ? 'Enter valid preset settings to preview' : 'Drop a photo here'}</strong><span>JPEG, PNG or WebP · You can also paste an image</span></button>}
        <fieldset className="crop-settings" disabled={locked}><legend>Preset settings · saved in this browser</legend>
          <label className="crop-field">Preset name<input value={active.name} onChange={event => updatePreset({ name: event.target.value })} /></label>
          <div className="crop-dimensions">
            <label className="crop-field">Width<input type="number" min="1" max="4096" step="1" value={active.width || ''} onChange={event => updatePreset({ width: Number(event.target.value) })} /></label>
            <label className="crop-field">Height<input type="number" min="1" max="4096" step="1" value={active.height || ''} onChange={event => updatePreset({ height: Number(event.target.value) })} /></label>
            <label className="crop-field">Format<select value={active.format} onChange={event => updatePreset({ format: event.target.value as CropPreset['format'] })}><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label>
          </div>
          <div className="crop-dimensions">
            <label className="crop-field">Quality {active.quality}<input type="range" min="45" max="100" value={active.quality} disabled={active.format === 'png'} onChange={event => updatePreset({ quality: Number(event.target.value) })} /></label>
            <label className="crop-field">Target KB (optional)<input type="number" min="1" placeholder="No target" value={active.targetKb ?? ''} onChange={event => updatePreset({ targetKb: event.target.value === '' ? null : Number(event.target.value) })} /></label>
          </div>
          {!validPreset(active) && <p className="crop-error" role="alert">Enter a preset name, whole-number dimensions from 1 to 4096, and a positive size target or leave it blank.</p>}
          <p className="crop-hint">Dimensions stay exact. A size target lowers quality only.{active.format === 'png' ? ' PNG is lossless; its size target is reported without quality reduction.' : ''} Metadata is stripped on export.</p>
        </fieldset>
      </div>
    </div>
    {!!results.length && <section className="crop-results" aria-label="Exported versions"><div className="crop-heading"><h2>Ready to download</h2><button type="button" className="btn btn-primary" disabled={locked} onClick={() => void downloadZip()}><Download size={16} /> Download selected ZIP</button></div>
      {results.map(result => <div className="crop-result" key={result.presetId}><div><strong>{result.filename}</strong><p>{result.width} × {result.height} · {bytesToLabel(result.blob.size)}{!result.metTarget && <span className="crop-warning"> · Over target; dimensions preserved</span>}</p></div><button className="btn btn-ghost" type="button" disabled={locked} onClick={() => downloadBlob(result.blob, result.filename)}>Download<span className="crop-sr-only"> {result.filename}</span></button></div>)}
    </section>}
    <p className="crop-local-note">Your photo stays in this tab. Only preset settings are saved in this browser.</p>
  </section>;
}
