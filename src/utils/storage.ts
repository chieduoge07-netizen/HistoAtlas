import { DEFAULT_SLIDES } from '../data/defaultSlides';
import {
  CustomCollection,
  PracticalAttemptRecord,
  Slide,
  SlideAnnotationRecord,
  SlideStudyProgress,
  ThemeMode,
} from '../types/histology';
import { normalizeSlideImageUrl } from './imageUrls';

const DB_NAME = 'histoatlas_studio_db';
const DB_VERSION = 3;
const STORE_SLIDES = 'slides';
const STORE_ANNOTATIONS = 'annotations';
const STORE_COLLECTIONS = 'collections';
const STORE_IMAGE_CACHE = 'imageCache';
const STORE_ATTEMPTS = 'practicalAttempts';
const STORE_PROGRESS = 'slideProgress';

const LS_THEME_KEY = 'histoatlas_theme';
const LS_ACTIVE_SLIDE_KEY = 'histoatlas_active_slide';
const LS_FALLBACK_SLIDES_KEY = 'histoatlas_slides_fallback';
const LS_FALLBACK_ATTEMPTS_KEY = 'histoatlas_attempts_fallback';
const LS_FALLBACK_PROGRESS_KEY = 'histoatlas_progress_fallback';
const LS_SEED_VERSION_KEY = 'histoatlas_default_seed_version';
const CURRENT_SEED_VERSION = 'v5';

const DEFAULT_SLIDE_MAP = new Map(DEFAULT_SLIDES.map((s) => [s.id, s]));

function normalizeSlideRecord(raw: Partial<Slide> & { id: string }): Slide {
  const defaults = DEFAULT_SLIDE_MAP.get(raw.id);
  return {
    id: raw.id,
    chapter: raw.chapter ?? defaults?.chapter ?? 'Basic Tissues',
    title: raw.title ?? defaults?.title ?? 'Untitled Slide',
    specimen: raw.specimen ?? defaults?.specimen ?? 'Histology Specimen',
    organ: raw.organ ?? defaults?.organ ?? raw.specimen ?? 'Specimen',
    anatomicalSystem: raw.anatomicalSystem ?? defaults?.anatomicalSystem ?? 'Basic Tissues',
    tissueType: raw.tissueType ?? defaults?.tissueType ?? raw.chapter ?? 'Tissue Section',
    stain: raw.stain ?? defaults?.stain ?? 'H&E',
    magnification: raw.magnification ?? defaults?.magnification ?? '200×',
    fieldWidthUm: raw.fieldWidthUm ?? defaults?.fieldWidthUm ?? 450,
    imageUrl: normalizeSlideImageUrl(raw.imageUrl ?? defaults?.imageUrl ?? ''),
    thumbnailUrl: normalizeSlideImageUrl(raw.thumbnailUrl ?? defaults?.thumbnailUrl),
    highResUrl: normalizeSlideImageUrl(raw.highResUrl ?? defaults?.highResUrl),
    tileSourceUrl: raw.tileSourceUrl ?? defaults?.tileSourceUrl,
    rotationDeg: raw.rotationDeg ?? 0,
    overviewNotes: raw.overviewNotes ?? defaults?.overviewNotes ?? '',
    pins: Array.isArray(raw.pins) ? raw.pins : defaults?.pins ?? [],
    sourceInstitution:
      raw.sourceInstitution ??
      defaults?.sourceInstitution ??
      (raw.isCustom ? 'Personal Upload' : 'HistoAtlas Teaching Collection'),
    sourceId: raw.sourceId ?? defaults?.sourceId,
    originalSourceUrl: raw.originalSourceUrl ?? defaults?.originalSourceUrl,
    license:
      raw.license ??
      defaults?.license ??
      (raw.isCustom ? 'Personal Study Upload' : 'Educational Atlas Asset'),
    attribution:
      raw.attribution ??
      defaults?.attribution ??
      (raw.isCustom ? 'Uploaded by User' : 'HistoAtlas Reference Atlas'),
    importStatus:
      raw.importStatus ??
      defaults?.importStatus ??
      (raw.isCustom ? 'uploaded' : 'local-atlas'),
    tags: Array.isArray(raw.tags) ? raw.tags : defaults?.tags ?? [],
    expectedFeatures: raw.expectedFeatures ?? defaults?.expectedFeatures,
    qualityStatus:
      raw.qualityStatus ??
      defaults?.qualityStatus ??
      (raw.isCustom ? 'verified' : 'needs-review'),
    auditFlags: Array.isArray(raw.auditFlags) ? raw.auditFlags : defaults?.auditFlags,
    auditNotes: raw.auditNotes ?? defaults?.auditNotes,
    lastAuditedAt: raw.lastAuditedAt ?? defaults?.lastAuditedAt,
    imageDimensions: raw.imageDimensions ?? defaults?.imageDimensions,
    visualHash: raw.visualHash ?? defaults?.visualHash,
    identification: raw.identification ?? defaults?.identification,
    isFavorite: raw.isFavorite ?? false,
    needsReview: raw.needsReview ?? false,
    lastViewedAt: raw.lastViewedAt,
    studiedCount: raw.studiedCount ?? 0,
    collectionIds: Array.isArray(raw.collectionIds) ? raw.collectionIds : [],
    isCustom: raw.isCustom,
    createdAt: raw.createdAt ?? defaults?.createdAt ?? Date.now(),
  };
}

function mergeAnnotationIntoSlide(slide: Slide, ann?: SlideAnnotationRecord): Slide {
  if (!ann) return slide;
  return {
    ...slide,
    ...(ann.metadataOverrides ?? {}),
    overviewNotes: ann.overviewNotes ?? slide.overviewNotes,
    pins: Array.isArray(ann.pins) ? ann.pins : slide.pins,
    tags: Array.isArray(ann.tags) ? ann.tags : slide.tags,
    isFavorite: ann.isFavorite ?? slide.isFavorite,
    needsReview: ann.needsReview ?? slide.needsReview,
    lastViewedAt: ann.lastViewedAt ?? slide.lastViewedAt,
    studiedCount: ann.studiedCount ?? slide.studiedCount,
    collectionIds: ann.collectionIds ?? slide.collectionIds,
    rotationDeg: ann.rotationDeg ?? slide.rotationDeg,
    qualityStatus: ann.qualityStatus ?? slide.qualityStatus,
    auditFlags: ann.auditFlags ?? slide.auditFlags,
    auditNotes: ann.auditNotes ?? slide.auditNotes,
    lastAuditedAt: ann.lastAuditedAt ?? slide.lastAuditedAt,
    imageDimensions: ann.imageDimensions ?? slide.imageDimensions,
    visualHash: ann.visualHash ?? slide.visualHash,
    identification: ann.identification ?? slide.identification,
  };
}

function extractAnnotationFromSlide(slide: Slide): SlideAnnotationRecord {
  return {
    slideId: slide.id,
    overviewNotes: slide.overviewNotes,
    pins: slide.pins,
    tags: slide.tags,
    isFavorite: slide.isFavorite,
    needsReview: slide.needsReview,
    lastViewedAt: slide.lastViewedAt,
    studiedCount: slide.studiedCount,
    collectionIds: slide.collectionIds,
    rotationDeg: slide.rotationDeg,
    qualityStatus: slide.qualityStatus,
    auditFlags: slide.auditFlags,
    auditNotes: slide.auditNotes,
    lastAuditedAt: slide.lastAuditedAt,
    imageDimensions: slide.imageDimensions,
    visualHash: slide.visualHash,
    identification: slide.identification,
    metadataOverrides: {
      title: slide.title,
      specimen: slide.specimen,
      organ: slide.organ,
      anatomicalSystem: slide.anatomicalSystem,
      tissueType: slide.tissueType,
      chapter: slide.chapter,
      stain: slide.stain,
      magnification: slide.magnification,
      sourceInstitution: slide.sourceInstitution,
      originalSourceUrl: slide.originalSourceUrl,
      license: slide.license,
      attribution: slide.attribution,
    },
    updatedAt: Date.now(),
  };
}

function mergeNewDefaultSlides(existingSlides: Slide[]): Slide[] {
  let existingVersion: string | null = null;
  try {
    existingVersion = localStorage.getItem(LS_SEED_VERSION_KEY);
  } catch {
    // ignore
  }
  if (existingVersion === CURRENT_SEED_VERSION) {
    return existingSlides;
  }

  const existingIds = new Set(existingSlides.map((s) => s.id));
  const additions = DEFAULT_SLIDES.filter((s) => !existingIds.has(s.id));
  const merged = [...existingSlides, ...additions].sort((a, b) => a.createdAt - b.createdAt);

  try {
    localStorage.setItem(LS_SEED_VERSION_KEY, CURRENT_SEED_VERSION);
  } catch {
    // ignore
  }
  return merged;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SLIDES)) {
        db.createObjectStore(STORE_SLIDES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
        db.createObjectStore(STORE_ANNOTATIONS, { keyPath: 'slideId' });
      }
      if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGE_CACHE)) {
        db.createObjectStore(STORE_IMAGE_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: 'slideId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadSlidesFromStorage(): Promise<Slide[]> {
  try {
    const db = await openDatabase();
    return await new Promise<Slide[]>((resolve, reject) => {
      const tx = db.transaction([STORE_SLIDES, STORE_ANNOTATIONS, STORE_IMAGE_CACHE], 'readonly');
      const slideReq = tx.objectStore(STORE_SLIDES).getAll();
      const annReq = tx.objectStore(STORE_ANNOTATIONS).getAll();
      const cacheReq = tx.objectStore(STORE_IMAGE_CACHE).getAll();

      tx.oncomplete = () => {
        const rawSlides = (slideReq.result as Array<Partial<Slide> & { id: string }>) ?? [];
        const rawAnns = (annReq.result as SlideAnnotationRecord[]) ?? [];
        const cachedImages =
          (cacheReq.result as Array<{
            key: string;
            dataUrl: string;
            variant?: 'thumb' | 'full';
          }>) ?? [];

        const annMap = new Map(rawAnns.map((a) => [a.slideId, a]));
        const cacheMap = new Map(cachedImages.map((c) => [c.key, c]));

        if (rawSlides.length === 0) {
          try {
            localStorage.setItem(LS_SEED_VERSION_KEY, CURRENT_SEED_VERSION);
          } catch {
            // ignore
          }
          // Still merge any orphaned annotations (e.g. if slide record was reset)
          const seeded = DEFAULT_SLIDES.map((s) => mergeAnnotationIntoSlide(s, annMap.get(s.id)));
          resolve(seeded);
          return;
        }

        const normalized = rawSlides.map((raw) => {
          const base = normalizeSlideRecord(raw);
          const merged = mergeAnnotationIntoSlide(base, annMap.get(base.id));
          const cached = cacheMap.get(base.id);
          if (cached) {
            if (cached.variant === 'thumb') {
              return {
                ...merged,
                thumbnailUrl: cached.dataUrl,
                imageUrl: navigator.onLine ? merged.imageUrl : cached.dataUrl,
              };
            }
            if (merged.importStatus === 'imported' || !navigator.onLine) {
              return { ...merged, imageUrl: cached.dataUrl };
            }
          }
          return merged;
        });

        normalized.sort((a, b) => a.createdAt - b.createdAt);
        resolve(mergeNewDefaultSlides(normalized));
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_SLIDES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Partial<Slide> & { id: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeNewDefaultSlides(parsed.map(normalizeSlideRecord));
        }
      }
    } catch {
      // ignore fallback errors
    }
    return DEFAULT_SLIDES;
  }
}

export async function saveSlidesToStorage(slides: Slide[]): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_SLIDES, STORE_ANNOTATIONS], 'readwrite');
      const slideStore = tx.objectStore(STORE_SLIDES);
      const annStore = tx.objectStore(STORE_ANNOTATIONS);

      slideStore.clear();
      for (const slide of slides) {
        // Store base slide metadata & separate user annotations
        slideStore.put(slide);
        annStore.put(extractAnnotationFromSlide(slide));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK_SLIDES_KEY, JSON.stringify(slides));
    } catch {
      // ignore quota error
    }
  }
}

export async function loadCollectionsFromStorage(): Promise<CustomCollection[]> {
  try {
    const db = await openDatabase();
    return await new Promise<CustomCollection[]>((resolve, reject) => {
      const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
      const req = tx.objectStore(STORE_COLLECTIONS).getAll();
      req.onsuccess = () => {
        const list = (req.result as CustomCollection[]) ?? [];
        list.sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveCollectionsToStorage(collections: CustomCollection[]): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
      const store = tx.objectStore(STORE_COLLECTIONS);
      store.clear();
      for (const col of collections) {
        store.put(col);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export interface OfflineCacheMeta {
  slideId: string;
  variant: 'thumb' | 'full';
  bytes: number;
  cachedAt: number;
}

export async function cacheSlideImageOffline(
  slideId: string,
  remoteImageUrl: string,
  variant: 'thumb' | 'full' = 'full'
): Promise<{ dataUrl: string; meta: OfflineCacheMeta }> {
  const cleanUrl = normalizeSlideImageUrl(remoteImageUrl);
  const fetchUrl = cleanUrl.startsWith('https://')
    ? `/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`
    : cleanUrl;

  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Image cache failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to encode image'));
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });

  const cachedAt = Date.now();
  const bytes = blob.size || dataUrl.length;

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGE_CACHE, 'readwrite');
    tx.objectStore(STORE_IMAGE_CACHE).put({
      key: slideId,
      slideId,
      variant,
      bytes,
      dataUrl,
      cachedAt,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return {
    dataUrl,
    meta: { slideId, variant, bytes, cachedAt },
  };
}

export async function loadOfflineCacheIndex(): Promise<Record<string, OfflineCacheMeta>> {
  try {
    const db = await openDatabase();
    return await new Promise<Record<string, OfflineCacheMeta>>((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_IMAGE_CACHE).getAll();
      req.onsuccess = () => {
        const rows =
          (req.result as Array<{
            key: string;
            slideId?: string;
            variant?: 'thumb' | 'full';
            bytes?: number;
            dataUrl?: string;
            cachedAt?: number;
          }>) ?? [];
        const map: Record<string, OfflineCacheMeta> = {};
        for (const row of rows) {
          const id = row.slideId ?? row.key;
          map[id] = {
            slideId: id,
            variant: row.variant ?? 'full',
            bytes: row.bytes ?? (row.dataUrl ? Math.round((row.dataUrl.length * 3) / 4) : 0),
            cachedAt: row.cachedAt ?? Date.now(),
          };
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function getOfflineCachedDataUrl(slideId: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_IMAGE_CACHE).get(slideId);
      req.onsuccess = () => {
        const res = req.result as { dataUrl?: string } | undefined;
        resolve(res?.dataUrl ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function removeOfflineCachedSlide(slideId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGE_CACHE, 'readwrite');
      tx.objectStore(STORE_IMAGE_CACHE).delete(slideId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function clearAllOfflineImages(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGE_CACHE, 'readwrite');
      tx.objectStore(STORE_IMAGE_CACHE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function estimateBrowserStorage(): Promise<{
  usageBytes?: number;
  quotaBytes?: number;
}> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return { usageBytes: est.usage, quotaBytes: est.quota };
    }
  } catch {
    // ignore
  }
  return {};
}

export function loadThemePreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(LS_THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore
  }
  return 'light';
}

export function saveThemePreference(theme: ThemeMode): void {
  try {
    localStorage.setItem(LS_THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadActiveSlideId(): string | null {
  try {
    return localStorage.getItem(LS_ACTIVE_SLIDE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSlideId(slideId: string): void {
  try {
    localStorage.setItem(LS_ACTIVE_SLIDE_KEY, slideId);
  } catch {
    // ignore
  }
}

export async function loadPracticalAttemptsFromStorage(): Promise<PracticalAttemptRecord[]> {
  try {
    const db = await openDatabase();
    return await new Promise<PracticalAttemptRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ATTEMPTS, 'readonly');
      const req = tx.objectStore(STORE_ATTEMPTS).getAll();
      req.onsuccess = () => {
        const list = (req.result as PracticalAttemptRecord[]) ?? [];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_ATTEMPTS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as PracticalAttemptRecord[];
        return Array.isArray(list) ? list : [];
      }
    } catch {
      // ignore
    }
    return [];
  }
}

export async function savePracticalAttempt(attempt: PracticalAttemptRecord): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ATTEMPTS, 'readwrite');
      tx.objectStore(STORE_ATTEMPTS).put(attempt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_ATTEMPTS_KEY);
      const list = raw ? (JSON.parse(raw) as PracticalAttemptRecord[]) : [];
      const next = [attempt, ...list].slice(0, 500);
      localStorage.setItem(LS_FALLBACK_ATTEMPTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
}

export async function loadStudyProgressFromStorage(): Promise<Record<string, SlideStudyProgress>> {
  try {
    const db = await openDatabase();
    return await new Promise<Record<string, SlideStudyProgress>>((resolve, reject) => {
      const tx = db.transaction(STORE_PROGRESS, 'readonly');
      const req = tx.objectStore(STORE_PROGRESS).getAll();
      req.onsuccess = () => {
        const list = (req.result as SlideStudyProgress[]) ?? [];
        const map: Record<string, SlideStudyProgress> = {};
        for (const item of list) {
          map[item.slideId] = item;
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_PROGRESS_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, SlideStudyProgress>;
      }
    } catch {
      // ignore
    }
    return {};
  }
}

export async function saveSlideStudyProgress(progress: SlideStudyProgress): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      tx.objectStore(STORE_PROGRESS).put(progress);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_PROGRESS_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, SlideStudyProgress>) : {};
      map[progress.slideId] = progress;
      localStorage.setItem(LS_FALLBACK_PROGRESS_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }
}

export async function clearStudyPerformanceStorage(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_ATTEMPTS, STORE_PROGRESS], 'readwrite');
      tx.objectStore(STORE_ATTEMPTS).clear();
      tx.objectStore(STORE_PROGRESS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LS_FALLBACK_ATTEMPTS_KEY);
    localStorage.removeItem(LS_FALLBACK_PROGRESS_KEY);
  } catch {
    // ignore
  }
}
