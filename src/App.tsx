import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FilePenLine,
  FileSearch,
  Image as ImageIcon,
  Images,
  Laptop,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { downloadBlob } from './lib/download';
import {
  bytesToLabel,
  defaultOutputName,
  ImageJob,
  isImageFile,
  OutputFormat,
  savingsPercent,
  shrinkImage,
  ShrinkSettings,
  zipResults,
} from './lib/imageShrink';
import {
  cleanPrivacyImage,
  inspectPrivacy,
  isPrivacyImageFile,
  PrivacyReport,
  PrivacyStatus,
} from './lib/privacyCheck';

type RoutePath = '/' | '/privacy-check' | '/compress';

interface RouteLinkProps {
  href: RoutePath | string;
  className?: string;
  children: React.ReactNode;
}

const DEFAULT_SETTINGS: ShrinkSettings = {
  format: 'auto',
  maxSize: 1600,
  quality: 82,
  targetEnabled: true,
  targetKb: 250,
  stripMetadata: true,
};

const MAX_SIZE_OPTIONS: ShrinkSettings['maxSize'][] = ['original', 2400, 1600, 1200, 800];
const FORMAT_OPTIONS: OutputFormat[] = ['auto', 'webp', 'jpeg', 'png'];

const FAQ_ITEMS = [
  {
    q: 'Is this really private?',
    a: "Yes. File processing happens using your browser's own tools. Google Analytics records page views for the site, but NoUpload does not send image data, filenames, metadata values, file sizes, or tool actions to analytics.",
  },
  {
    q: 'What formats does the compressor support?',
    a: 'JPEG, PNG, and WebP in. Output as Auto, WebP, JPEG, or PNG.',
  },
  {
    q: 'What does Privacy Check inspect?',
    a: 'Privacy Check looks for common metadata categories in image files: location, camera/device details, dates, author fields, software fields, embedded previews, and obvious format mismatches.',
  },
  {
    q: 'Is there a batch or file size limit?',
    a: "No artificial limit. You're bound by your own device's memory, so very large batches may run slower on older hardware.",
  },
  {
    q: 'Do you see my images?',
    a: "No. There's no server-side file processing path in NoUpload, so your images stay on your device.",
  },
];

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => normalizeRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: RoutePath) => {
    if (path === normalizeRoute(window.location.pathname)) {
      return;
    }
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0 });
  }, []);

  const RouteLink = ({ href, className, children }: RouteLinkProps) => {
    const isInternal = href === '/' || href === '/privacy-check' || href === '/compress';
    return (
      <a
        className={className}
        href={href}
        onClick={(event) => {
          if (!isInternal) {
            return;
          }
          event.preventDefault();
          navigate(href);
        }}
      >
        {children}
      </a>
    );
  };

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <RouteLink className="logo-mark" href="/">
            <img src="/logo.png" alt="NoUpload" />
          </RouteLink>
          <nav className="nav-actions">
            <RouteLink className={`nav-link ${route === '/privacy-check' ? 'is-active' : ''}`} href="/privacy-check">
              Privacy Check
            </RouteLink>
            <RouteLink className={`nav-link ${route === '/compress' ? 'is-active' : ''}`} href="/compress">
              Photo Compressor
            </RouteLink>
            <a className="nav-link" href="https://github.com/ToddCole/noupload" target="_blank" rel="noreferrer">
              Source
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        {route === '/' ? <HubPage RouteLink={RouteLink} /> : null}
        {route === '/privacy-check' ? <PrivacyCheckPage RouteLink={RouteLink} /> : null}
        {route === '/compress' ? <PhotoCompressorPage /> : null}
      </main>

      <Footer RouteLink={RouteLink} />
    </>
  );
}

function HubPage({ RouteLink }: { RouteLink: React.ComponentType<RouteLinkProps> }) {
  return (
    <>
      <section className="suite-hero">
        <div className="wrap suite-hero-grid">
          <div>
            <div className="hero-badges">
              <span className="hero-badge">
                <Lock size={15} />
                Private
              </span>
              <span className="hero-badge">
                <Laptop size={15} />
                Local
              </span>
            </div>
            <h1>NoUpload private file tools</h1>
            <p className="hero-sub">
              Check and prepare sensitive images in your browser. <b>Your files never leave your device.</b>
            </p>
            <div className="hero-ctas">
              <RouteLink className="btn btn-primary" href="/privacy-check">
                <ShieldCheck size={16} />
                Open Privacy Check
              </RouteLink>
              <RouteLink className="btn btn-ghost" href="/compress">
                <ImageIcon size={16} />
                Open Compressor
              </RouteLink>
            </div>
            <p className="hero-note">Google Analytics is page-view only; file details are not sent.</p>
          </div>
          <div className="suite-signal" aria-hidden="true">
            <div className="signal-row">
              <FileSearch size={22} />
              <span>Inspect</span>
              <CheckCircle2 size={18} />
            </div>
            <div className="signal-row">
              <ShieldCheck size={22} />
              <span>Clean</span>
              <CheckCircle2 size={18} />
            </div>
            <div className="signal-row">
              <Download size={22} />
              <span>Download</span>
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>
      </section>

      <section className="band band-tray">
        <div className="wrap">
          <div className="section-head">
            <h2>Choose a tool</h2>
          </div>
          <div className="tool-cards">
            <RouteLink className="tool-card primary-tool" href="/privacy-check">
              <ShieldCheck size={28} />
              <div>
                <h3>Privacy Check</h3>
                <p>Find common image metadata risks and download a cleaned copy.</p>
              </div>
            </RouteLink>
            <RouteLink className="tool-card" href="/compress">
              <ImageIcon size={28} />
              <div>
                <h3>Photo Compressor</h3>
                <p>Resize and compress JPEG, PNG, and WebP images locally.</p>
              </div>
            </RouteLink>
          </div>
        </div>
      </section>

      <TrustSections />
    </>
  );
}

function PrivacyCheckPage({ RouteLink }: { RouteLink: React.ComponentType<RouteLinkProps> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PrivacyItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const hasInspecting = items.some((item) => item.status === 'inspecting' || item.status === 'cleaning');
  const inspectedCount = items.filter((item) => item.report).length;
  const metadataCount = items.filter((item) => item.report?.status === 'Metadata found').length;

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(isPrivacyImageFile);
    if (files.length === 0) {
      return;
    }

    const nextItems = files.map((file, index) => ({
      id: `${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      label: `Image ${items.length + index + 1}`,
      previewUrl: URL.createObjectURL(file),
      status: 'queued' as PrivacyItem['status'],
    }));

    setItems((current) => [...current, ...nextItems]);
  }, [items.length]);

  const inspectAll = useCallback(async () => {
    for (const item of items) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'inspecting', report: undefined, error: undefined } : entry,
        ),
      );

      try {
        const report = await inspectPrivacy(item.file);
        setItems((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, status: 'done', report } : entry)),
        );
      } catch (error) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'This image could not be inspected.',
                  report: {
                    status: 'Could not inspect',
                    findings: [],
                    metadata: [],
                    canClean: false,
                    canInspect: false,
                    message: 'This image could not be inspected.',
                  },
                }
              : entry,
          ),
        );
      }
    }
  }, [items]);

  const cleanItem = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item?.report?.canClean) {
      return;
    }

    setItems((current) => current.map((entry) => (entry.id === id ? { ...entry, status: 'cleaning' } : entry)));

    try {
      const clean = await cleanPrivacyImage(item.file, items.findIndex((entry) => entry.id === id) + 1);
      downloadBlob(clean.blob, clean.filename);
      setItems((current) => current.map((entry) => (entry.id === id ? { ...entry, status: 'done' } : entry)));
    } catch (error) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: 'error',
                error: error instanceof Error ? error.message : 'This image could not be cleaned in this browser.',
              }
            : entry,
        ),
      );
    }
  };

  const clearItems = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
  };

  return (
    <>
      <section className="tool-hero">
        <div className="wrap tool-hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge">
                <ShieldCheck size={15} />
                Images only
              </span>
              <span className="hero-badge">
                <Laptop size={15} />
                Local processing
              </span>
            </div>
            <h1>Image Privacy Check</h1>
            <p className="hero-sub">
              Inspect images for common metadata risks, then re-encode a clean copy where your browser supports it.
              <b> Your files never leave your device.</b>
            </p>
          </div>
          <RouteLink className="btn btn-ghost" href="/">
            Suite hub
          </RouteLink>
        </div>
      </section>

      <section className="band band-tray">
        <div className="wrap">
          <div className="privacy-grid">
            <aside className="privacy-summary" aria-label="Privacy Check summary">
              <div className="panel-heading">
                <FileSearch size={16} />
                <h2>Report</h2>
              </div>
              <div className="queue-summary privacy-stats">
                <div>
                  <span>{items.length}</span>
                  <p>Images</p>
                </div>
                <div>
                  <span>{inspectedCount}</span>
                  <p>Checked</p>
                </div>
                <div>
                  <span>{metadataCount}</span>
                  <p>Flagged</p>
                </div>
              </div>
              <p className="trust-note">
                NoUpload does not send filenames, metadata values, file sizes, image blobs, or tool actions to Google
                Analytics.
              </p>
              <button className="run-button" type="button" onClick={inspectAll} disabled={items.length === 0 || hasInspecting}>
                {hasInspecting ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
                Check images
              </button>
              <button className="btn btn-ghost full-width-btn" type="button" onClick={clearItems} disabled={items.length === 0}>
                <RotateCcw size={16} />
                Clear
              </button>
            </aside>

            <section
              className={`dropzone privacy-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif,.avif"
                multiple
                onChange={(event) => {
                  if (event.target.files) {
                    addFiles(event.target.files);
                    event.target.value = '';
                  }
                }}
              />
              <Images size={38} />
              <div>
                <h3>Drop images to inspect</h3>
                <p>JPEG, PNG, WebP, GIF, HEIC, and AVIF where browser metadata support allows.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
                <Upload size={16} />
                Add images
              </button>
            </section>

            <section className="privacy-list" aria-label="Privacy reports">
              {items.length === 0 ? (
                <div className="empty-list privacy-empty">No images loaded</div>
              ) : (
                items.map((item, index) => (
                  <article className="privacy-card" key={item.id}>
                    <img src={item.previewUrl} alt="" />
                    <div className="privacy-card-main">
                      <div className="privacy-card-title">
                        <strong>{item.label}</strong>
                        <StatusPill status={item.report?.status} busy={item.status === 'inspecting' || item.status === 'cleaning'} />
                      </div>
                      <p>{item.report?.message ?? 'Ready to inspect. File details stay in this browser tab.'}</p>
                      {item.report?.findings.length ? (
                        <ul className="finding-list">
                          {item.report.findings.map((finding) => (
                            <li className={`risk-${finding.risk}`} key={finding.key}>
                              {finding.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {item.report?.metadata.length ? (
                        <div className="metadata-table" aria-label={`${item.label} metadata`}>
                          <div className="metadata-table-head">
                            <span>Metadata</span>
                            <span>{item.report.metadata.length} fields</span>
                          </div>
                          <div className="metadata-rows">
                            {item.report.metadata.map((entry) => (
                              <div className="metadata-row" key={`${entry.group}-${entry.tag}`}>
                                <span className="metadata-key">
                                  {entry.group} / {entry.tag}
                                </span>
                                <span className="metadata-value">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : item.report?.canInspect ? (
                        <div className="metadata-empty">No parsed metadata fields found.</div>
                      ) : null}
                      {item.error ? <em className="privacy-error">{item.error}</em> : null}
                    </div>
                    <div className="privacy-card-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => cleanItem(item.id)}
                        disabled={!item.report?.canClean || item.status === 'cleaning'}
                      >
                        {item.status === 'cleaning' ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                        Clean
                      </button>
                      <small>{item.report?.canClean ? `privacy-clean-${String(index + 1).padStart(2, '0')}` : 'Report only'}</small>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </section>

      <TrustSections />
    </>
  );
}

function PhotoCompressorPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<ShrinkSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkName, setBulkName] = useState('');

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? jobs[0],
    [jobs, selectedId],
  );
  const completedResults = jobs.flatMap((job) => (job.result ? [job.result] : []));
  const totalOriginal = jobs.reduce((total, job) => total + job.file.size, 0);
  const totalOutput = completedResults.reduce((total, result) => total + result.outputBytes, 0);
  const hasProcessing = jobs.some((job) => job.status === 'processing');

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(isImageFile);
    if (files.length === 0) {
      return;
    }

    const newJobs = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      outputName: defaultOutputName(file.name),
      previewUrl: URL.createObjectURL(file),
      status: 'queued' as const,
    }));

    setJobs((current) => [...current, ...newJobs]);
    setSelectedId((current) => current ?? newJobs[0].id);
  }, []);

  const runShrink = useCallback(async () => {
    const queuedJobs = jobs;

    for (const job of queuedJobs) {
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? (() => {
                if (item.outputPreviewUrl) {
                  URL.revokeObjectURL(item.outputPreviewUrl);
                }

                return {
                  ...item,
                  status: 'processing',
                  error: undefined,
                  result: undefined,
                  outputPreviewUrl: undefined,
                };
              })()
            : item,
        ),
      );

      try {
        const result = await shrinkImage(job.file, settings, job.outputName);
        const outputPreviewUrl = URL.createObjectURL(result.blob);
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: 'done',
                  originalWidth: result.originalWidth,
                  originalHeight: result.originalHeight,
                  outputPreviewUrl,
                  result,
                }
              : item,
          ),
        );
      } catch (error) {
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Image failed to shrink.',
                }
              : item,
          ),
        );
      }
    }
  }, [jobs, settings]);

  const clearJobs = () => {
    jobs.forEach((job) => {
      URL.revokeObjectURL(job.previewUrl);
      if (job.outputPreviewUrl) {
        URL.revokeObjectURL(job.outputPreviewUrl);
      }
    });
    setJobs([]);
    setSelectedId(null);
    setCheckedIds(new Set());
  };

  const removeJob = (id: string) => {
    setJobs((current) => {
      const target = current.find((job) => job.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.outputPreviewUrl) {
          URL.revokeObjectURL(target.outputPreviewUrl);
        }
      }
      return current.filter((job) => job.id !== id);
    });
    setSelectedId((current) => (current === id ? null : current));
    setCheckedIds((current) => {
      if (!current.has(id)) {
        return current;
      }
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setCheckedIds((current) => (current.size === jobs.length ? new Set() : new Set(jobs.map((job) => job.id))));
  };

  const bulkRenameSelected = () => {
    const trimmed = bulkName.trim();
    if (!trimmed || checkedIds.size === 0) {
      return;
    }

    const selectedCount = jobs.filter((job) => checkedIds.has(job.id)).length;
    const padWidth = Math.max(2, String(selectedCount).length);
    let counter = 0;

    setJobs((current) =>
      current.map((job) => {
        if (!checkedIds.has(job.id)) {
          return job;
        }

        counter += 1;
        if (job.outputPreviewUrl) {
          URL.revokeObjectURL(job.outputPreviewUrl);
        }

        return {
          ...job,
          outputName: selectedCount === 1 ? trimmed : `${trimmed}-${String(counter).padStart(padWidth, '0')}`,
          status: job.result ? 'queued' : job.status,
          result: undefined,
          outputPreviewUrl: undefined,
        };
      }),
    );

    setCheckedIds(new Set());
    setBulkName('');
  };

  const renameJob = (id: string, outputName: string) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === id
          ? (() => {
              if (job.outputPreviewUrl) {
                URL.revokeObjectURL(job.outputPreviewUrl);
              }

              return {
                ...job,
                outputName,
                status: job.result ? 'queued' : job.status,
                result: undefined,
                outputPreviewUrl: undefined,
              };
            })()
          : job,
      ),
    );
  };

  const downloadAll = async () => {
    if (completedResults.length === 0) {
      return;
    }

    setIsZipping(true);
    try {
      const blob = await zipResults(completedResults);
      downloadBlob(blob, 'shrunk-images.zip');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <>
      <section className="tool-hero">
        <div className="wrap tool-hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge">
                <Lock size={15} />
                Private
              </span>
              <span className="hero-badge">
                <Laptop size={15} />
                Local
              </span>
            </div>
            <h1>Photo Compressor</h1>
            <p className="hero-sub">
              Resize and compress images entirely in your browser. <b>Your files never leave your device.</b>
            </p>
          </div>
        </div>
      </section>

      <section className="band band-tray" id="tool">
        <div className="wrap">
          <div className="tool-head">
            <div>
              <h2>Compress images locally</h2>
              <p>right here, in this tab; your images are not sent anywhere</p>
            </div>
            <div className="tool-actions">
              <button className="icon-button" type="button" onClick={clearJobs} disabled={jobs.length === 0} title="Clear">
                <RotateCcw size={18} />
              </button>
              <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()} title="Add images">
                <Upload size={16} />
                Add
              </button>
            </div>
          </div>

          <div className="tool-grid">
            <aside className="settings-panel" aria-label="Shrink settings">
              <div className="panel-heading">
                <SlidersHorizontal size={16} />
                <h2>Settings</h2>
              </div>

              <label className="field">
                <span>Format</span>
                <select
                  value={settings.format}
                  onChange={(event) => setSettings((current) => ({ ...current, format: event.target.value as OutputFormat }))}
                >
                  {FORMAT_OPTIONS.map((format) => (
                    <option key={format} value={format}>
                      {format === 'auto' ? 'Auto' : format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Max edge</span>
                <select
                  value={settings.maxSize}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      maxSize:
                        event.target.value === 'original'
                          ? 'original'
                          : (Number(event.target.value) as ShrinkSettings['maxSize']),
                    }))
                  }
                >
                  {MAX_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size === 'original' ? 'Original' : `${size}px`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Quality {settings.quality}</span>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={settings.quality}
                  onChange={(event) => setSettings((current) => ({ ...current, quality: Number(event.target.value) }))}
                />
              </label>

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={settings.targetEnabled}
                  onChange={(event) => setSettings((current) => ({ ...current, targetEnabled: event.target.checked }))}
                />
                <span>Aim under</span>
              </label>

              <label className="field">
                <span>Target KB</span>
                <input
                  className="number-input"
                  type="number"
                  min="25"
                  step="25"
                  value={settings.targetKb}
                  disabled={!settings.targetEnabled}
                  onChange={(event) => setSettings((current) => ({ ...current, targetKb: Number(event.target.value) }))}
                />
              </label>

              <label className="check-field">
                <input type="checkbox" checked={settings.stripMetadata} readOnly />
                <span>Strip metadata</span>
              </label>

              <button className="run-button" type="button" onClick={runShrink} disabled={jobs.length === 0 || hasProcessing}>
                {hasProcessing ? <Loader2 className="spin" size={18} /> : <ImageIcon size={18} />}
                Develop
              </button>
            </aside>

            <section
              className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) {
                    addFiles(event.target.files);
                    event.target.value = '';
                  }
                }}
              />
              <Images size={38} />
              <div>
                <h3>Drop images</h3>
                <p>JPEG, PNG, and WebP; developed right here, nothing uploaded.</p>
              </div>
            </section>

            <section className="preview-panel" aria-label="Preview">
              {selectedJob ? (
                <>
                  <div className={`preview-image ${selectedJob.outputPreviewUrl ? 'has-comparison' : ''}`}>
                    <figure>
                      <img src={selectedJob.previewUrl} alt="" />
                      <figcaption>Original</figcaption>
                    </figure>
                    {selectedJob.outputPreviewUrl ? (
                      <figure>
                        <img src={selectedJob.outputPreviewUrl} alt="" />
                        <figcaption>Optimized</figcaption>
                      </figure>
                    ) : null}
                  </div>
                  <div className="preview-meta">
                    <label className="rename-field">
                      <FilePenLine size={16} />
                      <input value={selectedJob.outputName} onChange={(event) => renameJob(selectedJob.id, event.target.value)} aria-label="Output filename" />
                    </label>
                    <span>
                      {selectedJob.result
                        ? `${selectedJob.result.originalWidth} x ${selectedJob.result.originalHeight} to ${selectedJob.result.width} x ${selectedJob.result.height}`
                        : bytesToLabel(selectedJob.file.size)}
                    </span>
                    {selectedJob.result && settings.targetEnabled ? (
                      <small className={selectedJob.result.metTarget ? 'target-met' : 'target-missed'}>
                        {selectedJob.result.metTarget ? 'Under target' : 'Closest fit'}
                      </small>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="empty-preview">
                  <ImageIcon size={36} />
                </div>
              )}
            </section>

            <section className="queue-panel" aria-label="Image queue">
              <div className="queue-summary">
                <div>
                  <span>{jobs.length}</span>
                  <p>Images</p>
                </div>
                <div>
                  <span>{completedResults.length}</span>
                  <p>Done</p>
                </div>
                <div>
                  <span>{totalOutput > 0 ? `${savingsPercent(totalOriginal, totalOutput)}%` : '0%'}</span>
                  <p>Saved</p>
                </div>
                <button type="button" onClick={downloadAll} disabled={completedResults.length === 0 || isZipping}>
                  {isZipping ? <Loader2 className="spin" size={18} /> : <Archive size={18} />}
                  ZIP
                </button>
              </div>

              {jobs.length > 0 ? (
                <div className="bulk-rename-bar">
                  <label className="bulk-select-all">
                    <input type="checkbox" checked={checkedIds.size === jobs.length} onChange={toggleSelectAll} aria-label="Select all images" />
                    <span>{checkedIds.size > 0 ? `${checkedIds.size} selected` : 'Select all'}</span>
                  </label>
                  <input
                    className="bulk-rename-input"
                    type="text"
                    value={bulkName}
                    onChange={(event) => setBulkName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        bulkRenameSelected();
                      }
                    }}
                    placeholder="Rename selected to..."
                    aria-label="Bulk rename value"
                  />
                  <button type="button" className="bulk-rename-btn" onClick={bulkRenameSelected} disabled={checkedIds.size === 0 || bulkName.trim().length === 0}>
                    <FilePenLine size={15} />
                    Rename
                  </button>
                </div>
              ) : null}

              <div className="job-list">
                {jobs.length === 0 ? (
                  <div className="empty-list">No images loaded</div>
                ) : (
                  jobs.map((job) => (
                    <article className={`job-card ${selectedJob?.id === job.id ? 'is-selected' : ''}`} key={job.id} onClick={() => setSelectedId(job.id)}>
                      <input
                        type="checkbox"
                        className="job-check-input"
                        checked={checkedIds.has(job.id)}
                        onChange={() => toggleChecked(job.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${job.file.name} for bulk rename`}
                      />
                      <img src={job.previewUrl} alt="" />
                      <div className="job-main">
                        <strong>{job.file.name}</strong>
                        <label className="job-rename" onClick={(event) => event.stopPropagation()}>
                          <FilePenLine size={14} />
                          <input value={job.outputName} onChange={(event) => renameJob(job.id, event.target.value)} aria-label={`Rename ${job.file.name}`} />
                        </label>
                        <span>
                          {job.result
                            ? `${bytesToLabel(job.file.size)} to ${bytesToLabel(job.result.outputBytes)} (${savingsPercent(job.file.size, job.result.outputBytes)}%)`
                            : bytesToLabel(job.file.size)}
                        </span>
                        {job.error ? <em>{job.error}</em> : null}
                        {job.result?.encodedQuality ? (
                          <small>
                            {job.result.outputFormat.toUpperCase()} q{job.result.encodedQuality}
                            {job.result.metTarget ? ' under target' : ' closest fit'}
                          </small>
                        ) : job.result ? (
                          <small>
                            {job.result.outputFormat.toUpperCase()} {job.result.metTarget ? 'under target' : 'closest fit'}
                          </small>
                        ) : null}
                      </div>
                      <StatusIcon status={job.status} />
                      {job.result ? (
                        <button
                          className="icon-button"
                          type="button"
                          title="Download"
                          onClick={(event) => {
                            event.stopPropagation();
                            downloadBlob(job.result!.blob, job.result!.filename);
                          }}
                        >
                          <Download size={17} />
                        </button>
                      ) : null}
                      <button
                        className="icon-button"
                        type="button"
                        title="Remove"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeJob(job.id);
                        }}
                      >
                        <X size={17} />
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      <CompressorInfo openFaq={openFaq} setOpenFaq={setOpenFaq} />
    </>
  );
}

function CompressorInfo({
  openFaq,
  setOpenFaq,
}: {
  openFaq: number | null;
  setOpenFaq: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  return (
    <>
      <section className="band" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>Three steps, zero servers.</h2>
          </div>

          <div className="frames">
            <div className="frame">
              <span className="frame-num" aria-hidden="true">
                01
              </span>
              <span className="frame-verb">Load</span>
              <Upload className="frame-icon" />
              <h3>Drop in your images</h3>
              <p>JPEG, PNG, or WebP. Batch as many as you like, all at once.</p>
            </div>
            <div className="frame">
              <span className="frame-num" aria-hidden="true">
                02
              </span>
              <span className="frame-verb">Develop</span>
              <ImageIcon className="frame-icon" />
              <h3>It resizes, right there</h3>
              <p>Your browser does the resizing and compressing. Nothing is transmitted.</p>
            </div>
            <div className="frame">
              <span className="frame-num" aria-hidden="true">
                03
              </span>
              <span className="frame-verb">Collect</span>
              <Archive className="frame-icon" />
              <h3>Download, ready for the web</h3>
              <p>Grab files one at a time, or everything together as a zip.</p>
            </div>
          </div>
        </div>
      </section>

      <TrustSections />

      <section className="band" id="faq">
        <div className="wrap">
          <div className="section-head">
            <h2>Still skeptical?</h2>
          </div>

          <div className="faq-list">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.q}>
                  <button
                    className="faq-q"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq((current) => (current === index ? null : index))}
                  >
                    <span>{item.q}</span>
                    <span className="plus">+</span>
                  </button>
                  {isOpen ? <div className="faq-a">{item.a}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function TrustSections() {
  return (
    <>
      <section className="band" id="why">
        <div className="wrap why-grid">
          <h2>Most file tools send your files to someone else's server first. NoUpload doesn't.</h2>
          <div className="why-body">
            <p>
              For client work, ID scans, medical documents, unreleased product shots, or anything else you do not
              want sitting in a stranger's storage, the safer upload is the one that never happens.
            </p>
            <p>
              File processing runs in your browser. Google Analytics remains on the site for page-view measurement,
              but V1 does not send filenames, metadata values, file sizes, image blobs, or tool actions as custom
              analytics events.
            </p>
            <ul className="facts">
              <li>Your files never leave your device</li>
              <li>No account, sign-in, or email required</li>
              <li>No analytics events include your images or filenames</li>
              <li>No server-side file processing path</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="band band-tray" id="legal">
        <div className="wrap">
          <div className="section-head">
            <h2>Privacy &amp; terms</h2>
          </div>

          <div className="why-body legal-body">
            <p>
              <b>What NoUpload does with files:</b> image inspection, cleaning, resizing, and compression happen in
              your browser. Your files are not uploaded to NoUpload for processing.
            </p>
            <p>
              <b>What this site collects:</b> standard page-view analytics via Google Analytics, which uses cookies
              and may record approximate location, device/browser type, and pages visited. V1 does not add custom
              analytics for file processing actions.
            </p>
            <p>
              <b>Terms:</b> NoUpload is provided free, as-is, with no warranty of any kind. Use it at your own risk.
            </p>
            <p>
              <b>Contact:</b> this is an open-source, one-person project. The best way to reach us is to{' '}
              <a href="https://github.com/ToddCole/noupload/issues" target="_blank" rel="noreferrer">
                open an issue on GitHub
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function Footer({ RouteLink }: { RouteLink: React.ComponentType<RouteLinkProps> }) {
  return (
    <footer>
      <div className="wrap">
        <RouteLink className="logo-mark" href="/">
          <img src="/logo.png" alt="NoUpload" />
        </RouteLink>
        <div className="foot-links">
          <RouteLink href="/privacy-check">Privacy Check</RouteLink>
          <RouteLink href="/compress">Photo Compressor</RouteLink>
          <a href="#legal">Privacy &amp; terms</a>
          <a href="https://github.com/ToddCole/noupload" target="_blank" rel="noreferrer">
            View source
          </a>
          <a href="https://github.com/ToddCole/noupload/issues" target="_blank" rel="noreferrer">
            Report an issue
          </a>
        </div>
      </div>
    </footer>
  );
}

function StatusIcon({ status }: { status: ImageJob['status'] }) {
  if (status === 'processing') {
    return <Loader2 className="status-icon spin" size={18} />;
  }

  if (status === 'done') {
    return <CheckCircle2 className="status-icon success" size={18} />;
  }

  if (status === 'error') {
    return <X className="status-icon error" size={18} />;
  }

  return <span className="queued-dot" />;
}

function StatusPill({ status, busy }: { status: PrivacyStatus | undefined; busy: boolean }) {
  if (busy) {
    return (
      <span className="status-pill is-busy">
        <Loader2 className="spin" size={14} />
        Working
      </span>
    );
  }

  const label = status ?? 'Queued';
  return <span className={`status-pill status-${label.toLowerCase().replace(/\s+/g, '-')}`}>{label}</span>;
}

function normalizeRoute(pathname: string): RoutePath {
  if (pathname === '/privacy-check') {
    return '/privacy-check';
  }
  if (pathname === '/compress') {
    return '/compress';
  }
  return '/';
}

interface PrivacyItem {
  id: string;
  file: File;
  label: string;
  previewUrl: string;
  status: 'queued' | 'inspecting' | 'cleaning' | 'done' | 'error';
  report?: PrivacyReport;
  error?: string;
}
