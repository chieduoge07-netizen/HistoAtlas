import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  Compass,
  Download,
  ExternalLink,
  Loader2,
  Microscope,
  Search,
} from 'lucide-react';
import { SYSTEM_SECTIONS } from '../data/histologyCatalog';
import {
  AnatomicalSystem,
  DiscoveredSlideResult,
  Slide,
  SourceDescriptor,
} from '../types/histology';
import { cacheSlideImageOffline } from '../utils/storage';

interface DiscoverSlidesViewProps {
  initialQuery: string;
  initialSystem?: AnatomicalSystem | 'all';
  existingSlides: Slide[];
  onImportSlide: (slide: Slide) => void;
  onImportManySlides?: (slides: Slide[]) => void;
  onOpenExistingSlide: (slideId: string) => void;
}

const EXAMPLE_SEARCHES = [
  'Liver H&E',
  'Kidney cortex PAS',
  'Thyroid gland',
  'Cardiac muscle longitudinal section',
  'Cerebellum histology',
  'Elastic cartilage',
  'Small intestine villi',
  'Testis seminiferous tubules',
];

const STAIN_FILTERS = ['all', 'H&E', 'PAS', "Masson's Trichrome", 'Silver', 'Giemsa'];

export const DiscoverSlidesView: React.FC<DiscoverSlidesViewProps> = ({
  initialQuery,
  initialSystem = 'all',
  existingSlides,
  onImportSlide,
  onImportManySlides,
  onOpenExistingSlide,
}) => {
  const [sources, setSources] = useState<SourceDescriptor[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [queryInput, setQueryInput] = useState(initialQuery || 'Liver H&E');
  const [activeQuery, setActiveQuery] = useState(initialQuery || 'Liver H&E');
  const [systemFilter, setSystemFilter] = useState<string>(initialSystem);
  const [stainFilter, setStainFilter] = useState<string>('all');

  const [results, setResults] = useState<DiscoveredSlideResult[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<
    Array<{ sourceId: string; count: number; hasMore: boolean; error?: string }>
  >([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [batchStatusMsg, setBatchStatusMsg] = useState<string | null>(null);

  // Sync external initialQuery / initialSystem changes from Catalog or Global Search
  useEffect(() => {
    if (initialQuery) {
      setQueryInput(initialQuery);
      setActiveQuery(initialQuery);
    }
    if (initialSystem) {
      setSystemFilter(initialSystem);
    }
  }, [initialQuery, initialSystem]);

  // Fetch registered source connectors on mount
  useEffect(() => {
    let mounted = true;
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data: { sources?: SourceDescriptor[] }) => {
        if (!mounted || !data.sources) return;
        setSources(data.sources);
        setSelectedSourceIds(new Set(data.sources.map((s) => s.id)));
      })
      .catch(() => {
        if (mounted) {
          setErrorMsg('Could not load discovery source descriptors from server.');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const runSearch = useCallback(
    async (q: string, nextPage: number, append: boolean) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setErrorMsg(null);

      try {
        const params = new URLSearchParams({
          q: trimmed,
          system: systemFilter,
          stain: stainFilter,
          page: String(nextPage),
          limit: '12',
        });
        if (selectedSourceIds.size > 0 && selectedSourceIds.size < sources.length) {
          params.set('sources', Array.from(selectedSourceIds).join(','));
        }

        const res = await fetch(`/api/discover?${params.toString()}`);
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || `Discovery request failed (HTTP ${res.status})`);
        }

        const data = (await res.json()) as {
          results: DiscoveredSlideResult[];
          hasMore: boolean;
          sourceStatuses: Array<{ sourceId: string; count: number; hasMore: boolean; error?: string }>;
        };

        setResults((prev) => (append ? [...prev, ...data.results] : data.results));
        setHasMore(data.hasMore);
        setPage(nextPage);
        setSourceStatuses(data.sourceStatuses ?? []);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Discovery search failed.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [systemFilter, stainFilter, selectedSourceIds, sources.length]
  );

  // Trigger search whenever activeQuery, filters, or source selections settle
  useEffect(() => {
    if (sources.length === 0) return;
    runSearch(activeQuery, 1, false);
  }, [activeQuery, systemFilter, stainFilter, selectedSourceIds, sources.length, runSearch]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least 1 active
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImportOrSave = async (item: DiscoveredSlideResult) => {
    setImportingId(item.id);

    const existing = existingSlides.find(
      (s) => s.sourceId === item.id || (s.originalSourceUrl && s.originalSourceUrl === item.originalUrl && s.title === item.title)
    );
    if (existing) {
      setImportingId(null);
      onOpenExistingSlide(existing.id);
      return;
    }

    const slideId = `slide-${item.sourceId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let resolvedImageUrl = item.imageUrl || item.highResUrl || item.thumbnailUrl || '';

    // Attempt local offline caching for direct-import open-access images
    if (item.directImportAllowed && resolvedImageUrl.startsWith('https://')) {
      try {
        const { dataUrl } = await cacheSlideImageOffline(slideId, resolvedImageUrl, 'full');
        resolvedImageUrl = dataUrl;
      } catch {
        // Fallback smoothly to remote high-res HTTPS URL
      }
    }

    const matchedSystem =
      SYSTEM_SECTIONS.find((s) => s.system === item.anatomicalSystem)?.system ?? 'Basic Tissues';

    const newSlide: Slide = {
      id: slideId,
      chapter: matchedSystem === 'Basic Tissues' ? item.tissueType || 'Basic Tissues' : matchedSystem,
      title: item.title,
      specimen: item.specimenName,
      organ: item.organ,
      anatomicalSystem: matchedSystem,
      tissueType: item.tissueType,
      stain: item.stain,
      magnification: item.magnification,
      fieldWidthUm: 450,
      imageUrl: item.directImportAllowed ? resolvedImageUrl : '',
      thumbnailUrl: item.thumbnailUrl,
      highResUrl: item.highResUrl,
      tileSourceUrl: item.tileSourceUrl,
      overviewNotes: item.description,
      pins: [],
      sourceInstitution: item.sourceInstitution,
      sourceId: item.id,
      originalSourceUrl: item.originalUrl,
      license: item.license,
      attribution: item.attribution,
      importStatus: item.directImportAllowed ? 'imported' : 'external-reference',
      tags: item.tags,
      createdAt: Date.now(),
    };

    setImportingId(null);
    onImportSlide(newSlide);
  };

  const directImportableNew = results.filter((item) => {
    if (!item.directImportAllowed || !(item.imageUrl || item.highResUrl)) return false;
    return !existingSlides.some(
      (s) =>
        s.sourceId === item.id ||
        (s.imageUrl && s.imageUrl === item.imageUrl) ||
        s.title.toLowerCase() === item.title.toLowerCase()
    );
  });

  const handleBatchImportResults = () => {
    if (!onImportManySlides || directImportableNew.length === 0) return;
    const now = Date.now();
    const mapped: Slide[] = directImportableNew.map((item, idx) => {
      const matchedSystem =
        SYSTEM_SECTIONS.find((s) => s.system === item.anatomicalSystem)?.system ?? 'Basic Tissues';
      return {
        id: `slide-${item.sourceId}-${now}-${idx}`,
        chapter: matchedSystem === 'Basic Tissues' ? item.tissueType || 'Basic Tissues' : matchedSystem,
        title: item.title,
        specimen: item.specimenName,
        organ: item.organ,
        anatomicalSystem: matchedSystem,
        tissueType: item.tissueType,
        stain: item.stain,
        magnification: item.magnification,
        fieldWidthUm: 450,
        imageUrl: item.imageUrl || item.highResUrl || item.thumbnailUrl || '',
        thumbnailUrl: item.thumbnailUrl,
        highResUrl: item.highResUrl,
        tileSourceUrl: item.tileSourceUrl,
        overviewNotes: item.description,
        pins: [],
        sourceInstitution: item.sourceInstitution,
        sourceId: item.id,
        originalSourceUrl: item.originalUrl,
        license: item.license,
        attribution: item.attribution,
        importStatus: 'imported',
        tags: item.tags,
        createdAt: now + idx,
      };
    });
    onImportManySlides(mapped);
    setBatchStatusMsg(`Added ${mapped.length} new slides to your personal library.`);
  };

  return (
    <div className="histo-scroll flex-1 overflow-y-auto bg-slate-50 px-6 py-6 text-slate-900 dark:bg-[#090C12] dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        {/* Header & Search Form */}
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Compass className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Discover Histology Slides
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search live open-access microscopy repositories (Wikimedia Commons, Openverse) and
            university teaching atlases (Histology Guide, UMich, UIowa, Oklahoma).
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveQuery(queryInput);
            }}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search organ, tissue, cell type, or stain (e.g., Liver H&E, Kidney cortex PAS)..."
                aria-label="Search online histology slides"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#111622] dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Search Repositories</span>
            </button>
          </form>

          {/* Example Query Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Try:</span>
            {EXAMPLE_SEARCHES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQueryInput(ex);
                  setActiveQuery(ex);
                }}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                  activeQuery.toLowerCase() === ex.toLowerCase()
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Strip: System, Stain & Source Connectors */}
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Anatomical System
              <select
                value={systemFilter}
                onChange={(e) => setSystemFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <option value="all">All Anatomical Systems</option>
                {SYSTEM_SECTIONS.map((s) => (
                  <option key={s.code} value={s.system}>
                    {s.code}. {s.system}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Histological Stain
              <select
                value={stainFilter}
                onChange={(e) => setStainFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                {STAIN_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    {st === 'all' ? 'All Stains' : st}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sources.length > 0 && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Active Slide Sources
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((src) => {
                  const checked = selectedSourceIds.has(src.id);
                  const status = sourceStatuses.find((s) => s.sourceId === src.id);
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleSource(src.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        checked
                          ? 'border-blue-500/50 bg-blue-50/70 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-200'
                          : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-400'
                      }`}
                    >
                      <span className="font-medium">{src.shortName}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        · {src.capabilities.directImport ? 'Direct Import' : 'External Ref'}
                      </span>
                      {status && !status.error && (
                        <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          ({status.count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Surface real per-source API errors transparently if any occurred */}
              {sourceStatuses.some((s) => s.error) && (
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                  {sourceStatuses
                    .filter((s) => s.error)
                    .map((s) => (
                      <p key={s.sourceId} className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{s.error}</span>
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results Grid / Loading Skeletons */}
        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]"
              >
                <div className="h-44 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-4 h-8 w-full rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#111622]">
            <Microscope className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              No slides returned for "{activeQuery}"
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try broadening the search term (e.g., "liver" or "kidney glomerulus") or setting stain
              filter to All Stains.
            </p>
          </div>
        ) : (
          <>
            {onImportManySlides && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#111622]">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {results.length} results
                  </span>{' '}
                  for "{activeQuery}"
                  {batchStatusMsg && (
                    <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
                      · {batchStatusMsg}
                    </span>
                  )}
                </div>
                {directImportableNew.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchImportResults}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Import All New Direct Slides ({directImportableNew.length})</span>
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((item) => {
                const alreadyInLibrary = existingSlides.find(
                  (s) =>
                    s.sourceId === item.id ||
                    (s.imageUrl && item.imageUrl && s.imageUrl === item.imageUrl) ||
                    (s.originalSourceUrl &&
                      s.originalSourceUrl === item.originalUrl &&
                      s.title === item.title)
                );
                const isImporting = importingId === item.id;

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111622]"
                  >
                    <div>
                      {/* Preview Image or University External Reference Placeholder */}
                      {item.thumbnailUrl ? (
                        <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-[#090C12]">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-32 w-full flex-col items-center justify-center border-b border-slate-100 bg-slate-50 px-4 text-center dark:border-slate-800 dark:bg-[#0B0F17]">
                          <ExternalLink className="h-6 w-6 text-slate-400" aria-hidden="true" />
                          <p className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {item.sourceName} External Virtual Slide
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Direct import restricted by source license
                          </p>
                        </div>
                      )}

                      {/* Details */}
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="truncate font-medium text-blue-600 dark:text-blue-400">
                            {item.sourceName}
                          </span>
                          <span className="truncate">{item.stain}</span>
                        </div>

                        <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {item.title}
                        </h2>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{item.anatomicalSystem}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.license}</span>
                          {item.width && item.height && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {item.width}×{item.height}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {item.description}
                        </p>
                        <p className="mt-2 truncate text-[11px] text-slate-400 dark:text-slate-500">
                          Attribution: {item.attribution}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                      {alreadyInLibrary ? (
                        <button
                          type="button"
                          onClick={() => onOpenExistingSlide(alreadyInLibrary.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200 whitespace-nowrap"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Open in Library</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => handleImportOrSave(item)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-60 ${
                            item.directImportAllowed
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isImporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : item.directImportAllowed ? (
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {item.directImportAllowed ? 'Import Slide' : 'Save Reference'}
                          </span>
                        </button>
                      )}

                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Original Slide"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Open Original</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => runSearch(activeQuery, page + 1, true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-[#111622] dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Load More Slides</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
