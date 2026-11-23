import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  Microscope,
  Search,
  Star,
} from 'lucide-react';
import { CustomCollection, LibrarySortOption, Slide } from '../types/histology';
import { getSlideThumbnailUrl } from '../utils/imageUrls';
import { buildSlideSearchIndex, filterAndSortSlides } from '../utils/searchIndex';
import { OfflineCacheMeta } from '../utils/storage';

interface MobileLibraryViewProps {
  mode: 'library' | 'favorites';
  slides: Slide[];
  activeSlideId: string;
  customCollections: CustomCollection[];
  offlineIndex: Record<string, OfflineCacheMeta>;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  selectedChapter: string;
  onChangeSelectedChapter: (chapter: string) => void;
  selectedCustomCollectionId: string | null;
  onChangeCustomCollectionId: (id: string | null) => void;
  sortBy: LibrarySortOption;
  onChangeSortBy: (sort: LibrarySortOption) => void;
  onSelectSlide: (slideId: string) => void;
  onToggleFavorite: (slideId: string) => void;
  onToggleOfflineSlide: (slideId: string) => Promise<void>;
}

const PAGE_SIZE = 24;

export const MobileLibraryView: React.FC<MobileLibraryViewProps> = ({
  mode,
  slides,
  activeSlideId,
  customCollections,
  offlineIndex,
  searchQuery,
  onChangeSearchQuery,
  selectedChapter,
  onChangeSelectedChapter,
  selectedCustomCollectionId,
  onChangeCustomCollectionId,
  sortBy,
  onChangeSortBy,
  onSelectSlide,
  onToggleFavorite,
  onToggleOfflineSlide,
}) => {
  const [qualityFilter, setQualityFilter] = useState<'all' | 'verified' | 'needs-review'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cachingIds, setCachingIds] = useState<Set<string>>(new Set());

  const chapters = useMemo(
    () => Array.from(new Set(slides.map((s) => s.chapter))).sort(),
    [slides]
  );

  const searchIndex = useMemo(() => buildSlideSearchIndex(slides), [slides]);

  const filteredSlides = useMemo(() => {
    const base = filterAndSortSlides(slides, searchIndex, {
      query: searchQuery,
      smartCollection: mode === 'favorites' ? 'favorites' : 'all',
      customCollectionId: selectedCustomCollectionId,
      sortBy,
    });
    return base.filter((s) => {
      if (selectedChapter !== 'all' && s.chapter !== selectedChapter) return false;
      if (qualityFilter === 'verified' && (s.qualityStatus ?? 'needs-review') !== 'verified') {
        return false;
      }
      if (
        qualityFilter === 'needs-review' &&
        (s.qualityStatus ?? 'needs-review') !== 'needs-review'
      ) {
        return false;
      }
      return true;
    });
  }, [
    slides,
    searchIndex,
    searchQuery,
    mode,
    selectedCustomCollectionId,
    sortBy,
    selectedChapter,
    qualityFilter,
  ]);

  const visibleSlides = filteredSlides.slice(0, visibleCount);

  return (
    <div className="histo-scroll flex-1 overflow-y-auto bg-slate-50 pb-24 dark:bg-[#090C12]">
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {mode === 'favorites' ? 'Bookmarked Favorites' : 'Slide Library'}
          </h1>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {filteredSlides.length} {filteredSlides.length === 1 ? 'slide' : 'slides'}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onChangeSearchQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search organs, tissues, pins, stains..."
            aria-label="Filter slides"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
          />
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filter by chapter"
            value={selectedChapter}
            onChange={(e) => {
              onChangeSelectedChapter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
          >
            <option value="all">All Chapters ({slides.length})</option>
            {chapters.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by quality or collection"
            value={selectedCustomCollectionId ? `col:${selectedCustomCollectionId}` : qualityFilter}
            onChange={(e) => {
              const val = e.target.value;
              setVisibleCount(PAGE_SIZE);
              if (val.startsWith('col:')) {
                onChangeCustomCollectionId(val.slice(4));
                setQualityFilter('all');
              } else {
                onChangeCustomCollectionId(null);
                setQualityFilter(val as 'all' | 'verified' | 'needs-review');
              }
            }}
            className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="needs-review">Needs Review</option>
            {customCollections.length > 0 && (
              <optgroup label="Collections">
                {customCollections.map((c) => (
                  <option key={c.id} value={`col:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Sort Strip */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['recent-added', 'organ', 'tissue', 'title'] as LibrarySortOption[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChangeSortBy(opt)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                  sortBy === opt
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300'
                }`}
              >
                {opt === 'recent-added'
                  ? 'Recent'
                  : opt === 'organ'
                    ? 'Organ'
                    : opt === 'tissue'
                      ? 'Tissue'
                      : 'Name'}
              </button>
            ))}
          </div>
          {(selectedChapter !== 'all' || searchQuery || selectedCustomCollectionId) && (
            <button
              type="button"
              onClick={() => {
                onChangeSearchQuery('');
                onChangeSelectedChapter('all');
                onChangeCustomCollectionId(null);
                setQualityFilter('all');
              }}
              className="shrink-0 text-[11px] font-medium text-blue-600 dark:text-blue-400"
            >
              Reset
            </button>
          )}
        </div>

        {/* Touch Slide Cards */}
        {visibleSlides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#111622]">
            <Microscope className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {mode === 'favorites' ? 'No favorite slides yet' : 'No matching slides'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'favorites'
                ? 'Tap the star icon on any slide to bookmark it here.'
                : 'Try adjusting your chapter or search keywords.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visibleSlides.map((slide) => {
              const isActive = slide.id === activeSlideId;
              const thumb = getSlideThumbnailUrl(slide);
              const cached = offlineIndex[slide.id];
              const isCaching = cachingIds.has(slide.id);

              return (
                <li
                  key={slide.id}
                  className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${
                    isActive
                      ? 'border-blue-500/60 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-950/20'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111622]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSlide(slide.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="h-18 w-22 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={slide.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Microscope className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {slide.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {slide.chapter}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{slide.stain}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{slide.magnification}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{slide.pins.length} pins</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(slide.id)}
                      aria-label={slide.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                        slide.isFavorite
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Star className={`h-4 w-4 ${slide.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    {thumb.startsWith('https://') && (
                      <button
                        type="button"
                        disabled={isCaching}
                        onClick={async () => {
                          setCachingIds((prev) => new Set(prev).add(slide.id));
                          try {
                            await onToggleOfflineSlide(slide.id);
                          } finally {
                            setCachingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(slide.id);
                              return next;
                            });
                          }
                        }}
                        aria-label={
                          cached ? 'Remove offline slide copy' : 'Save slide offline'
                        }
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                          cached
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isCaching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : cached ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filteredSlides.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-200"
          >
            Load {Math.min(PAGE_SIZE, filteredSlides.length - visibleCount)} More Slides (
            {filteredSlides.length - visibleCount} remaining)
          </button>
        )}
      </div>
    </div>
  );
};
