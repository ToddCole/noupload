import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BadgeCheck,
  CheckCircle2,
  Download,
  FilePenLine,
  FileSearch,
  Image as ImageIcon,
  Images,
  Laptop,
  Loader2,
  Lock,
  ScanLine,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Square,
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
  DraftRect,
  normalizeRedactionRect,
  redactImage,
  RedactionMode,
  RedactionRect,
  rectToPercentStyle,
} from './lib/imageRedact';
import {
  cleanPrivacyImage,
  inspectPrivacy,
  isPrivacyImageFile,
  PrivacyReport,
  PrivacyStatus,
  CleanVerification,
  verifyCleanImage,
} from './lib/privacyCheck';
import { applySeo, SEO_BY_ROUTE } from './lib/seo';
import { trackImageExport } from './lib/analytics';

type RoutePath = '/' | '/share-safe' | '/remove-gps-from-photo' | '/meta-stripper' | '/redact' | '/compress';

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
const REDACTION_MODES: Array<{ mode: RedactionMode; label: string }> = [
  { mode: 'black', label: 'Black box' },
  { mode: 'blur', label: 'Blur' },
  { mode: 'pixelate', label: 'Pixelate' },
];

const FAQ_ITEMS = [
  {
    q: 'Is this really private?',
    a: "Yes. File processing happens using your browser's own tools. Google Analytics records page views and anonymous aggregate export counts, but NoUpload does not send image data, filenames, metadata values, file sizes, or other file details to analytics.",
  },
  {
    q: 'What formats does Image Compressor support?',
    a: 'JPEG, PNG, and WebP in. Output as Auto, WebP, JPEG, or PNG.',
  },
  {
    q: 'What does Image Meta Stripper inspect?',
    a: 'Image Meta Stripper looks for common metadata categories in image files: location, camera/device details, dates, author fields, software fields, embedded previews, and obvious format mismatches.',
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

  useEffect(() => {
    applySeo(SEO_BY_ROUTE[route]);
  }, [route]);

  const navigate = useCallback((path: RoutePath) => {
    if (path === normalizeRoute(window.location.pathname)) {
      return;
    }
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0 });
  }, []);

  const RouteLink = ({ href, className, children }: RouteLinkProps) => {
    const isInternal = href === '/' || href === '/share-safe' || href === '/remove-gps-from-photo' || href === '/meta-stripper' || href === '/redact' || href === '/compress';
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
            <RouteLink className={`nav-link ${route === '/share-safe' ? 'is-active' : ''}`} href="/share-safe">
              Share-Safe
            </RouteLink>
            <RouteLink className={`nav-link ${route === '/meta-stripper' ? 'is-active' : ''}`} href="/meta-stripper">
              Image Meta Stripper
            </RouteLink>
            <RouteLink className={`nav-link ${route === '/redact' ? 'is-active' : ''}`} href="/redact">
              Image Redactor
            </RouteLink>
            <RouteLink className={`nav-link ${route === '/compress' ? 'is-active' : ''}`} href="/compress">
              Image Compressor
            </RouteLink>
          </nav>
        </div>
      </header>

      <main id="top">
        {route === '/' ? <HubPage RouteLink={RouteLink} /> : null}
        {route === '/share-safe' ? <ShareSafePage RouteLink={RouteLink} /> : null}
        {route === '/remove-gps-from-photo' ? <ImageMetaStripperPage RouteLink={RouteLink} title="Remove GPS Location Data from Photos" intro="Check photos for hidden GPS coordinates, camera details, and other EXIF metadata, then download a clean copy before sharing." /> : null}
        {route === '/meta-stripper' ? <ImageMetaStripperPage RouteLink={RouteLink} /> : null}
        {route === '/redact' ? <ImageRedactorPage RouteLink={RouteLink} /> : null}
        {route === '/compress' ? <ImageCompressorPage /> : null}
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
          <div className="suite-hero-copy">
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
            <h1>Prepare photos safely before you share them</h1>
            <p className="hero-sub">
              Remove hidden metadata, cover sensitive details, and verify the cleaned copy in your browser. <b>Your files never leave your device.</b>
            </p>
            <div className="hero-ctas">
              <RouteLink className="btn btn-primary" href="/share-safe">
                <BadgeCheck size={16} />
                Open Share-Safe
              </RouteLink>
              <RouteLink className="btn btn-primary" href="/meta-stripper">
                <ShieldCheck size={16} />
                Open Meta Stripper
              </RouteLink>
              <RouteLink className="btn btn-ghost" href="/redact">
                <ScanLine size={16} />
                Open Redactor
              </RouteLink>
              <RouteLink className="btn btn-ghost" href="/compress">
                <ImageIcon size={16} />
                Open Image Compressor
              </RouteLink>
            </div>
            <div className="trust-strip" aria-label="Privacy promises">
              <span>Runs in your browser</span>
              <span>No account</span>
              <span>No file uploads</span>
              <span>Anonymous usage counts</span>
            </div>
          </div>

          <div className="suite-demo" aria-label="NoUpload local image workflow preview">
            <div className="demo-header">
              <div>
                <span>NoUpload workflow</span>
                <strong>Local session</strong>
              </div>
              <span className="demo-status">No upload path</span>
            </div>
            <div className="demo-grid">
              <div className="demo-panel meta-demo">
                <div className="demo-panel-head">
                  <ShieldCheck size={17} />
                  <span>Metadata stripped</span>
                </div>
                <div className="demo-meta-row">
                  <span>gps / Latitude</span>
                  <b>Removed</b>
                </div>
                <div className="demo-meta-row">
                  <span>exif / Camera Model</span>
                  <b>Removed</b>
                </div>
                <div className="demo-meta-row is-muted">
                  <span>file / Image Width</span>
                  <b>Structural</b>
                </div>
              </div>
              <div className="demo-panel redact-demo">
                <div className="demo-panel-head">
                  <ScanLine size={17} />
                  <span>Sensitive areas covered</span>
                </div>
                <div className="demo-photo">
                  <span className="demo-person one" />
                  <span className="demo-person two" />
                  <span className="demo-box black" />
                  <span className="demo-box blur" />
                  <span className="demo-box pixel" />
                </div>
              </div>
              <div className="demo-panel compress-demo">
                <div className="demo-panel-head">
                  <ImageIcon size={17} />
                  <span>File size reduced</span>
                </div>
                <div className="size-stat">
                  <span>Original</span>
                  <b>4.8 MB</b>
                </div>
                <div className="size-bar">
                  <span style={{ width: '100%' }} />
                </div>
                <div className="size-stat">
                  <span>Output</span>
                  <b>612 KB</b>
                </div>
                <div className="size-bar output">
                  <span style={{ width: '22%' }} />
                </div>
              </div>
            </div>
            <div className="demo-footer">
              <span>
                <CheckCircle2 size={15} />
                Files stay on-device
              </span>
              <span>
                <Download size={15} />
                Clean exports
              </span>
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
            <RouteLink className="tool-card primary-tool share-safe-card" href="/share-safe">
              <span className="tool-icon">
                <BadgeCheck size={28} />
              </span>
              <div>
                <span className="tool-kicker">Recommended first step</span>
                <h3>Share-Safe Image Cleaner</h3>
                <p>Strip hidden details, prepare an image, and verify the exported copy before sharing.</p>
              </div>
            </RouteLink>
            <RouteLink className="tool-card primary-tool" href="/meta-stripper">
              <span className="tool-icon">
                <ShieldCheck size={28} />
              </span>
              <div>
                <span className="tool-kicker">Start here</span>
                <h3>Image Meta Stripper</h3>
                <p>Show image metadata, strip it, and download a cleaned copy.</p>
              </div>
            </RouteLink>
            <RouteLink className="tool-card" href="/compress">
              <span className="tool-icon">
                <ImageIcon size={28} />
              </span>
              <div>
                <span className="tool-kicker">Resize</span>
                <h3>Image Compressor</h3>
                <p>Resize and compress JPEG, PNG, and WebP images locally.</p>
              </div>
            </RouteLink>
            <RouteLink className="tool-card" href="/redact">
              <span className="tool-icon">
                <ScanLine size={28} />
              </span>
              <div>
                <span className="tool-kicker">Cover details</span>
                <h3>Image Redactor</h3>
                <p>Cover sensitive areas manually, then export a flattened image.</p>
              </div>
            </RouteLink>
          </div>
        </div>
      </section>

      <TrustSections />
    </>
  );
}

function ShareSafePage({ RouteLink }: { RouteLink: React.ComponentType<RouteLinkProps> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [report, setReport] = useState<PrivacyReport | null>(null);
  const [verification, setVerification] = useState<CleanVerification | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFile = useCallback(async (fileList: FileList | File[]) => {
    const nextFile = Array.from(fileList).find(isPrivacyImageFile);
    if (!nextFile) {
      setError('Please choose an image file.');
      return;
    }

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(nextFile);
    });
    setFile(nextFile);
    setVerification(null);
    setError(null);
    setIsWorking(true);
    try {
      setReport(await inspectPrivacy(nextFile));
    } catch (nextError) {
      setReport(null);
      setError(nextError instanceof Error ? nextError.message : 'This image could not be inspected.');
    } finally {
      setIsWorking(false);
    }
  }, []);

  const cleanAndVerify = async () => {
    if (!file) return;
    setIsWorking(true);
    setError(null);
    setVerification(null);
    try {
      const cleaned = await cleanPrivacyImage(file, 1);
      const result = await verifyCleanImage(cleaned.blob);
      downloadBlob(cleaned.blob, cleaned.filename);
      trackImageExport('meta_stripper');
      setVerification(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'This image could not be prepared in this browser.');
    } finally {
      setIsWorking(false);
    }
  };

  const clear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setReport(null);
    setVerification(null);
    setError(null);
  };

  return (
    <>
      <section className="tool-hero">
        <div className="wrap tool-hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge"><BadgeCheck size={15} /> Share-safe workflow</span>
              <span className="hero-badge"><Laptop size={15} /> Local processing</span>
            </div>
            <h1>Prepare an image before sharing</h1>
            <p className="hero-sub">Inspect hidden metadata, create a clean copy, and verify the exported file in this browser. <b>Your original stays on your device.</b></p>
          </div>
          <RouteLink className="btn btn-ghost" href="/">Suite hub</RouteLink>
        </div>
      </section>

      <section className="band band-tray">
        <div className="wrap">
          <div className="share-safe-layout">
            <aside className="privacy-summary share-safe-summary" aria-label="Share-Safe workflow">
              <div className="panel-heading"><BadgeCheck size={16} /><h2>Share-Safe</h2></div>
              <ol className="workflow-steps">
                <li className={file ? 'is-done' : 'is-active'}><span>1</span> Inspect</li>
                <li className={verification ? 'is-done' : file ? 'is-active' : ''}><span>2</span> Clean</li>
                <li className={verification ? 'is-active' : ''}><span>3</span> Verify</li>
              </ol>
              <p className="trust-note">No filenames, image data, metadata values, or file details are sent to analytics.</p>
              <button className="run-button" type="button" onClick={cleanAndVerify} disabled={!file || !report?.canClean || isWorking}>
                {isWorking ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
                Clean and verify
              </button>
              <button className="btn btn-ghost full-width-btn" type="button" onClick={clear} disabled={!file}><RotateCcw size={16} /> Clear</button>
            </aside>

            <section className="share-safe-workspace">
              <div
                className={`share-safe-upload ${isDragging ? 'is-dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void addFile(event.dataTransfer.files);
                }}
              >
                <input ref={inputRef} type="file" accept="image/*,.heic,.heif,.avif" onChange={(event) => {
                  if (event.target.files) {
                    void addFile(event.target.files);
                    event.target.value = '';
                  }
                }} />
                {previewUrl ? <img src={previewUrl} alt="Selected image" /> : <Images size={42} />}
                <div>
                  <h3>{file ? file.name : 'Choose an image to prepare'}</h3>
                  <p>{file ? 'The original file remains available only in this browser tab.' : 'JPEG, PNG, WebP, GIF, HEIC, and AVIF where browser support allows.'}</p>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}><Upload size={16} /> {file ? 'Replace image' : 'Add image'}</button>
              </div>

              {report ? (
                <div className="share-safe-report">
                  <div className="share-safe-report-head"><div><span className="tool-kicker">Step 1</span><h2>Inspection result</h2></div><StatusPill status={report.status} busy={isWorking} /></div>
                  <p>{report.message}</p>
                  <div className="share-safe-checks">
                    <div><strong>{report.metadata.length}</strong><span>metadata fields found</span></div>
                    <div><strong>{report.findings.length}</strong><span>privacy findings</span></div>
                    <div><strong>{report.canClean ? 'Yes' : 'No'}</strong><span>browser cleaning</span></div>
                  </div>
                  {report.findings.length > 0 ? <ul className="finding-list">{report.findings.map((finding) => <li className={`risk-${finding.risk}`} key={finding.key}>{finding.label}</li>)}</ul> : null}
                  <div className="share-safe-next"><span>Need to cover something visible in the image?</span><RouteLink className="btn btn-ghost" href="/redact"><ScanLine size={16} /> Open Redactor</RouteLink></div>
                </div>
              ) : <div className="empty-list privacy-empty">Choose an image to begin the local inspection.</div>}

              {verification ? (
                <div className={`verification-panel ${verification.passed ? 'is-passed' : 'is-warning'}`}>
                  <div className="share-safe-report-head"><div><span className="tool-kicker">Step 3</span><h2>{verification.passed ? 'Ready to share' : 'Review the cleaned copy'}</h2></div>{verification.passed ? <CheckCircle2 size={24} /> : <X size={24} />}</div>
                  <p>{verification.passed ? 'The exported image was inspected after cleaning. No common sensitive metadata categories remain.' : 'The exported image still needs review before sharing.'}</p>
                  <div className="verification-details"><span>Remaining sensitive findings <b>{verification.remainingFindings.length}</b></span><span>Remaining parsed fields <b>{verification.remainingMetadata}</b></span>{verification.sha256 ? <span>SHA-256 <code>{verification.sha256}</code></span> : null}</div>
                </div>
              ) : null}
              {error ? <em className="privacy-error">{error}</em> : null}
            </section>
          </div>
        </div>
      </section>
      <TrustSections />
    </>
  );
}

function ImageMetaStripperPage({
  RouteLink,
  title = 'Image Meta Stripper',
  intro = 'Inspect images for common metadata risks, then re-encode a clean copy where your browser supports it.',
}: {
  RouteLink: React.ComponentType<RouteLinkProps>;
  title?: string;
  intro?: string;
}) {
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
      trackImageExport('meta_stripper');
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
            <h1>{title}</h1>
            <p className="hero-sub">
              {intro}
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
            <aside className="privacy-summary" aria-label="Image Meta Stripper summary">
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
                NoUpload does not send filenames, metadata values, file sizes, or image blobs to Google Analytics.
                Anonymous export counts help us measure tool usage.
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

function ImageRedactorPage({ RouteLink }: { RouteLink: React.ComponentType<RouteLinkProps> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [draft, setDraft] = useState<DraftRect | null>(null);
  const [mode, setMode] = useState<RedactionMode>('black');
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFile = useCallback((fileList: FileList | File[]) => {
    const nextFile = Array.from(fileList).find(isImageFile);
    if (!nextFile) {
      return;
    }

    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(nextFile);
    });
    setFile(nextFile);
    setRects([]);
    setDraft(null);
    setError(null);
  }, []);

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setRects([]);
    setDraft(null);
    setError(null);
  };

  const pointFromEvent = (event: React.PointerEvent): { x: number; y: number } | null => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return null;
    }

    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  const exportImage = async () => {
    if (!file || rects.length === 0) {
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const result = await redactImage(file, rects);
      downloadBlob(result.blob, result.filename);
      trackImageExport('redactor');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'This image could not be redacted in this browser.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <section className="tool-hero">
        <div className="wrap tool-hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge">
                <Square size={15} />
                Manual
              </span>
              <span className="hero-badge">
                <Laptop size={15} />
                Local processing
              </span>
            </div>
            <h1>Image Redactor</h1>
            <p className="hero-sub">
              Cover names, addresses, faces, plates, tokens, and other sensitive areas before sharing.
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
          <div className="redactor-grid">
            <aside className="redactor-panel" aria-label="Image Redactor controls">
              <div className="panel-heading">
                <ScanLine size={16} />
                <h2>Redact</h2>
              </div>

              <div className="mode-group" role="group" aria-label="Redaction mode">
                {REDACTION_MODES.map((item) => (
                  <button
                    className={`mode-button ${mode === item.mode ? 'is-active' : ''}`}
                    key={item.mode}
                    type="button"
                    onClick={() => setMode(item.mode)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="redactor-count">
                <span>{rects.length}</span>
                <p>Areas marked</p>
              </div>

              <button
                className="run-button"
                type="button"
                onClick={exportImage}
                disabled={!file || rects.length === 0 || isExporting}
              >
                {isExporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                Export redacted
              </button>

              <button
                className="btn btn-ghost full-width-btn"
                type="button"
                onClick={() => setRects((current) => current.slice(0, -1))}
                disabled={rects.length === 0 || isExporting}
              >
                <RotateCcw size={16} />
                Undo area
              </button>

              <button className="btn btn-ghost full-width-btn" type="button" onClick={clearImage} disabled={!file}>
                <X size={16} />
                Clear image
              </button>

              <p className="trust-note">
                Export creates a flattened JPEG and strips metadata after redaction. Analytics records only that an
                export completed and which tool was used.
              </p>
              {error ? <em className="privacy-error">{error}</em> : null}
            </aside>

            <section
              className={`redactor-stage-shell ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFile(event.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  if (event.target.files) {
                    addFile(event.target.files);
                    event.target.value = '';
                  }
                }}
              />
              {previewUrl ? (
                <div
                  className="redactor-stage"
                  ref={stageRef}
                  onPointerDown={(event) => {
                    const point = pointFromEvent(event);
                    if (!point) {
                      return;
                    }
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraft({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
                  }}
                  onPointerMove={(event) => {
                    if (!draft) {
                      return;
                    }
                    const point = pointFromEvent(event);
                    if (!point) {
                      return;
                    }
                    setDraft((current) => (current ? { ...current, currentX: point.x, currentY: point.y } : current));
                  }}
                  onPointerUp={(event) => {
                    const point = pointFromEvent(event);
                    if (point && draft) {
                      const rect = normalizeRedactionRect(
                        { ...draft, currentX: point.x, currentY: point.y },
                        mode,
                        crypto.randomUUID(),
                      );
                      if (rect) {
                        setRects((current) => [...current, rect]);
                      }
                    }
                    setDraft(null);
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => setDraft(null)}
                >
                  <img src={previewUrl} alt="" draggable={false} />
                  {rects.map((rect) => (
                    <div className={`redaction-box mode-${rect.mode}`} key={rect.id} style={rectToPercentStyle(rect)} />
                  ))}
                  {draft ? (
                    <div
                      className={`redaction-box is-draft mode-${mode}`}
                      style={
                        rectToPercentStyle(
                          normalizeRedactionRect(draft, mode, 'draft') ?? {
                            id: 'draft',
                            mode,
                            x: Math.min(draft.startX, draft.currentX),
                            y: Math.min(draft.startY, draft.currentY),
                            width: Math.abs(draft.currentX - draft.startX),
                            height: Math.abs(draft.currentY - draft.startY),
                          },
                        )
                      }
                    />
                  ) : null}
                </div>
              ) : (
                <div className="redactor-empty">
                  <Images size={42} />
                  <div>
                    <h3>Drop one image to redact</h3>
                    <p>Draw boxes over sensitive areas, then export a flattened copy.</p>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
                    <Upload size={16} />
                    Add image
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <TrustSections />
    </>
  );
}

function ImageCompressorPage() {
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
      trackImageExport('compressor');
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
            <h1>Image Compressor</h1>
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
                            trackImageExport('compressor');
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
              File processing runs in your browser. Google Analytics records page views and anonymous aggregate export
              counts, but NoUpload does not send filenames, metadata values, file sizes, image blobs, or other file
              details as analytics data.
            </p>
            <ul className="facts">
              <li>Your files never leave your device</li>
              <li>No account, sign-in, or email required</li>
              <li>Analytics events include only aggregate tool and export counts</li>
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
              <b>What this site collects:</b> standard page-view analytics plus an anonymous aggregate
              <code>image_export</code> event identifying which tool completed a download. Google Analytics may record
              approximate location, device/browser type, and pages visited. NoUpload does not send filenames, image
              data, metadata values, file sizes, dimensions, or file counts.
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
          <RouteLink href="/share-safe">Share-Safe Workflow</RouteLink>
          <RouteLink href="/remove-gps-from-photo">Remove GPS from Photos</RouteLink>
          <RouteLink href="/meta-stripper">Image Meta Stripper</RouteLink>
          <RouteLink href="/redact">Image Redactor</RouteLink>
          <RouteLink href="/compress">Image Compressor</RouteLink>
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
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/share-safe') {
    return '/share-safe';
  }
  if (path === '/remove-gps-from-photo') {
    return '/remove-gps-from-photo';
  }
  if (path === '/meta-stripper' || path === '/privacy-check') {
    return '/meta-stripper';
  }
  if (path === '/redact') {
    return '/redact';
  }
  if (path === '/compress') {
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
