import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SLIDES } from './data/defaultSlides';
import {
  AnatomicalSystem,
  CustomCollection,
  LibrarySortOption,
  Pin,
  PracticalAttemptRecord,
  QuizConfidence,
  Slide,
  SlideStudyProgress,
  SmartCollectionId,
  ThemeMode,
  ViewerToolMode,
  WorkspaceTab,
} from './types/histology';
import {
  OfflineCacheMeta,
  cacheSlideImageOffline,
  clearStudyPerformanceStorage,
  loadActiveSlideId,
  loadCollectionsFromStorage,
  loadOfflineCacheIndex,
  loadPracticalAttemptsFromStorage,
  loadSlidesFromStorage,
  loadStudyProgressFromStorage,
  loadThemePreference,
  removeOfflineCachedSlide,
  saveActiveSlideId,
  saveCollectionsToStorage,
  savePracticalAttempt,
  saveSlideStudyProgress,
  saveSlidesToStorage,
  saveThemePreference,
} from './utils/storage';
import { getSlideFullUrl, getSlideThumbnailUrl } from './utils/imageUrls';
import { recomputeSlideProgressFromAttempts } from './utils/spacedRepetition';
import { TopWorkspaceBar } from './components/TopWorkspaceBar';
import { OfflineBanner } from './components/OfflineBanner';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { Sidebar } from './components/Sidebar';
import { SlideViewer } from './components/SlideViewer';
import { StudyNotesPanel } from './components/StudyNotesPanel';
import { MobileBottomNav, MobileNavTab } from './components/MobileBottomNav';
import { MobileHomeView } from './components/MobileHomeView';
import { MobileLibraryView } from './components/MobileLibraryView';
import {
  MobileSheetHeight,
  MobileSheetTab,
  MobileStudySheet,
} from './components/MobileStudySheet';
import { UploadSlideModal } from './components/UploadSlideModal';
import { CatalogBrowser } from './components/CatalogBrowser';
import { DiscoverSlidesView } from './components/DiscoverSlidesView';
import { PracticalExamView } from './components/PracticalExamView';
import { SlideAuditView } from './components/SlideAuditView';
import { PerformanceDashboardView } from './components/PerformanceDashboardView';

export default function App() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [customCollections, setCustomCollections] = useState<CustomCollection[]>([]);
  const [offlineCacheIndex, setOfflineCacheIndex] = useState<Record<string, OfflineCacheMeta>>({});
  const [storageReady, setStorageReady] = useState(false);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('viewer');
  const [activeSlideId, setActiveSlideId] = useState<string>(() => {
    return loadActiveSlideId() ?? DEFAULT_SLIDES[0].id;
  });

  const [theme, setTheme] = useState<ThemeMode>(() => loadThemePreference());
  const [toolMode, setToolMode] = useState<ViewerToolMode>('pin');

  // Library filtering, collections, and sorting
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedSmartCollection, setSelectedSmartCollection] =
    useState<SmartCollectionId>('all');
  const [selectedCustomCollectionId, setSelectedCustomCollectionId] = useState<string | null>(
    null
  );
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recent-added');

  // Discovery initial query state
  const [discoverQuery, setDiscoverQuery] = useState('Liver H&E');
  const [discoverSystem, setDiscoverSystem] = useState<AnatomicalSystem | 'all'>('all');

  const [selectedPinId, setSelectedPinId] = useState<string | null>(
    DEFAULT_SLIDES[0].pins[0]?.id ?? null
  );
  const [newlyDroppedPinId, setNewlyDroppedPinId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ pinId: string; seq: number } | null>(null);

  // Quiz Mode State
  const [quizMode, setQuizMode] = useState(false);
  const [revealedPinIds, setRevealedPinIds] = useState<Set<string>>(new Set());
  const [revealedSlideSummary, setRevealedSlideSummary] = useState(false);
  const [quizConfidence, setQuizConfidence] = useState<Record<string, QuizConfidence>>({});

  // Practical Exam 2.0 & Performance State
  const [practicalAttempts, setPracticalAttempts] = useState<PracticalAttemptRecord[]>([]);
  const [studyProgressMap, setStudyProgressMap] = useState<Record<string, SlideStudyProgress>>({});
  const [practicalLaunchConfig, setPracticalLaunchConfig] = useState<{
    queueMode: 'spaced' | 'random';
    systemFilter: string;
  }>({ queueMode: 'spaced', systemFilter: 'all' });

  // Desktop Responsive Panels & Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Mobile-Specific Navigation & Bottom Sheet State (< lg)
  const [mobileNavTab, setMobileNavTab] = useState<MobileNavTab>('home');
  const [mobileShowingViewer, setMobileShowingViewer] = useState(false);
  const [mobileChapterFilter, setMobileChapterFilter] = useState<string>('all');
  const [mobileSheetHeight, setMobileSheetHeight] = useState<MobileSheetHeight>('closed');
  const [mobileSheetTab, setMobileSheetTab] = useState<MobileSheetTab>('notes');
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemePreference(theme);
  }, [theme]);

  // Hydrate persisted slides, collections, attempts, spaced repetition & offline cache index from IndexedDB
  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadSlidesFromStorage(),
      loadCollectionsFromStorage(),
      loadPracticalAttemptsFromStorage(),
      loadStudyProgressFromStorage(),
      loadOfflineCacheIndex(),
    ]).then(([loadedSlides, loadedCollections, loadedAttempts, loadedProgress, loadedCache]) => {
      if (!mounted) return;
      setSlides(loadedSlides);
      setCustomCollections(loadedCollections);
      setPracticalAttempts(loadedAttempts);
      setStudyProgressMap(loadedProgress);
      setOfflineCacheIndex(loadedCache);
      const savedId = loadActiveSlideId();
      const matched = loadedSlides.find((s) => s.id === savedId) ?? loadedSlides[0];
      if (matched) {
        setActiveSlideId(matched.id);
        setSelectedPinId(matched.pins[0]?.id ?? null);
      }
      setStorageReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist slides & separate annotations whenever slides change after hydration
  useEffect(() => {
    if (!storageReady) return;
    saveSlidesToStorage(slides);
  }, [slides, storageReady]);

  // Persist custom collections
  useEffect(() => {
    if (!storageReady) return;
    saveCollectionsToStorage(customCollections);
  }, [customCollections, storageReady]);

  const activeSlide = useMemo(() => {
    return slides.find((s) => s.id === activeSlideId) ?? slides[0];
  }, [slides, activeSlideId]);

  const existingChapters = useMemo(() => {
    return Array.from(new Set(slides.map((s) => s.chapter)));
  }, [slides]);

  const handleSelectSlide = useCallback(
    (slideId: string) => {
      setActiveSlideId(slideId);
      saveActiveSlideId(slideId);
      const target = slides.find((s) => s.id === slideId);
      setSelectedPinId(target?.pins[0]?.id ?? null);
      setNewlyDroppedPinId(null);
      setFocusRequest(null);
      setRevealedPinIds(new Set());
      setRevealedSlideSummary(false);
      setQuizConfidence({});

      // Track lastViewedAt & studiedCount cleanly
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slideId
            ? {
                ...s,
                lastViewedAt: Date.now(),
                studiedCount: (s.studiedCount ?? 0) + 1,
              }
            : s
        )
      );
    },
    [slides]
  );

  const handleOpenSlideMobile = useCallback(
    (slideId: string) => {
      handleSelectSlide(slideId);
      setActiveTab('viewer');
      setMobileShowingViewer(true);
      setMobileSheetHeight('closed');
    },
    [handleSelectSlide]
  );

  const handleToggleFavorite = useCallback((slideId: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === slideId ? { ...s, isFavorite: !s.isFavorite } : s))
    );
  }, []);

  const handleCreateCollection = useCallback((name: string) => {
    const newCol: CustomCollection = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      createdAt: Date.now(),
    };
    setCustomCollections((prev) => [...prev, newCol]);
    setSelectedCustomCollectionId(newCol.id);
  }, []);

  const handleToggleSlideInCollection = useCallback(
    (slideId: string, collectionId: string) => {
      setSlides((prev) =>
        prev.map((s) => {
          if (s.id !== slideId) return s;
          const existing = s.collectionIds ?? [];
          const next = existing.includes(collectionId)
            ? existing.filter((id) => id !== collectionId)
            : [...existing, collectionId];
          return { ...s, collectionIds: next };
        })
      );
    },
    []
  );

  const handleToggleQuizMode = useCallback(() => {
    setQuizMode((prev) => {
      const next = !prev;
      setRevealedPinIds(new Set());
      setRevealedSlideSummary(false);
      setQuizConfidence({});
      if (next) {
        setSelectedPinId(null);
      }
      return next;
    });
  }, []);

  const handleRevealPin = useCallback((pinId: string) => {
    setRevealedPinIds((prev) => {
      const next = new Set(prev);
      next.add(pinId);
      return next;
    });
  }, []);

  const handleHideAllQuiz = useCallback(() => {
    setRevealedPinIds(new Set());
    setRevealedSlideSummary(false);
    setQuizConfidence({});
    setSelectedPinId(null);
  }, []);

  const handleRevealAllQuiz = useCallback(() => {
    if (!activeSlide) return;
    setRevealedPinIds(new Set(activeSlide.pins.map((p) => p.id)));
    setRevealedSlideSummary(true);
  }, [activeSlide]);

  const handleDropPin = useCallback(
    (xPercent: number, yPercent: number) => {
      if (!activeSlide) return;
      const nextNum = activeSlide.pins.length + 1;
      const newPin: Pin = {
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number: nextNum,
        x: xPercent,
        y: yPercent,
        label: `Structure #${nextNum}`,
        notes: '',
      };

      setSlides((prev) =>
        prev.map((s) =>
          s.id === activeSlide.id ? { ...s, pins: [...s.pins, newPin] } : s
        )
      );

      setSelectedPinId(newPin.id);
      setNewlyDroppedPinId(newPin.id);
      setIsRightPanelOpen(true);
      setMobileSheetTab('pins');
      setMobileSheetHeight('half');

      if (quizMode) {
        setRevealedPinIds((prev) => {
          const next = new Set(prev);
          next.add(newPin.id);
          return next;
        });
      }
    },
    [activeSlide, quizMode]
  );

  const handleSelectPinFromCanvas = useCallback(
    (pinId: string) => {
      setSelectedPinId(pinId);
      if (quizMode) {
        handleRevealPin(pinId);
        setMobileSheetTab('quiz');
      } else {
        setMobileSheetTab('pins');
      }
      setIsRightPanelOpen(true);
      setMobileSheetHeight((h) => (h === 'closed' ? 'half' : h));
    },
    [quizMode, handleRevealPin]
  );

  const handleSelectAndFocusPin = useCallback(
    (pinId: string) => {
      setSelectedPinId(pinId);
      if (quizMode) {
        handleRevealPin(pinId);
      }
      setFocusRequest((prev) => ({
        pinId,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    [quizMode, handleRevealPin]
  );

  const handleUpdateSlideNotes = useCallback((slideId: string, overviewNotes: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === slideId ? { ...s, overviewNotes } : s))
    );
  }, []);

  const handleUpdateSlideMetadata = useCallback(
    (slideId: string, updates: Partial<Slide>) => {
      setSlides((prev) =>
        prev.map((s) => (s.id === slideId ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const handleRotateSlide = useCallback(
    (slideId: string, nextDeg: 0 | 90 | 180 | 270) => {
      setSlides((prev) =>
        prev.map((s) => (s.id === slideId ? { ...s, rotationDeg: nextDeg } : s))
      );
    },
    []
  );

  const handleAttachPermittedImage = useCallback(
    (slideId: string, dataUrl: string) => {
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slideId
            ? { ...s, imageUrl: dataUrl, importStatus: 'uploaded' }
            : s
        )
      );
    },
    []
  );

  const handleCacheOfflineImage = useCallback(
    async (slideId: string, variant: 'thumb' | 'full' = 'full') => {
      const target = slides.find((s) => s.id === slideId);
      if (!target) return;
      const remoteUrl =
        variant === 'thumb' ? getSlideThumbnailUrl(target) : getSlideFullUrl(target);
      if (!remoteUrl || !remoteUrl.startsWith('https://')) return;
      const { meta } = await cacheSlideImageOffline(slideId, remoteUrl, variant);
      setOfflineCacheIndex((prev) => ({ ...prev, [slideId]: meta }));
    },
    [slides]
  );

  const handleRemoveOfflineSlide = useCallback(async (slideId: string) => {
    await removeOfflineCachedSlide(slideId);
    setOfflineCacheIndex((prev) => {
      const copy = { ...prev };
      delete copy[slideId];
      return copy;
    });
  }, []);

  const handleToggleOfflineSlideQuick = useCallback(
    async (slideId: string) => {
      const existing = offlineCacheIndex[slideId];
      if (existing?.variant === 'full') {
        await handleRemoveOfflineSlide(slideId);
      } else {
        await handleCacheOfflineImage(slideId, 'full');
      }
    },
    [offlineCacheIndex, handleRemoveOfflineSlide, handleCacheOfflineImage]
  );

  const handleRefreshOfflineIndex = useCallback(async () => {
    const idx = await loadOfflineCacheIndex();
    setOfflineCacheIndex(idx);
  }, []);

  const handleUpdatePin = useCallback(
    (slideId: string, pinId: string, updates: { label?: string; notes?: string }) => {
      setSlides((prev) =>
        prev.map((s) => {
          if (s.id !== slideId) return s;
          return {
            ...s,
            pins: s.pins.map((p) => (p.id === pinId ? { ...p, ...updates } : p)),
          };
        })
      );
    },
    []
  );

  const handleDeletePin = useCallback((slideId: string, pinId: string) => {
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== slideId) return s;
        const remaining = s.pins
          .filter((p) => p.id !== pinId)
          .map((p, index) => ({ ...p, number: index + 1 }));
        return { ...s, pins: remaining };
      })
    );
    setSelectedPinId((prev) => (prev === pinId ? null : prev));
  }, []);

  const handleSaveNewSlide = useCallback((newSlide: Slide) => {
    setSlides((prev) => [newSlide, ...prev]);
    setActiveSlideId(newSlide.id);
    saveActiveSlideId(newSlide.id);
    setSelectedPinId(null);
    setFocusRequest(null);
    setRevealedPinIds(new Set());
    setRevealedSlideSummary(false);
    setQuizConfidence({});
    setToolMode('pin');
    setActiveTab('viewer');
    setMobileShowingViewer(true);
  }, []);

  const handleImportManySlides = useCallback((incomingSlides: Slide[]): void => {
    if (incomingSlides.length === 0) return;
    setSlides((prev) => {
      const existingSourceIds = new Set(prev.map((s) => s.sourceId).filter(Boolean));
      const existingImageUrls = new Set(prev.map((s) => s.imageUrl).filter(Boolean));
      const existingTitles = new Set(prev.map((s) => s.title.toLowerCase()));

      const uniqueNew = incomingSlides.filter((item) => {
        if (item.sourceId && existingSourceIds.has(item.sourceId)) return false;
        if (item.imageUrl && existingImageUrls.has(item.imageUrl)) return false;
        if (existingTitles.has(item.title.toLowerCase())) return false;
        if (item.sourceId) existingSourceIds.add(item.sourceId);
        if (item.imageUrl) existingImageUrls.add(item.imageUrl);
        existingTitles.add(item.title.toLowerCase());
        return true;
      });

      if (uniqueNew.length === 0) return prev;
      return [...uniqueNew, ...prev];
    });
  }, []);

  const handleDeleteSlide = useCallback(
    (slideId: string) => {
      setSlides((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((s) => s.id !== slideId);
        if (activeSlideId === slideId && filtered[0]) {
          setActiveSlideId(filtered[0].id);
          saveActiveSlideId(filtered[0].id);
          setSelectedPinId(filtered[0].pins[0]?.id ?? null);
        }
        return filtered;
      });
    },
    [activeSlideId]
  );

  const handleResetDefaults = useCallback(() => {
    setSlides(DEFAULT_SLIDES);
    setActiveSlideId(DEFAULT_SLIDES[0].id);
    saveActiveSlideId(DEFAULT_SLIDES[0].id);
    setSelectedPinId(DEFAULT_SLIDES[0].pins[0]?.id ?? null);
    setRevealedPinIds(new Set());
    setRevealedSlideSummary(false);
    setQuizConfidence({});
    setFocusRequest(null);
  }, []);

  const handleClearNewPinFlag = useCallback(() => {
    setNewlyDroppedPinId(null);
  }, []);

  const handleBatchUpdateSlides = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setSlides((prev) => updater(prev));
  }, []);

  const handleRecordPracticalAttempt = useCallback(
    (attempt: PracticalAttemptRecord, replaceId?: string) => {
      setPracticalAttempts((prev) => {
        const nextAttempts = replaceId
          ? prev.map((a) => (a.id === replaceId ? attempt : a))
          : [attempt, ...prev];
        const updatedProgress = recomputeSlideProgressFromAttempts(
          attempt.slideId,
          nextAttempts
        );
        if (updatedProgress) {
          setStudyProgressMap((pm) => ({
            ...pm,
            [attempt.slideId]: updatedProgress,
          }));
          saveSlideStudyProgress(updatedProgress);
        }
        return nextAttempts;
      });
      savePracticalAttempt(attempt);
    },
    []
  );

  const handleResetPerformance = useCallback(() => {
    setPracticalAttempts([]);
    setStudyProgressMap({});
    clearStudyPerformanceStorage();
  }, []);

  // Keyboard shortcuts inside Study Viewer when not editing text fields
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'viewer') return;
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isInput || isUploadOpen || isOfflineManagerOpen) return;

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleToggleQuizMode();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setToolMode((m) => (m === 'pin' ? 'pan' : 'pin'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, handleToggleQuizMode, isUploadOpen, isOfflineManagerOpen]);

  const offlineCount = Object.keys(offlineCacheIndex).length;
  const activeOfflineVariant = activeSlide ? offlineCacheIndex[activeSlide.id]?.variant : undefined;

  const handleMobileNavSelect = (nav: MobileNavTab) => {
    setMobileNavTab(nav);
    if (nav === 'practical') {
      setActiveTab('practical');
      setMobileShowingViewer(false);
    } else {
      setActiveTab('viewer');
      setMobileShowingViewer(false);
      if (nav === 'library') {
        setSelectedCustomCollectionId(null);
      }
    }
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090C12] dark:text-slate-100">
      {/* Global Workspace Top Navigation */}
      <TopWorkspaceBar
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'viewer') {
            setMobileShowingViewer(false);
          }
        }}
        globalSearch={librarySearchQuery}
        onChangeGlobalSearch={setLibrarySearchQuery}
        onSearchDiscover={(q) => {
          setDiscoverQuery(q);
          setDiscoverSystem('all');
          setActiveTab('discover');
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
        offlineCount={offlineCount}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        totalSlideCount={slides.length}
      />

      <OfflineBanner />

      {/* DESKTOP WORKSPACE (lg and up: Preserves full 3-panel split workspace) */}
      <div className="hidden lg:flex min-h-0 flex-1 overflow-hidden">
        {activeTab === 'viewer' && (
          <>
            <Sidebar
              slides={slides}
              activeSlideId={activeSlide.id}
              onSelectSlide={handleSelectSlide}
              onToggleFavorite={handleToggleFavorite}
              onOpenUpload={() => setIsUploadOpen(true)}
              onDeleteSlide={handleDeleteSlide}
              onResetDefaults={handleResetDefaults}
              customCollections={customCollections}
              onCreateCollection={handleCreateCollection}
              selectedSmartCollection={selectedSmartCollection}
              onSelectSmartCollection={setSelectedSmartCollection}
              selectedCustomCollectionId={selectedCustomCollectionId}
              onSelectCustomCollection={setSelectedCustomCollectionId}
              sortBy={sortBy}
              onChangeSortBy={setSortBy}
              searchQuery={librarySearchQuery}
              onChangeSearchQuery={setLibrarySearchQuery}
              isOpenMobile={isSidebarMobileOpen}
              onCloseMobile={() => setIsSidebarMobileOpen(false)}
            />

            <SlideViewer
              slide={activeSlide}
              selectedPinId={selectedPinId}
              quizMode={quizMode}
              revealedPinIds={revealedPinIds}
              toolMode={toolMode}
              onChangeToolMode={setToolMode}
              onDropPin={handleDropPin}
              onSelectPin={handleSelectPinFromCanvas}
              focusRequest={focusRequest}
              onOpenSidebarMobile={() => setIsSidebarMobileOpen(true)}
              isRightPanelOpen={isRightPanelOpen}
              onToggleRightPanel={() => setIsRightPanelOpen((o) => !o)}
              onToggleFavorite={handleToggleFavorite}
              onRotateSlide={handleRotateSlide}
              onAttachPermittedImage={handleAttachPermittedImage}
              offlineVariant={activeOfflineVariant}
              onCacheOfflineQuick={handleToggleOfflineSlideQuick}
            />

            <StudyNotesPanel
              slide={activeSlide}
              selectedPinId={selectedPinId}
              newlyDroppedPinId={newlyDroppedPinId}
              quizMode={quizMode}
              onToggleQuizMode={handleToggleQuizMode}
              revealedPinIds={revealedPinIds}
              revealedSlideSummary={revealedSlideSummary}
              onRevealSlideSummary={() => setRevealedSlideSummary(true)}
              onRevealPin={handleRevealPin}
              onHideAllQuiz={handleHideAllQuiz}
              onRevealAllQuiz={handleRevealAllQuiz}
              quizConfidence={quizConfidence}
              onSetQuizConfidence={(pinId, status) =>
                setQuizConfidence((prev) => ({ ...prev, [pinId]: status }))
              }
              onSelectAndFocusPin={handleSelectAndFocusPin}
              onUpdateSlideNotes={handleUpdateSlideNotes}
              onUpdateSlideMetadata={handleUpdateSlideMetadata}
              onCacheOfflineImage={(id) => handleCacheOfflineImage(id, 'full')}
              customCollections={customCollections}
              onToggleSlideInCollection={handleToggleSlideInCollection}
              onUpdatePin={handleUpdatePin}
              onDeletePin={handleDeletePin}
              onClearNewPinFlag={handleClearNewPinFlag}
              isOpen={isRightPanelOpen}
              onCloseMobile={() => setIsRightPanelOpen(false)}
            />
          </>
        )}

        {activeTab === 'audit' && (
          <SlideAuditView
            slides={slides}
            onUpdateSlide={handleUpdateSlideMetadata}
            onBatchUpdateSlides={handleBatchUpdateSlides}
            onOpenSlideInViewer={(slideId) => {
              handleSelectSlide(slideId);
              setActiveTab('viewer');
            }}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogBrowser
            slides={slides}
            onDiscoverTopic={(query, system) => {
              setDiscoverQuery(query);
              setDiscoverSystem(system ?? 'all');
              setActiveTab('discover');
            }}
            onOpenMatchingSlide={(slideId) => {
              handleSelectSlide(slideId);
              setActiveTab('viewer');
            }}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverSlidesView
            initialQuery={discoverQuery}
            initialSystem={discoverSystem}
            existingSlides={slides}
            onImportSlide={handleSaveNewSlide}
            onImportManySlides={handleImportManySlides}
            onOpenExistingSlide={(slideId) => {
              handleSelectSlide(slideId);
              setActiveTab('viewer');
            }}
          />
        )}

        {activeTab === 'practical' && (
          <PracticalExamView
            slides={slides}
            progressMap={studyProgressMap}
            initialQueueMode={practicalLaunchConfig.queueMode}
            initialSystemFilter={practicalLaunchConfig.systemFilter}
            onRecordAttempt={handleRecordPracticalAttempt}
            onOpenAudit={() => setActiveTab('audit')}
            onFlagSlideNeedsReview={(slideId, needsReview) =>
              handleUpdateSlideMetadata(slideId, { needsReview })
            }
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceDashboardView
            slides={slides}
            progressMap={studyProgressMap}
            attempts={practicalAttempts}
            onStartSpacedReview={(queueMode, systemFilter) => {
              setPracticalLaunchConfig({
                queueMode,
                systemFilter: systemFilter ?? 'all',
              });
              setActiveTab('practical');
            }}
            onOpenSlideInViewer={(slideId) => {
              handleSelectSlide(slideId);
              setActiveTab('viewer');
            }}
            onResetPerformance={handleResetPerformance}
          />
        )}
      </div>

      {/* MOBILE & TABLET WORKSPACE (< lg: Mobile-native navigation, touch viewer & bottom sheet) */}
      <div className="flex lg:hidden min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'practical' ? (
          <PracticalExamView
            slides={slides}
            progressMap={studyProgressMap}
            initialQueueMode={practicalLaunchConfig.queueMode}
            initialSystemFilter={practicalLaunchConfig.systemFilter}
            onRecordAttempt={handleRecordPracticalAttempt}
            onOpenAudit={() => setActiveTab('audit')}
            onFlagSlideNeedsReview={(slideId, needsReview) =>
              handleUpdateSlideMetadata(slideId, { needsReview })
            }
            onBackMobile={() => {
              setActiveTab('viewer');
              setMobileNavTab('home');
            }}
          />
        ) : activeTab === 'audit' ? (
          <SlideAuditView
            slides={slides}
            onUpdateSlide={handleUpdateSlideMetadata}
            onBatchUpdateSlides={handleBatchUpdateSlides}
            onOpenSlideInViewer={handleOpenSlideMobile}
          />
        ) : activeTab === 'catalog' ? (
          <CatalogBrowser
            slides={slides}
            onDiscoverTopic={(query, system) => {
              setDiscoverQuery(query);
              setDiscoverSystem(system ?? 'all');
              setActiveTab('discover');
            }}
            onOpenMatchingSlide={handleOpenSlideMobile}
          />
        ) : activeTab === 'discover' ? (
          <DiscoverSlidesView
            initialQuery={discoverQuery}
            initialSystem={discoverSystem}
            existingSlides={slides}
            onImportSlide={handleSaveNewSlide}
            onImportManySlides={handleImportManySlides}
            onOpenExistingSlide={handleOpenSlideMobile}
          />
        ) : activeTab === 'performance' ? (
          <PerformanceDashboardView
            slides={slides}
            progressMap={studyProgressMap}
            attempts={practicalAttempts}
            onStartSpacedReview={(queueMode, systemFilter) => {
              setPracticalLaunchConfig({
                queueMode,
                systemFilter: systemFilter ?? 'all',
              });
              setActiveTab('practical');
            }}
            onOpenSlideInViewer={handleOpenSlideMobile}
            onResetPerformance={handleResetPerformance}
          />
        ) : mobileShowingViewer ? (
          <>
            <SlideViewer
              slide={activeSlide}
              selectedPinId={selectedPinId}
              quizMode={quizMode}
              revealedPinIds={revealedPinIds}
              toolMode={toolMode}
              onChangeToolMode={setToolMode}
              onDropPin={handleDropPin}
              onSelectPin={handleSelectPinFromCanvas}
              focusRequest={focusRequest}
              onOpenSidebarMobile={() => setMobileShowingViewer(false)}
              onBackMobile={() => {
                setMobileShowingViewer(false);
                setMobileSheetHeight('closed');
              }}
              onOpenMobileNotes={() => {
                setMobileSheetTab(quizMode ? 'quiz' : 'notes');
                setMobileSheetHeight((h) => (h === 'closed' ? 'half' : h));
              }}
              isRightPanelOpen={mobileSheetHeight !== 'closed'}
              onToggleRightPanel={() =>
                setMobileSheetHeight((h) => (h === 'closed' ? 'half' : 'closed'))
              }
              onToggleFavorite={handleToggleFavorite}
              onRotateSlide={handleRotateSlide}
              onAttachPermittedImage={handleAttachPermittedImage}
              offlineVariant={activeOfflineVariant}
              onCacheOfflineQuick={handleToggleOfflineSlideQuick}
            />

            <MobileStudySheet
              slide={activeSlide}
              sheetHeight={mobileSheetHeight}
              onChangeHeight={setMobileSheetHeight}
              activeTab={mobileSheetTab}
              onChangeTab={setMobileSheetTab}
              selectedPinId={selectedPinId}
              newlyDroppedPinId={newlyDroppedPinId}
              onClearNewPinFlag={handleClearNewPinFlag}
              quizMode={quizMode}
              onToggleQuizMode={handleToggleQuizMode}
              revealedPinIds={revealedPinIds}
              revealedSlideSummary={revealedSlideSummary}
              onRevealSlideSummary={() => setRevealedSlideSummary(true)}
              onRevealPin={handleRevealPin}
              onHideAllQuiz={handleHideAllQuiz}
              onRevealAllQuiz={handleRevealAllQuiz}
              quizConfidence={quizConfidence}
              onSetQuizConfidence={(pinId, status) =>
                setQuizConfidence((prev) => ({ ...prev, [pinId]: status }))
              }
              onSelectAndFocusPin={handleSelectAndFocusPin}
              onUpdateSlideNotes={handleUpdateSlideNotes}
              onUpdateSlideMetadata={handleUpdateSlideMetadata}
              onUpdatePin={handleUpdatePin}
              onDeletePin={handleDeletePin}
              customCollections={customCollections}
              onToggleSlideInCollection={handleToggleSlideInCollection}
              offlineVariant={activeOfflineVariant}
              onCacheOfflineImage={(id) => handleCacheOfflineImage(id, 'full')}
            />
          </>
        ) : mobileNavTab === 'home' ? (
          <MobileHomeView
            slides={slides}
            activeSlide={activeSlide}
            customCollections={customCollections}
            offlineIndex={offlineCacheIndex}
            searchQuery={librarySearchQuery}
            onChangeSearchQuery={setLibrarySearchQuery}
            onOpenSlide={handleOpenSlideMobile}
            onBrowseChapter={(ch) => {
              setMobileChapterFilter(ch);
              setMobileNavTab('library');
            }}
            onOpenLibraryWithSearch={(q) => {
              setLibrarySearchQuery(q);
              setMobileChapterFilter('all');
              setMobileNavTab('library');
            }}
            onOpenQuizOnActiveSlide={() => {
              setQuizMode(true);
              setRevealedPinIds(new Set());
              setRevealedSlideSummary(false);
              setQuizConfidence({});
              setMobileShowingViewer(true);
              setMobileSheetTab('quiz');
              setMobileSheetHeight('half');
            }}
            onOpenPractical={() => {
              setMobileNavTab('practical');
              setActiveTab('practical');
            }}
            onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenFavoritesTab={() => setMobileNavTab('favorites')}
            onOpenCollection={(colId) => {
              setSelectedCustomCollectionId(colId);
              setMobileChapterFilter('all');
              setMobileNavTab('library');
            }}
          />
        ) : (
          <MobileLibraryView
            mode={mobileNavTab === 'favorites' ? 'favorites' : 'library'}
            slides={slides}
            activeSlideId={activeSlide.id}
            customCollections={customCollections}
            offlineIndex={offlineCacheIndex}
            searchQuery={librarySearchQuery}
            onChangeSearchQuery={setLibrarySearchQuery}
            selectedChapter={mobileChapterFilter}
            onChangeSelectedChapter={setMobileChapterFilter}
            selectedCustomCollectionId={selectedCustomCollectionId}
            onChangeCustomCollectionId={setSelectedCustomCollectionId}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            onSelectSlide={handleOpenSlideMobile}
            onToggleFavorite={handleToggleFavorite}
            onToggleOfflineSlide={handleToggleOfflineSlideQuick}
          />
        )}

        {/* Hide bottom nav while inside full-screen Mobile Microscopy Viewer or Practical Exam */}
        {!(activeTab === 'viewer' && mobileShowingViewer) && activeTab !== 'practical' && (
          <MobileBottomNav
            activeNav={mobileNavTab}
            isMoreOpen={isMoreDrawerOpen}
            onSelectNav={handleMobileNavSelect}
            onToggleMore={setIsMoreDrawerOpen}
            onNavigateWorkspace={(tab) => {
              setActiveTab(tab);
              setMobileShowingViewer(false);
            }}
            onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
            onOpenUpload={() => setIsUploadOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            offlineCount={offlineCount}
          />
        )}
      </div>

      {/* Upload Slide Modal */}
      <UploadSlideModal
        isOpen={isUploadOpen}
        existingChapters={existingChapters}
        onClose={() => setIsUploadOpen(false)}
        onSaveSlide={handleSaveNewSlide}
      />

      {/* Offline Study Storage Manager */}
      <OfflineManagerModal
        isOpen={isOfflineManagerOpen}
        onClose={() => setIsOfflineManagerOpen(false)}
        slides={slides}
        customCollections={customCollections}
        offlineIndex={offlineCacheIndex}
        onCacheSlide={handleCacheOfflineImage}
        onRemoveCachedSlide={handleRemoveOfflineSlide}
        onAfterClearAll={handleRefreshOfflineIndex}
      />
    </div>
  );
}
