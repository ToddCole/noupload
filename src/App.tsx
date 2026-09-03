import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FilePenLine,
  Image as ImageIcon,
  Images,
  Laptop,
  Loader2,
  Lock,
  RotateCcw,
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
    a: "Yes. Processing happens using your browser's own image tools — there's no server in the loop to send anything to. Open your network tab while you use it and watch for yourself: zero requests carry image data. The source is public, so you can verify exactly what the code does.",
  },
  {
    q: 'What formats does it support?',
    a: 'JPEG, PNG, and WebP in. Output as Auto, WebP, JPEG, or PNG.',
  },
  {
    q: 'Is there a batch or file size limit?',
    a: "No artificial limit — you're only bound by your own device's memory. Very large batches may run slower on older hardware.",
  },
  {
    q: 'Is it actually free?',
    a: 'Yes, completely. No account, no tier, no catch.',
  },
  {
    q: 'Do you see my images?',
    a: "No. There's no server in the loop, so there's nothing for anyone to see, store, or lose.",
  },
];

export function App() {
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
      <header className="site-header">
        <div className="wrap">
          <a className="logo-mark" href="#top">
            <img src="/logo.png" alt="NoUpload" />
          </a>
          <nav className="nav-actions">
            <a className="nav-link" href="#why">
              Why it's safe
            </a>
            <a className="btn btn-primary" href="#tool">
              Try it
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
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
              <h1>
                Shrink your photos without ever <em>sending them anywhere</em>.
              </h1>
              <p className="hero-sub">
                NoUpload resizes and compresses images entirely in your browser — like developing your own film
                instead of dropping it at a lab. <b>Nothing leaves your device</b>, not even for a second.
              </p>
              <div className="hero-ctas">
                <a className="btn btn-primary" href="#tool">
                  Try it — drop a photo below
                </a>
                <a className="btn btn-ghost" href="#why">
                  Why it's safe
                </a>
              </div>
              <p className="hero-note">No account. No upload limit. No catch.</p>
            </div>
          </div>
        </section>

        <section className="band band-tray" id="tool">
          <div className="wrap">
            <div className="tool-head">
              <div>
                <h2>Try it — everything below runs on your machine.</h2>
                <p>right here, in this tab — nothing is sent anywhere</p>
              </div>
              <div className="tool-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={clearJobs}
                  disabled={jobs.length === 0}
                  title="Clear"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  title="Add images"
                >
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
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, format: event.target.value as OutputFormat }))
                    }
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
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, targetEnabled: event.target.checked }))
                    }
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
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, targetKb: Number(event.target.value) }))
                    }
                  />
                </label>

                <label className="check-field">
                  <input type="checkbox" checked={settings.stripMetadata} readOnly />
                  <span>Strip metadata</span>
                </label>

                <button
                  className="run-button"
                  type="button"
                  onClick={runShrink}
                  disabled={jobs.length === 0 || hasProcessing}
                >
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
                  <p>JPEG, PNG, and WebP — developed right here, nothing uploaded.</p>
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
                        <input
                          value={selectedJob.outputName}
                          onChange={(event) => renameJob(selectedJob.id, event.target.value)}
                          aria-label="Output filename"
                        />
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
                      <input
                        type="checkbox"
                        checked={checkedIds.size === jobs.length}
                        onChange={toggleSelectAll}
                        aria-label="Select all images"
                      />
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
                      placeholder="Rename selected to…"
                      aria-label="Bulk rename value"
                    />
                    <button
                      type="button"
                      className="bulk-rename-btn"
                      onClick={bulkRenameSelected}
                      disabled={checkedIds.size === 0 || bulkName.trim().length === 0}
                    >
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
                      <article
                        className={`job-card ${selectedJob?.id === job.id ? 'is-selected' : ''}`}
                        key={job.id}
                        onClick={() => setSelectedId(job.id)}
                      >
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
                            <input
                              value={job.outputName}
                              onChange={(event) => renameJob(job.id, event.target.value)}
                              aria-label={`Rename ${job.file.name}`}
                            />
                          </label>
                          <span>
                            {job.result
                              ? `${bytesToLabel(job.file.size)} to ${bytesToLabel(job.result.outputBytes)} (${savingsPercent(
                                  job.file.size,
                                  job.result.outputBytes,
                                )}%)`
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
                <svg className="frame-icon" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 13 17 4l11 9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 13v15h22V13" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 4v16" strokeLinecap="round" />
                </svg>
                <h3>Drop in your images</h3>
                <p>JPEG, PNG, or WebP. Batch as many as you like, all at once.</p>
              </div>
              <div className="frame">
                <span className="frame-num" aria-hidden="true">
                  02
                </span>
                <span className="frame-verb">Develop</span>
                <svg className="frame-icon" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="17" cy="17" r="12" />
                  <circle cx="17" cy="17" r="4.5" />
                  <path d="M17 5v3M17 26v3M5 17h3M26 17h3" strokeLinecap="round" />
                </svg>
                <h3>It resizes, right there</h3>
                <p>Your browser does the resizing and compressing. Nothing is transmitted, ever.</p>
              </div>
              <div className="frame">
                <span className="frame-num" aria-hidden="true">
                  03
                </span>
                <span className="frame-verb">Collect</span>
                <svg className="frame-icon" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 15V8a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v7" strokeLinecap="round" />
                  <rect x="5" y="15" width="24" height="12" rx="2" />
                  <path d="M13 21h8" strokeLinecap="round" />
                </svg>
                <h3>Download, ready for the web</h3>
                <p>Grab files one at a time, or everything together as a zip.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="band band-tray" id="why">
          <div className="wrap why-grid">
            <h2>Most compressors send your photos to someone else's server first. This one doesn't.</h2>
            <div className="why-body">
              <p>
                For client work, unreleased product shots, ID scans, or anything else you can't risk landing in a
                stranger's storage — <b>the only truly safe upload is the one that never happens.</b> NoUpload can't
                leak, store, or hand over what it never received, because it never receives anything.
              </p>
              <p>
                The code that does this is public. You don't have to take our word for it — you can read exactly
                what happens to your files.
              </p>
              <ul className="facts">
                <li>No uploads, at any point in the process</li>
                <li>No account, no sign-in, no email required</li>
                <li>No analytics that track what you process</li>
                <li>No server ever holds a copy of your images</li>
              </ul>
            </div>
          </div>
        </section>

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

        <section className="band band-tray" id="legal">
          <div className="wrap">
            <div className="section-head">
              <h2>Privacy &amp; terms</h2>
            </div>

            <div className="why-body legal-body">
              <p>
                <b>What NoUpload collects:</b> nothing. Your images are never uploaded — they're resized and
                compressed entirely in your browser and never touch a server. There's no account, no sign-in, and
                no server-side storage of anything you process.
              </p>
              <p>
                <b>What this site collects:</b> standard web analytics via Google Analytics, which uses cookies and
                may record your approximate location, device/browser type, and the pages you visit, to help us
                understand traffic. If this site ever shows ads, Google and its advertising partners may also use
                cookies to personalize them. You can block or clear cookies in your browser at any time.
              </p>
              <p>
                <b>Terms:</b> NoUpload is provided free, as-is, with no warranty of any kind. Use it at your own
                risk.
              </p>
              <p>
                <b>Contact:</b> this is an open-source, one-person project — the best way to reach us is to{' '}
                <a href="https://github.com/ToddCole/noupload/issues" target="_blank" rel="noreferrer">
                  open an issue on GitHub
                </a>
                . The full source is public, so you can see exactly what the code does.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <a className="logo-mark" href="#top">
            <img src="/logo.png" alt="NoUpload" />
          </a>
          <div className="foot-links">
            <a href="#why">Why it's safe</a>
            <a href="#tool">Open the tool</a>
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
    </>
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
