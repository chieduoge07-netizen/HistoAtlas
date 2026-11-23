import React, { useMemo } from 'react';
import {
  BookOpen,
  ChevronRight,
  EyeOff,
  FolderOpen,
  GraduationCap,
  HardDrive,
  Microscope,
  Play,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { DEFAULT_CHAPTER_ORDER } from '../data/defaultSlides';
import { CustomCollection, Slide } from '../types/histology';
import { getSlideThumbnailUrl } from '../utils/imageUrls';
import { OfflineCacheMeta } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileHomeViewProps {
  slides: Slide[];
  activeSlide: Slide;
  customCollections: CustomCollection[];
  offlineIndex: Record<string, OfflineCacheMeta>;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  onOpenSlide: (slideId: string) => void;
  onBrowseChapter: (chapter: string) => void;
  onOpenLibraryWithSearch: (q: string) => void;
  onOpenQuizOnActiveSlide: () => void;
  onOpenPractical: () => void;
  onOpenOfflineManager: () => void;
  onOpenUpload: () => void;
  onOpenFavoritesTab: () => void;
  onOpenCollection: (collectionId: string) => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  slides,
  activeSlide,
  customCollections,
  offlineIndex,
  searchQuery,
  onChangeSearchQuery,
  onOpenSlide,
  onBrowseChapter,
  onOpenLibraryWithSearch,
  onOpenQuizOnActiveSlide,
  onOpenPractical,
  onOpenOfflineManager,
  onOpenUpload,
  onOpenFavoritesTab,
  onOpenCollection,
}) => {
  const recentSlides = useMemo(() => {
    return [...slides]
      .filter((s) => Boolean(s.lastViewedAt))
      .sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0))
      .slice(0, 10);
  }, [slides]);

  const favoriteSlides = useMemo(
    () => slides.filter((s) => s.isFavorite).slice(0, 12),
    [slides]
  );

  const chapterCards = useMemo(() => {
    const map = new Map<string, Slide[]>();
    for (const slide of slides) {
      const list = map.get(slide.chapter) ?? [];
      list.push(slide);
      map.set(slide.chapter, list);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = DEFAULT_CHAPTER_ORDER.indexOf(a);
      const ib = DEFAULT_CHAPTER_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys.map((chapter) => {
      const list = map.get(chapter) ?? [];
      const rep = list.find((s) => getSlideThumbnailUrl(s)) ?? list[0];
      return {
        chapter,
        count: list.length,
        thumbUrl: rep ? getSlideThumbnailUrl(rep) : '',
      };
    });
  }, [slides]);

  const cachedCount = Object.keys(offlineIndex).length;
  const activeThumb = getSlideThumbnailUrl(activeSlide);

  return (
    <div className="histo-scroll flex-1 overflow-y-auto bg-slate-50 pb-24 dark:bg-[#090C12]">
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {/* Search Bar + Install CTA */}
        <div className="space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onOpenLibraryWithSearch(searchQuery);
            }}
            className="relative"
          >
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder={`Search ${slides.length} slides, organs, stains, pins...`}
              aria-label="Search histology slides"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Find
            </button>
          </form>

          <PWAInstallButton fullWidth />
        </div>

        {/* Continue Studying Card */}
        <section aria-label="Continue studying">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Continue Studying
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              {activeSlide.pins.length} pins
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenSlide(activeSlide.id)}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors active:bg-slate-50 dark:border-slate-800 dark:bg-[#111622] dark:active:bg-slate-900"
          >
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              {activeThumb ? (
                <img
                  src={activeThumb}
                  alt={activeSlide.title}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Microscope className="h-6 w-6 text-slate-400" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">
                {activeSlide.chapter}
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {activeSlide.title}
              </h3>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {activeSlide.stain} · {activeSlide.magnification}
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <Play className="h-4 w-4 fill-current ml-0.5" aria-hidden="true" />
            </div>
          </button>
        </section>

        {/* Quick Actions Grid */}
        <section aria-label="Study modes">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenQuizOnActiveSlide}
              className="flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-[#111622]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Quiz Mode
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tap pins to recall
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenPractical}
              className="flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-[#111622]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Practical Exam
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Timed spotters
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenOfflineManager}
              className="flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-[#111622]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <HardDrive className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Offline Study
                </p>
                <p className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {cachedCount} cached
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenUpload}
              className="flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-[#111622]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Upload Slide
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Add from device
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Recently Viewed Rail */}
        {recentSlides.length > 0 && (
          <section aria-label="Recently viewed slides">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recently Viewed
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                {recentSlides.length}
              </span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {recentSlides.map((s) => {
                const t = getSlideThumbnailUrl(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenSlide(s.id)}
                    className="flex w-40 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left dark:border-slate-800 dark:bg-[#111622]"
                  >
                    <div className="h-24 w-full bg-slate-100 dark:bg-slate-800">
                      {t && (
                        <img
                          src={t}
                          alt={s.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {s.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {s.stain} · {s.pins.length} pins
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Favorites Rail */}
        <section aria-label="Favorites">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Favorites
            </h2>
            <button
              type="button"
              onClick={onOpenFavoritesTab}
              className="flex items-center gap-0.5 text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {favoriteSlides.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-400">
              <Star className="mx-auto mb-1.5 h-4 w-4 text-slate-400" />
              Tap the star icon on any slide to bookmark it here for quick review.
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {favoriteSlides.map((s) => {
                const t = getSlideThumbnailUrl(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenSlide(s.id)}
                    className="flex w-40 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left dark:border-slate-800 dark:bg-[#111622]"
                  >
                    <div className="h-24 w-full bg-slate-100 dark:bg-slate-800">
                      {t && (
                        <img
                          src={t}
                          alt={s.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {s.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {s.chapter}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Custom Collections */}
        {customCollections.length > 0 && (
          <section aria-label="My collections">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              My Collections
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {customCollections.map((col) => {
                const count = slides.filter((s) => (s.collectionIds ?? []).includes(col.id)).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onOpenCollection(col.id)}
                    className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left dark:border-slate-800 dark:bg-[#111622]"
                  >
                    <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>{col.name}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {count} slides
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Browse Histology Chapters */}
        <section aria-label="Browse histology chapters">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Browse Histology Chapters
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              {chapterCards.length} chapters
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {chapterCards.map((ch) => (
              <button
                key={ch.chapter}
                type="button"
                onClick={() => onBrowseChapter(ch.chapter)}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-colors active:bg-slate-50 dark:border-slate-800 dark:bg-[#111622]"
              >
                <div className="relative h-24 w-full bg-slate-100 dark:bg-slate-800">
                  {ch.thumbUrl ? (
                    <img
                      src={ch.thumbUrl}
                      alt={ch.chapter}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-900 dark:text-slate-100">
                    {ch.chapter}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {ch.count} {ch.count === 1 ? 'slide' : 'slides'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
