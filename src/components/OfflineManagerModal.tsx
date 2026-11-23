import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Database,
  Download,
  HardDrive,
  Loader2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { CustomCollection, Slide } from '../types/histology';
import { getSlideFullUrl, getSlideThumbnailUrl } from '../utils/imageUrls';
import {
  OfflineCacheMeta,
  clearAllOfflineImages,
  estimateBrowserStorage,
} from '../utils/storage';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  customCollections: CustomCollection[];
  offlineIndex: Record<string, OfflineCacheMeta>;
  onCacheSlide: (slideId: string, variant: 'thumb' | 'full') => Promise<void>;
  onRemoveCachedSlide: (slideId: string) => Promise<void>;
  onAfterClearAll: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  slides,
  customCollections,
  offlineIndex,
  onCacheSlide,
  onRemoveCachedSlide,
  onAfterClearAll,
}) => {
  const [variant, setVariant] = useState<'thumb' | 'full'>('thumb');
  const [selectedGroup, setSelectedGroup] = useState<string>('favorites');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number }>({
    done: 0,
    total: 0,
    failed: 0,
  });
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [storageEst, setStorageEst] = useState<{ usageBytes?: number; quotaBytes?: number }>({});
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    estimateBrowserStorage().then(setStorageEst);
    setConfirmClearAll(false);
  }, [isOpen, offlineIndex]);

  const chapters = useMemo(
    () => Array.from(new Set(slides.map((s) => s.chapter))).sort(),
    [slides]
  );

  const cachedEntries = useMemo(() => {
    const slideMap = new Map(slides.map((s) => [s.id, s]));
    return Object.values(offlineIndex)
      .map((meta) => ({
        meta,
        slide: slideMap.get(meta.slideId),
      }))
      .filter((item): item is { meta: OfflineCacheMeta; slide: Slide } => Boolean(item.slide))
      .sort((a, b) => b.meta.cachedAt - a.meta.cachedAt);
  }, [offlineIndex, slides]);

  const totalCachedBytes = useMemo(
    () => Object.values(offlineIndex).reduce((acc, m) => acc + (m.bytes || 0), 0),
    [offlineIndex]
  );

  const targetSlides = useMemo(() => {
    if (selectedGroup === 'favorites') {
      return slides.filter((s) => s.isFavorite);
    }
    if (selectedGroup === 'recent') {
      return [...slides]
        .filter((s) => Boolean(s.lastViewedAt))
        .sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0))
        .slice(0, 20);
    }
    if (selectedGroup.startsWith('col:')) {
      const colId = selectedGroup.slice(4);
      return slides.filter((s) => (s.collectionIds ?? []).includes(colId));
    }
    if (selectedGroup.startsWith('chap:')) {
      const ch = selectedGroup.slice(5);
      return slides.filter((s) => s.chapter === ch);
    }
    return [];
  }, [selectedGroup, slides]);

  if (!isOpen) return null;

  const handleBatchDownload = async () => {
    const eligible = targetSlides.filter((s) => {
      const url = variant === 'thumb' ? getSlideThumbnailUrl(s) : getSlideFullUrl(s);
      if (!url) return false;
      const existing = offlineIndex[s.id];
      if (!existing) return true;
      return existing.variant === 'thumb' && variant === 'full';
    });

    if (eligible.length === 0) return;

    cancelRef.current = false;
    setDownloading(true);
    setProgress({ done: 0, total: eligible.length, failed: 0 });

    let failed = 0;
    for (let i = 0; i < eligible.length; i++) {
      if (cancelRef.current) break;
      try {
        await onCacheSlide(eligible[i].id, variant);
      } catch {
        failed += 1;
      }
      setProgress({ done: i + 1, total: eligible.length, failed });
    }

    setDownloading(false);
    estimateBrowserStorage().then(setStorageEst);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Offline Slide Collection Manager"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 sm:p-4"
    >
      <div className="flex max-h-[90dvh] w-full sm:max-w-xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#111622]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                Offline Study Storage
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Download selected chapters, favorites, or recent slides
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close offline manager"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="histo-scroll flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Storage Metrics */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-[#0B0F17]">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Cached Slides</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {cachedEntries.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Images Size</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {formatBytes(totalCachedBytes)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Device Free</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {storageEst.quotaBytes && storageEst.usageBytes !== undefined
                  ? formatBytes(Math.max(0, storageEst.quotaBytes - storageEst.usageBytes))
                  : 'Available'}
              </p>
            </div>
          </div>

          {/* Selective Download Builder */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B0F17]/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Download Collection for Offline Use
              </p>
              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {targetSlides.length} slides
              </span>
            </div>

            <select
              aria-label="Choose slide group to download offline"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              disabled={downloading}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="favorites">
                Favorites ({slides.filter((s) => s.isFavorite).length})
              </option>
              <option value="recent">
                Recently Viewed ({slides.filter((s) => Boolean(s.lastViewedAt)).length} max 20)
              </option>
              {customCollections.length > 0 && (
                <optgroup label="My Collections">
                  {customCollections.map((col) => (
                    <option key={col.id} value={`col:${col.id}`}>
                      {col.name} (
                      {slides.filter((s) => (s.collectionIds ?? []).includes(col.id)).length})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Histology Chapters">
                {chapters.map((ch) => (
                  <option key={ch} value={`chap:${ch}`}>
                    {ch} ({slides.filter((s) => s.chapter === ch).length})
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Quality Mode Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={downloading}
                onClick={() => setVariant('thumb')}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  variant === 'thumb'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500/70 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <p className="text-xs font-semibold">Thumbnails</p>
                <p className="text-[10px] opacity-80">Fast, light storage</p>
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={() => setVariant('full')}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  variant === 'full'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500/70 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <p className="text-xs font-semibold">Full Resolution</p>
                <p className="text-[10px] opacity-80">Crisp high-zoom detail</p>
              </button>
            </div>

            {downloading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      Downloading {progress.done}/{progress.total}
                      {progress.failed > 0 ? ` (${progress.failed} skipped)` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400"
                  >
                    Cancel
                  </button>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                    className="h-full bg-blue-600 transition-[width]"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={targetSlides.length === 0}
                onClick={handleBatchDownload}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-45"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>
                  Download {targetSlides.length} {targetSlides.length === 1 ? 'Slide' : 'Slides'} (
                  {variant === 'thumb' ? 'Thumbnail' : 'Full-Res'})
                </span>
              </button>
            )}
          </div>

          {/* Note Safety Guarantee */}
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-400">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Your notes, pins, favorites, and exam progress are always stored locally in IndexedDB.
              Removing an offline image frees space without erasing any study notes.
            </span>
          </div>

          {/* Cached Slides List */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Downloaded Slides ({cachedEntries.length})
              </h3>
              {cachedEntries.length > 0 && (
                confirmClearAll ? (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        await clearAllOfflineImages();
                        await onAfterClearAll();
                        setConfirmClearAll(false);
                      }}
                      className="font-semibold text-rose-600 dark:text-rose-400"
                    >
                      Confirm Clear Images
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="text-slate-500"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Clear All Cached Images
                  </button>
                )
              )}
            </div>

            {cachedEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                <WifiOff className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  No slides cached for offline study yet
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Select Favorites, Recent, or a Chapter above to download slides for offline use.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cachedEntries.map(({ meta, slide }) => (
                  <li
                    key={slide.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#0B0F17]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {slide.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{slide.chapter}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{formatBytes(meta.bytes)}</span>
                        <span>·</span>
                        <span
                          className={
                            meta.variant === 'full'
                              ? 'font-medium text-emerald-600 dark:text-emerald-400'
                              : 'font-medium text-blue-600 dark:text-blue-400'
                          }
                        >
                          {meta.variant === 'full' ? 'Full-Res' : 'Thumbnail'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {meta.variant === 'thumb' && (
                        <button
                          type="button"
                          onClick={() => void onCacheSlide(slide.id, 'full')}
                          title="Upgrade to Full Resolution"
                          className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          <Check className="h-3 w-3 text-blue-600" />
                          <span>Full</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRemoveCachedSlide(slide.id)}
                        aria-label={`Remove offline copy of ${slide.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
