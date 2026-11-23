import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderPlus,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomCollection,
  LibrarySortOption,
  Slide,
  SmartCollectionId,
} from '../types/histology';
import { DEFAULT_CHAPTER_ORDER } from '../data/defaultSlides';
import { getSlideThumbnailUrl } from '../utils/imageUrls';
import { buildSlideSearchIndex, filterAndSortSlides } from '../utils/searchIndex';

interface SidebarProps {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onToggleFavorite: (slideId: string) => void;
  onOpenUpload: () => void;
  onDeleteSlide: (slideId: string) => void;
  onResetDefaults: () => void;
  customCollections: CustomCollection[];
  onCreateCollection: (name: string) => void;
  selectedSmartCollection: SmartCollectionId;
  onSelectSmartCollection: (id: SmartCollectionId) => void;
  selectedCustomCollectionId: string | null;
  onSelectCustomCollection: (id: string | null) => void;
  sortBy: LibrarySortOption;
  onChangeSortBy: (sort: LibrarySortOption) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const SMART_COLLECTIONS: Array<{ id: SmartCollectionId; label: string }> = [
  { id: 'all', label: 'All Slides' },
  { id: 'verified', label: 'Verified Slides Only' },
  { id: 'quality-needs-review', label: 'Quality: Needs Review' },
  { id: 'quality-flagged', label: 'Quality: Flagged Issues' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent-added', label: 'Recently Added' },
  { id: 'recent-viewed', label: 'Recently Viewed' },
  { id: 'unstudied', label: 'Unstudied Slides' },
  { id: 'needs-review', label: 'Slides to Review' },
  { id: 'uploaded', label: 'My Uploaded Slides' },
  { id: 'imported', label: 'Imported Slides' },
  { id: 'external', label: 'External References' },
];

const CHAPTER_PAGE_SIZE = 20;

export const Sidebar: React.FC<SidebarProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  onToggleFavorite,
  onOpenUpload,
  onDeleteSlide,
  onResetDefaults,
  customCollections,
  onCreateCollection,
  selectedSmartCollection,
  onSelectSmartCollection,
  selectedCustomCollectionId,
  onSelectCustomCollection,
  sortBy,
  onChangeSortBy,
  searchQuery,
  onChangeSearchQuery,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [chapterToggleOverrides, setChapterToggleOverrides] = useState<Record<string, boolean>>({});
  const [chapterVisibleLimits, setChapterVisibleLimits] = useState<Record<string, number>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const searchIndex = useMemo(() => buildSlideSearchIndex(slides), [slides]);

  const filteredSlides = useMemo(
    () =>
      filterAndSortSlides(slides, searchIndex, {
        query: searchQuery,
        smartCollection: selectedSmartCollection,
        customCollectionId: selectedCustomCollectionId,
        sortBy,
      }),
    [slides, searchIndex, searchQuery, selectedSmartCollection, selectedCustomCollectionId, sortBy]
  );

  const groupedChapters = useMemo(() => {
    const map = new Map<string, Slide[]>();
    for (const slide of filteredSlides) {
      const groupKey =
        sortBy === 'system' ? slide.anatomicalSystem || slide.chapter : slide.chapter;
      const list = map.get(groupKey) ?? [];
      list.push(slide);
      map.set(groupKey, list);
    }

    const orderedKeys = Array.from(map.keys()).sort((a, b) => {
      const idxA = DEFAULT_CHAPTER_ORDER.indexOf(a);
      const idxB = DEFAULT_CHAPTER_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return orderedKeys.map((chapter) => ({
      chapter,
      slides: map.get(chapter) ?? [],
    }));
  }, [filteredSlides, sortBy]);

  const activeChapterKey = useMemo(() => {
    const active = slides.find((s) => s.id === activeSlideId);
    if (!active) return null;
    return sortBy === 'system' ? active.anatomicalSystem || active.chapter : active.chapter;
  }, [slides, activeSlideId, sortBy]);

  const isLargeUnfilteredLibrary = filteredSlides.length > 40 && !searchQuery.trim();

  const isChapterCollapsed = (chapter: string): boolean => {
    if (searchQuery.trim()) return false;
    if (chapter in chapterToggleOverrides) {
      return chapterToggleOverrides[chapter];
    }
    if (isLargeUnfilteredLibrary) {
      return chapter !== activeChapterKey;
    }
    return false;
  };

  const toggleChapter = (chapter: string) => {
    const currentlyCollapsed = isChapterCollapsed(chapter);
    setChapterToggleOverrides((prev) => ({
      ...prev,
      [chapter]: !currentlyCollapsed,
    }));
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

  const sidebarContent = (
    <aside
      aria-label="Personal Slide Library"
      className="flex h-full w-76 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
    >
      {/* Mobile Drawer Close Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:hidden">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Personal Library
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Close slide library sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search, Collection Filter, Sort & Upload */}
      <div className="flex flex-col gap-2.5 border-b border-slate-200 p-3.5 dark:border-slate-800">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onChangeSearchQuery(e.target.value);
              setChapterVisibleLimits({});
            }}
            placeholder="Filter library, organs, pins..."
            aria-label="Filter library slides"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-[#0B0F17] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Collection & Sort Selectors */}
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filter by collection"
            value={selectedCustomCollectionId ? `custom:${selectedCustomCollectionId}` : selectedSmartCollection}
            onChange={(e) => {
              const val = e.target.value;
              setChapterVisibleLimits({});
              if (val.startsWith('custom:')) {
                onSelectCustomCollection(val.slice(7));
              } else {
                onSelectCustomCollection(null);
                onSelectSmartCollection(val as SmartCollectionId);
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-200"
          >
            <optgroup label="Smart Collections">
              {SMART_COLLECTIONS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </optgroup>
            {customCollections.length > 0 && (
              <optgroup label="Custom Collections">
                {customCollections.map((col) => (
                  <option key={col.id} value={`custom:${col.id}`}>
                    {col.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <select
            aria-label="Sort slides"
            value={sortBy}
            onChange={(e) => onChangeSortBy(e.target.value as LibrarySortOption)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-200"
          >
            <option value="recent-added">Sort: Recent</option>
            <option value="organ">Sort: Organ</option>
            <option value="tissue">Sort: Tissue</option>
            <option value="system">Sort: System</option>
            <option value="title">Sort: Name</option>
          </select>
        </div>

        {/* New Collection Inline Creator */}
        {isCreatingCollection ? (
          <form onSubmit={handleCreateCollection} className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Collection name..."
              className="flex-1 rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-[#0B0F17] dark:text-slate-100"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingCollection(false)}
              className="rounded-md px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {filteredSlides.length} {filteredSlides.length === 1 ? 'slide' : 'slides'}
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingCollection(true)}
              className="flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <FolderPlus className="h-3 w-3" aria-hidden="true" />
              <span>New Collection</span>
            </button>
          </div>
        )}
      </div>

      {/* Chapter Deck List */}
      <div className="histo-scroll flex-1 overflow-y-auto px-3 py-3">
        {groupedChapters.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              No slides match this filter
            </p>
            <button
              type="button"
              onClick={() => {
                onChangeSearchQuery('');
                onSelectCustomCollection(null);
                onSelectSmartCollection('all');
              }}
              className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset library filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedChapters.map(({ chapter, slides: chapterSlides }) => {
              const isCollapsed = isChapterCollapsed(chapter);
              const chapterLimit = searchQuery.trim()
                ? chapterSlides.length
                : chapterVisibleLimits[chapter] ?? CHAPTER_PAGE_SIZE;
              const visibleChapterSlides = chapterSlides.slice(0, chapterLimit);
              return (
                <section key={chapter} aria-label={`${chapter} chapter`}>
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapter)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold tracking-tight text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                      <span className="truncate">{chapter}</span>
                    </span>
                    <span className="font-mono text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                      {chapterSlides.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <ul className="mt-1 flex flex-col gap-1">
                      {visibleChapterSlides.map((slide) => {
                        const isActive = slide.id === activeSlideId;
                        const isConfirmingDelete = confirmDeleteId === slide.id;
                        const thumbSrc = getSlideThumbnailUrl(slide);

                        return (
                          <li key={slide.id} className="group relative">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectSlide(slide.id);
                                onCloseMobile();
                              }}
                              className={`flex w-full items-start gap-2.5 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                isActive
                                  ? 'border-blue-500/40 bg-blue-50/70 dark:border-blue-500/40 dark:bg-blue-950/30'
                                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Thumbnail */}
                              <div className="relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                                {thumbSrc ? (
                                  <img
                                    src={thumbSrc}
                                    alt={slide.title}
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                )}
                              </div>

                              {/* Slide Title & Clean Unboxed Metadata */}
                              <div className="min-w-0 flex-1 pr-9">
                                <p
                                  className={`truncate text-xs font-semibold leading-snug ${
                                    isActive
                                      ? 'text-blue-900 dark:text-blue-200'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {slide.title}
                                </p>
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="truncate">{slide.stain}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    {slide.magnification}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    {slide.pins.length}
                                  </span>
                                </div>
                              </div>
                            </button>

                            {/* Favorite & Delete Actions */}
                            <div className="absolute right-1.5 top-2 flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(slide.id);
                                }}
                                aria-label={slide.isFavorite ? 'Remove favorite' : 'Favorite slide'}
                                className={`flex h-6 w-6 items-center justify-center rounded transition-opacity ${
                                  slide.isFavorite
                                    ? 'text-amber-500 opacity-100'
                                    : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
                                }`}
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${slide.isFavorite ? 'fill-current' : ''}`}
                                />
                              </button>

                              {slides.length > 1 && (
                                isConfirmingDelete ? (
                                  <div className="flex items-center gap-1 rounded-md border border-rose-200 bg-white px-1.5 py-0.5 shadow-sm dark:border-rose-800 dark:bg-slate-900">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSlide(slide.id);
                                        setConfirmDeleteId(null);
                                      }}
                                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                                    >
                                      Remove
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-700">/</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(null);
                                      }}
                                      className="text-[11px] text-slate-500 dark:text-slate-400"
                                    >
                                      Keep
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(slide.id);
                                    }}
                                    title="Remove slide from library"
                                    aria-label={`Remove ${slide.title}`}
                                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/70 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-rose-400"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </li>
                        );
                      })}
                      {chapterSlides.length > chapterLimit && (
                        <li className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setChapterVisibleLimits((prev) => ({
                                ...prev,
                                [chapter]: chapterLimit + CHAPTER_PAGE_SIZE,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Show {Math.min(CHAPTER_PAGE_SIZE, chapterSlides.length - chapterLimit)} more in {chapter} ({chapterSlides.length - chapterLimit} remaining)
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Utility Bar */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Upload Slide</span>
        </button>

        {confirmReset ? (
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                onResetDefaults();
                setConfirmReset(false);
              }}
              className="font-semibold text-rose-600 hover:underline dark:text-rose-400 whitespace-nowrap"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            title="Restore default slides"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{sidebarContent}</div>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
