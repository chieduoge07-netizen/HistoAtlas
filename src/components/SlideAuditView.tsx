import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileSearch,
  Grid,
  ImageOff,
  Loader2,
  Microscope,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { DEFAULT_CHAPTER_ORDER } from '../data/defaultSlides';
import { SYSTEM_SECTIONS } from '../data/histologyCatalog';
import {
  AnatomicalSystem,
  Slide,
  SlideAuditIssueCode,
  SlideIdentification,
  SlideQualityStatus,
} from '../types/histology';
import {
  ISSUE_INFO,
  measureImageAndComputeDHash,
  probeServerImagesBatch,
  QUALITY_STATUS_OPTIONS,
  runMetadataAndHeuristicAudit,
} from '../utils/slideAudit';
import { IdentificationEditor } from './IdentificationEditor';

interface SlideAuditViewProps {
  slides: Slide[];
  onUpdateSlide: (slideId: string, updates: Partial<Slide>) => void;
  onBatchUpdateSlides: (updater: (prev: Slide[]) => Slide[]) => void;
  onOpenSlideInViewer: (slideId: string) => void;
}

const PAGE_SIZE = 24;

function getStatusBadgeStyle(status: SlideQualityStatus): string {
  switch (status) {
    case 'verified':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/70';
    case 'needs-review':
      return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/70';
    case 'poor-image-quality':
    case 'not-histology':
      return 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800/70';
    case 'pathology':
    case 'incorrect-category':
    case 'duplicate':
      return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-800/70';
  }
}

const AuditThumbnail: React.FC<{
  slide: Slide;
  heightClass?: string;
}> = ({ slide, heightClass = 'h-48' }) => {
  const candidates = useMemo(() => {
    const list: string[] = [];
    for (const u of [slide.imageUrl, slide.highResUrl, slide.thumbnailUrl]) {
      if (u && !list.includes(u)) list.push(u);
    }
    return list;
  }, [slide.imageUrl, slide.highResUrl, slide.thumbnailUrl]);

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [useProxy, setUseProxy] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setCandidateIdx(0);
    setUseProxy(false);
    setBroken(false);
  }, [slide.id, candidates]);

  const rawSrc = candidates[candidateIdx] ?? '';
  const src =
    useProxy && rawSrc.startsWith('https://')
      ? `/api/image-proxy?url=${encodeURIComponent(rawSrc)}`
      : rawSrc;

  return (
    <div
      className={`relative flex ${heightClass} w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#0B0F17]`}
    >
      {!rawSrc || broken ? (
        <div className="flex flex-col items-center gap-1.5 px-4 text-center text-slate-400">
          <ImageOff className="h-7 w-7" aria-hidden="true" />
          <span className="text-[11px] font-medium">
            {!rawSrc ? 'External reference / no image URL' : 'Failed to load micrograph'}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={slide.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => {
            if (!useProxy && rawSrc.startsWith('https://')) {
              setUseProxy(true);
            } else if (candidateIdx + 1 < candidates.length) {
              setCandidateIdx((i) => i + 1);
              setUseProxy(false);
            } else {
              setBroken(true);
            }
          }}
        />
      )}
    </div>
  );
};

export const SlideAuditView: React.FC<SlideAuditViewProps> = ({
  slides,
  onUpdateSlide,
  onBatchUpdateSlides,
  onOpenSlideInViewer,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | SlideQualityStatus>('all');
  const [issueFilter, setIssueFilter] = useState<'all' | 'any-issue' | SlideAuditIssueCode>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [viewMode, setViewMode] = useState<'gallery' | 'rapid'>('gallery');
  const [inspectedSlideId, setInspectedSlideId] = useState<string | null>(null);
  const [rapidIndex, setRapidIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Live deep image scan state
  const [deepScanRunning, setDeepScanRunning] = useState(false);
  const [deepScanProgress, setDeepScanProgress] = useState({ done: 0, total: 0, note: '' });
  const scanCancelledRef = useRef(false);
  const [lastAuditSummaryNote, setLastAuditSummaryNote] = useState<string | null>(null);

  const auditReport = useMemo(() => runMetadataAndHeuristicAudit(slides), [slides]);

  const statusCounts = useMemo(() => {
    const counts: Record<SlideQualityStatus, number> = {
      verified: 0,
      'needs-review': 0,
      'poor-image-quality': 0,
      'incorrect-category': 0,
      duplicate: 0,
      pathology: 0,
      'not-histology': 0,
    };
    for (const s of slides) {
      const st = s.qualityStatus ?? 'needs-review';
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [slides]);

  const filteredSlides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return slides.filter((slide) => {
      const st = slide.qualityStatus ?? 'needs-review';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (systemFilter !== 'all' && slide.anatomicalSystem !== systemFilter) return false;

      const issues = auditReport.issuesBySlideId[slide.id] ?? [];
      if (issueFilter === 'any-issue' && issues.length === 0) return false;
      if (
        issueFilter !== 'all' &&
        issueFilter !== 'any-issue' &&
        !issues.some((i) => i.code === issueFilter)
      ) {
        return false;
      }

      if (!q) return true;
      const hay = `${slide.title} ${slide.specimen} ${slide.organ} ${slide.tissueType} ${slide.stain} ${slide.sourceInstitution} ${slide.license}`.toLowerCase();
      return hay.includes(q);
    });
  }, [slides, statusFilter, systemFilter, issueFilter, searchQuery, auditReport]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, issueFilter, systemFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSlides.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedSlides = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSlides.slice(start, start + PAGE_SIZE);
  }, [filteredSlides, currentPage]);

  const inspectedSlide = useMemo(
    () => slides.find((s) => s.id === inspectedSlideId) ?? null,
    [slides, inspectedSlideId]
  );

  const rapidSlide = filteredSlides[rapidIndex % Math.max(1, filteredSlides.length)] ?? null;

  const handleRunMetadataAudit = () => {
    const summary = runMetadataAndHeuristicAudit(slides);
    const now = Date.now();
    onBatchUpdateSlides((prev) =>
      prev.map((slide) => {
        const issues = summary.issuesBySlideId[slide.id] ?? [];
        const codes = issues.map((i) => i.code);
        return {
          ...slide,
          auditFlags: codes,
          lastAuditedAt: now,
        };
      })
    );
    setLastAuditSummaryNote(
      `Metadata & heuristic audit inspected ${slides.length} slides: ${summary.cleanCount} clean, ${summary.flaggedCount} flagged with metadata/heuristic/duplicate notices. No slides were deleted.`
    );
  };

  const handleRunDeepImageScan = async () => {
    const targetSlides = filteredSlides.length > 0 && filteredSlides.length < slides.length
      ? filteredSlides
      : slides;

    scanCancelledRef.current = false;
    setDeepScanRunning(true);
    setDeepScanProgress({
      done: 0,
      total: targetSlides.length,
      note: 'Probing remote image HTTP status & MIME types...',
    });

    const probeResults = new Map<string, { broken: boolean; invalidMime: boolean }>();
    const measuredResults = new Map<
      string,
      { width: number; height: number; visualHash: string; ok: boolean }
    >();

    // Phase 1: Batch server HEAD/MIME checks (25 at a time)
    const remoteTargets = targetSlides
      .map((s) => ({ id: s.id, url: s.imageUrl || s.highResUrl || s.thumbnailUrl || '' }))
      .filter((item) => item.url.startsWith('https://'));

    for (let i = 0; i < remoteTargets.length; i += 25) {
      if (scanCancelledRef.current) break;
      const chunk = remoteTargets.slice(i, i + 25);
      try {
        const results = await probeServerImagesBatch(chunk);
        for (const r of results) {
          const broken = !r.ok || r.status === 0 || r.status >= 400;
          const invalidMime =
            r.ok &&
            (!r.contentType.startsWith('image/') || r.contentType.includes('svg'));
          probeResults.set(r.id, { broken, invalidMime });
        }
      } catch {
        // continue with remaining chunks
      }
      setDeepScanProgress({
        done: Math.min(i + chunk.length, remoteTargets.length),
        total: targetSlides.length,
        note: `HTTP/MIME checked ${Math.min(i + chunk.length, remoteTargets.length)}/${remoteTargets.length} remote slides...`,
      });
    }

    // Phase 2: Browser Canvas Resolution + 64-bit dHash (concurrency 3)
    if (!scanCancelledRef.current) {
      let cursor = 0;
      let done = 0;
      const runWorker = async () => {
        while (cursor < targetSlides.length && !scanCancelledRef.current) {
          const idx = cursor++;
          const slide = targetSlides[idx];
          const probe = probeResults.get(slide.id);
          if (probe?.broken) {
            measuredResults.set(slide.id, { width: 0, height: 0, visualHash: '', ok: false });
          } else {
            const res = await measureImageAndComputeDHash(slide);
            measuredResults.set(slide.id, res);
          }
          done++;
          if (done % 4 === 0 || done === targetSlides.length) {
            setDeepScanProgress({
              done,
              total: targetSlides.length,
              note: `Measured resolution & visual dHash for ${done}/${targetSlides.length} slides...`,
            });
          }
        }
      };
      await Promise.all([runWorker(), runWorker(), runWorker()]);
    }

    // Persist findings non-destructively
    const now = Date.now();
    onBatchUpdateSlides((prev) => {
      const updated = prev.map((slide) => {
        const probe = probeResults.get(slide.id);
        const meas = measuredResults.get(slide.id);
        if (!probe && !meas) return slide;

        const nextFlags = new Set<SlideAuditIssueCode>(
          (slide.auditFlags ?? []).filter(
            (f) => f !== 'broken-image' && f !== 'invalid-mime' && f !== 'low-resolution'
          )
        );
        if (probe?.broken || (meas && !meas.ok && (slide.imageUrl || slide.thumbnailUrl))) {
          nextFlags.add('broken-image');
        }
        if (probe?.invalidMime) {
          nextFlags.add('invalid-mime');
        }
        if (
          meas?.ok &&
          meas.width > 0 &&
          meas.height > 0 &&
          (Math.min(meas.width, meas.height) < 400 || meas.width * meas.height < 200_000)
        ) {
          nextFlags.add('low-resolution');
        }

        return {
          ...slide,
          imageDimensions:
            meas && meas.width > 0 ? { width: meas.width, height: meas.height } : slide.imageDimensions,
          visualHash: meas?.visualHash || slide.visualHash,
          auditFlags: Array.from(nextFlags),
          lastAuditedAt: now,
        };
      });

      const finalSummary = runMetadataAndHeuristicAudit(updated);
      return updated.map((s) => ({
        ...s,
        auditFlags: (finalSummary.issuesBySlideId[s.id] ?? []).map((i) => i.code),
      }));
    });

    setDeepScanRunning(false);
    setLastAuditSummaryNote(
      scanCancelledRef.current
        ? `Live scan stopped early after checking ${measuredResults.size} slides.`
        : `Completed live HTTP/MIME, resolution, and dHash visual similarity scan across ${targetSlides.length} slides.`
    );
  };

  const setSlideStatus = (slideId: string, qualityStatus: SlideQualityStatus) => {
    onUpdateSlide(slideId, {
      qualityStatus,
      lastAuditedAt: Date.now(),
    });
  };

  const toggleSelectSlide = (slideId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  };

  const applyBulkStatus = (qualityStatus: SlideQualityStatus) => {
    if (selectedIds.size === 0) return;
    const now = Date.now();
    onBatchUpdateSlides((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id) ? { ...s, qualityStatus, lastAuditedAt: now } : s
      )
    );
    setSelectedIds(new Set());
  };

  // Keyboard shortcuts inside Rapid Visual Review mode
  useEffect(() => {
    if (viewMode !== 'rapid' || !rapidSlide) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setRapidIndex((i) => (i - 1 + filteredSlides.length) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'v') {
        setSlideStatus(rapidSlide.id, 'verified');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'p') {
        setSlideStatus(rapidSlide.id, 'pathology');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'n') {
        setSlideStatus(rapidSlide.id, 'not-histology');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'd') {
        setSlideStatus(rapidSlide.id, 'duplicate');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'c') {
        setSlideStatus(rapidSlide.id, 'incorrect-category');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      } else if (e.key.toLowerCase() === 'q') {
        setSlideStatus(rapidSlide.id, 'poor-image-quality');
        setRapidIndex((i) => (i + 1) % Math.max(1, filteredSlides.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, rapidSlide, filteredSlides.length]);

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090C12] dark:text-slate-100">
      {/* Main Audit Workspace */}
      <div className="histo-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          {/* Header & Audit Runners */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Slide Quality Audit & Visual Review
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inspect all {slides.length} slides for broken images, resolution, visual duplicates, pathology mix-ups, category errors, and missing metadata. Questionable slides are flagged—never deleted.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunMetadataAudit}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
              >
                <FileSearch className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Run Metadata & Duplicate Audit</span>
              </button>

              {deepScanRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    scanCancelledRef.current = true;
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 whitespace-nowrap"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Stop Image Scan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRunDeepImageScan}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {filteredSlides.length < slides.length
                      ? `Live Image & dHash Scan (${filteredSlides.length})`
                      : `Live Image & dHash Scan (${slides.length})`}
                  </span>
                </button>
              )}

              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('gallery')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'gallery'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  <span>Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('rapid');
                    setRapidIndex(0);
                  }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'rapid'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Rapid Review</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scan Progress or Notice Banner */}
          {deepScanRunning && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-800/70 dark:bg-blue-950/30">
              <div className="flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-200">
                <span>{deepScanProgress.note}</span>
                <span className="font-mono tabular-nums">
                  {deepScanProgress.done}/{deepScanProgress.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900/60">
                <div
                  style={{
                    width: `${
                      deepScanProgress.total > 0
                        ? Math.round((deepScanProgress.done / deepScanProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                />
              </div>
            </div>
          )}

          {lastAuditSummaryNote && !deepScanRunning && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300">
              <span>{lastAuditSummaryNote}</span>
              <button
                type="button"
                onClick={() => setLastAuditSummaryNote(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Status Summary Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300'
              }`}
            >
              All ({slides.length})
            </button>

            {QUALITY_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300'
                }`}
              >
                {opt.shortLabel} ({statusCounts[opt.value] ?? 0})
              </button>
            ))}
          </div>

          {/* Search, Issue Filter & System Filter */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, specimen, organ, stain, source, license..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111622] dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Filter by detected audit issue"
              value={issueFilter}
              onChange={(e) =>
                setIssueFilter(e.target.value as 'all' | 'any-issue' | SlideAuditIssueCode)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-[#111622] dark:text-slate-200"
            >
              <option value="all">Audit Issues: Show All</option>
              <option value="any-issue">
                Any Flagged Issue ({auditReport.flaggedCount})
              </option>
              {(Object.keys(ISSUE_INFO) as SlideAuditIssueCode[]).map((code) => (
                <option key={code} value={code}>
                  {ISSUE_INFO[code].label} ({auditReport.issueCounts[code] ?? 0})
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by anatomical system"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-[#111622] dark:text-slate-200"
            >
              <option value="all">All Anatomical Systems</option>
              {SYSTEM_SECTIONS.map((s) => (
                <option key={s.code} value={s.system}>
                  {s.code}. {s.system}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Selection Bar */}
          {selectedIds.size > 0 && viewMode === 'gallery' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs dark:border-blue-800/70 dark:bg-blue-950/30">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                {selectedIds.size} slide{selectedIds.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyBulkStatus('verified')}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  Approve Verified
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkStatus('pathology')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Mark Pathology
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkStatus('not-histology')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Mark Not Histology
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkStatus('duplicate')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Mark Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-1 text-[11px] text-slate-500 hover:underline dark:text-slate-400"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Rapid Visual Review Mode OR Gallery Mode */}
          {filteredSlides.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#111622]">
              <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                No slides match the current audit filters
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setIssueFilter('all');
                  setSystemFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Reset all audit filters
              </button>
            </div>
          ) : viewMode === 'rapid' && rapidSlide ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-500">
                    Slide {(rapidIndex % filteredSlides.length) + 1} / {filteredSlides.length}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getStatusBadgeStyle(
                      rapidSlide.qualityStatus ?? 'needs-review'
                    )}`}
                  >
                    {QUALITY_STATUS_OPTIONS.find(
                      (o) => o.value === (rapidSlide.qualityStatus ?? 'needs-review')
                    )?.label ?? 'Needs Review'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Shortcuts: V=Verify · Q=Poor · C=Wrong Cat · D=Dup · P=Pathology · N=Not Hist · ←/→ Navigate</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <AuditThumbnail slide={rapidSlide} heightClass="h-96 rounded-lg border border-slate-200 dark:border-slate-800" />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRapidIndex(
                          (i) => (i - 1 + filteredSlides.length) % filteredSlides.length
                        )
                      }
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectedSlideId(rapidSlide.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Recategorize & Identification Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRapidIndex((i) => (i + 1) % filteredSlides.length)
                      }
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                      {rapidSlide.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Specimen: {rapidSlide.specimen} · Organ: {rapidSlide.organ}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {rapidSlide.anatomicalSystem} · {rapidSlide.tissueType} · {rapidSlide.stain} ·{' '}
                      <span className="font-mono">{rapidSlide.magnification}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Source: {rapidSlide.sourceInstitution} · License: {rapidSlide.license}
                    </p>
                  </div>

                  {(auditReport.issuesBySlideId[rapidSlide.id] ?? []).length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-800/60 dark:bg-amber-950/30">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Detected Audit Notices
                      </p>
                      <ul className="mt-1 space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                        {(auditReport.issuesBySlideId[rapidSlide.id] ?? []).map((iss) => (
                          <li key={iss.code}>• {iss.label}: {iss.detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                    {QUALITY_STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSlideStatus(rapidSlide.id, opt.value);
                          setRapidIndex((i) => (i + 1) % filteredSlides.length);
                        }}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          opt.value === 'verified'
                            ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Visual Review Gallery Grid */
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filteredSlides.length)} of{' '}
                  {filteredSlides.length} matching slides
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800"
                  >
                    Prev
                  </button>
                  <span className="font-mono tabular-nums">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedSlides.map((slide) => {
                  const status = slide.qualityStatus ?? 'needs-review';
                  const issues = auditReport.issuesBySlideId[slide.id] ?? [];
                  const isSelected = selectedIds.has(slide.id);

                  return (
                    <article
                      key={slide.id}
                      className={`flex flex-col overflow-hidden rounded-xl border bg-white transition-colors dark:bg-[#111622] ${
                        inspectedSlideId === slide.id
                          ? 'border-blue-500 ring-1 ring-blue-500/40'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Thumbnail + Overlay Selection & Status */}
                      <div className="relative border-b border-slate-200 dark:border-slate-800">
                        <AuditThumbnail slide={slide} heightClass="h-48" />

                        <label className="absolute left-2.5 top-2.5 flex cursor-pointer items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-800 shadow-sm dark:bg-slate-900/90 dark:text-slate-100">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSlide(slide.id)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span>Select</span>
                        </label>

                        <span
                          className={`absolute right-2.5 top-2.5 rounded-md border px-2 py-0.5 text-[11px] font-medium shadow-sm ${getStatusBadgeStyle(
                            status
                          )}`}
                        >
                          {QUALITY_STATUS_OPTIONS.find((o) => o.value === status)?.shortLabel ??
                            status}
                        </span>

                        {slide.imageDimensions && (
                          <span className="absolute bottom-2 right-2.5 rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
                            {slide.imageDimensions.width}×{slide.imageDimensions.height}
                          </span>
                        )}
                      </div>

                      {/* Card Metadata Body */}
                      <div className="flex flex-1 flex-col gap-2 p-3.5 text-xs">
                        <div>
                          <h3 className="line-clamp-1 font-semibold text-slate-900 dark:text-slate-50">
                            {slide.title}
                          </h3>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">
                            Specimen: {slide.specimen}
                          </p>
                        </div>

                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          <div>
                            <dt className="text-slate-400">Category</dt>
                            <dd className="truncate font-medium text-slate-700 dark:text-slate-300">
                              {slide.anatomicalSystem} · {slide.tissueType}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Stain · Mag</dt>
                            <dd className="truncate font-medium text-slate-700 dark:text-slate-300">
                              {slide.stain} · {slide.magnification}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Source</dt>
                            <dd className="truncate text-slate-600 dark:text-slate-400">
                              {slide.sourceInstitution}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">License</dt>
                            <dd className="truncate text-slate-600 dark:text-slate-400">
                              {slide.license}
                            </dd>
                          </div>
                        </dl>

                        {issues.length > 0 && (
                          <div className="mt-1 rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-200">
                            <span className="font-semibold">
                              {issues.length} issue{issues.length === 1 ? '' : 's'}:{' '}
                            </span>
                            <span>{issues.map((i) => i.label).join(' · ')}</span>
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            {status !== 'verified' && (
                              <button
                                type="button"
                                onClick={() => setSlideStatus(slide.id, 'verified')}
                                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Approve</span>
                              </button>
                            )}

                            <select
                              aria-label={`Set quality status for ${slide.title}`}
                              value={status}
                              onChange={(e) =>
                                setSlideStatus(slide.id, e.target.value as SlideQualityStatus)
                              }
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {QUALITY_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.shortLabel}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInspectedSlideId(slide.id)}
                              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenSlideInViewer(slide.id)}
                              title="Inspect in Study Viewer"
                              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Slide Audit, Recategorize & Identification Inspector Drawer */}
      {inspectedSlide && (
        <aside
          aria-label="Slide Quality & Identification Inspector"
          className="histo-scroll flex h-full w-full max-w-md shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                Slide Inspector & Recategorizer
              </p>
              <h2 className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {inspectedSlide.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setInspectedSlideId(null)}
              aria-label="Close inspector"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <AuditThumbnail slide={inspectedSlide} heightClass="h-44" />
          </div>

          {/* Audit Status & Issues */}
          <div className="mt-4 flex flex-col gap-2.5">
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Quality Label
              <select
                value={inspectedSlide.qualityStatus ?? 'needs-review'}
                onChange={(e) =>
                  setSlideStatus(inspectedSlide.id, e.target.value as SlideQualityStatus)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {QUALITY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {(auditReport.issuesBySlideId[inspectedSlide.id] ?? []).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] dark:border-amber-800/60 dark:bg-amber-950/30">
                <p className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Audit Findings</span>
                </p>
                <ul className="mt-1 space-y-1 text-amber-800 dark:text-amber-300">
                  {(auditReport.issuesBySlideId[inspectedSlide.id] ?? []).map((iss) => (
                    <li key={iss.code}>• {iss.label}: {iss.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Editable Core Categorization & Attribution */}
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-[#0B0F17]">
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Specimen & Category Details
              </p>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Specimen Name
                <input
                  type="text"
                  value={inspectedSlide.specimen}
                  onChange={(e) =>
                    onUpdateSlide(inspectedSlide.id, { specimen: e.target.value })
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Anatomical System
                  <select
                    value={inspectedSlide.anatomicalSystem}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, {
                        anatomicalSystem: e.target.value as AnatomicalSystem,
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {SYSTEM_SECTIONS.map((s) => (
                      <option key={s.system} value={s.system}>
                        {s.system}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Chapter Deck
                  <select
                    value={inspectedSlide.chapter}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { chapter: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {Array.from(new Set([...DEFAULT_CHAPTER_ORDER, inspectedSlide.chapter])).map(
                      (ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Organ
                  <input
                    type="text"
                    value={inspectedSlide.organ}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { organ: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tissue Type
                  <input
                    type="text"
                    value={inspectedSlide.tissueType}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { tissueType: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Stain
                  <input
                    type="text"
                    value={inspectedSlide.stain}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { stain: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Magnification
                  <input
                    type="text"
                    value={inspectedSlide.magnification}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { magnification: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Attribution
                  <input
                    type="text"
                    value={inspectedSlide.attribution}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { attribution: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  License
                  <input
                    type="text"
                    value={inspectedSlide.license}
                    onChange={(e) =>
                      onUpdateSlide(inspectedSlide.id, { license: e.target.value })
                    }
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Reviewer Audit Notes
                <textarea
                  rows={2}
                  value={inspectedSlide.auditNotes ?? ''}
                  onChange={(e) =>
                    onUpdateSlide(inspectedSlide.id, { auditNotes: e.target.value })
                  }
                  placeholder="Optional curation note..."
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            {/* Structured Identification Editor */}
            <div className="pt-2">
              <IdentificationEditor
                identification={inspectedSlide.identification}
                fallbackOrgan={inspectedSlide.organ}
                fallbackTissue={inspectedSlide.tissueType}
                compact
                onSave={(nextId: SlideIdentification) =>
                  onUpdateSlide(inspectedSlide.id, { identification: nextId })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {inspectedSlide.originalSourceUrl ? (
                <a
                  href={inspectedSlide.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Original Source</span>
                </a>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => onOpenSlideInViewer(inspectedSlide.id)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Microscope className="h-3.5 w-3.5" />
                <span>Open in Viewer</span>
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
