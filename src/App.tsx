import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FilePenLine,
  Image as ImageIcon,
  Images,
  Loader2,
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

export function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<ShrinkSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

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
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local & private</p>
            <h1>Squish</h1>
            <p className="tagline">Big photos in, tiny files out. Nothing leaves your machine.</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={clearJobs} disabled={jobs.length === 0} title="Clear">
              <RotateCcw size={18} />
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => inputRef.current?.click()}
              title="Add images"
            >
              <Upload size={18} />
              Add
            </button>
          </div>
        </header>

        <div className="tool-grid">
          <aside className="settings-panel" aria-label="Shrink settings">
            <div className="panel-heading">
              <SlidersHorizontal size={18} />
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
                    maxSize: event.target.value === 'original' ? 'original' : Number(event.target.value) as ShrinkSettings['maxSize'],
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
              Squish
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
              <h2>Drop 'em</h2>
              <p>JPEG, PNG, and WebP get squished right here — nothing uploaded, nothing tracked.</p>
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
                        <small>{job.result.outputFormat.toUpperCase()} {job.result.metTarget ? 'under target' : 'closest fit'}</small>
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
      </section>
    </main>
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
