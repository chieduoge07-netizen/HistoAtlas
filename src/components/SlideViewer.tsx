import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Hand,
  ImagePlus,
  Loader2,
  MapPin,
  Maximize,
  Maximize2,
  Menu,
  Microscope,
  Minimize,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCw,
  Star,
} from 'lucide-react';
import { Pin, Slide, ViewerToolMode } from '../types/histology';
import { getSlideFullUrl, getSlideThumbnailUrl } from '../utils/imageUrls';
import { getOfflineCachedDataUrl } from '../utils/storage';
import { TiledSlideViewer } from './TiledSlideViewer';

interface SlideViewerProps {
  slide: Slide;
  selectedPinId: string | null;
  quizMode: boolean;
  revealedPinIds: Set<string>;
  toolMode: ViewerToolMode;
  onChangeToolMode: (mode: ViewerToolMode) => void;
  onDropPin: (xPercent: number, yPercent: number) => void;
  onSelectPin: (pinId: string) => void;
  focusRequest: { pinId: string; seq: number } | null;
  onOpenSidebarMobile: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onToggleFavorite?: (slideId: string) => void;
  onRotateSlide?: (slideId: string, nextDeg: 0 | 90 | 180 | 270) => void;
  onAttachPermittedImage?: (slideId: string, dataUrl: string) => void;
  hideHeaderMetadata?: boolean;
  onBackMobile?: () => void;
  onOpenMobileNotes?: () => void;
  offlineVariant?: 'thumb' | 'full';
  onCacheOfflineQuick?: (slideId: string) => Promise<void>;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8.0;

export const SlideViewer: React.FC<SlideViewerProps> = ({
  slide,
  selectedPinId,
  quizMode,
  revealedPinIds,
  toolMode,
  onChangeToolMode,
  onDropPin,
  onSelectPin,
  focusRequest,
  onOpenSidebarMobile,
  isRightPanelOpen,
  onToggleRightPanel,
  onToggleFavorite,
  onRotateSlide,
  onAttachPermittedImage,
  hideHeaderMetadata = false,
  onBackMobile,
  onOpenMobileNotes,
  offlineVariant,
  onCacheOfflineQuick,
}) => {
  const viewerRootRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [naturalSize, setNaturalSize] = useState({ width: 1200, height: 900 });
  const [imageError, setImageError] = useState(false);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [offlineDataUrl, setOfflineDataUrl] = useState<string | null>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const [fullRequested, setFullRequested] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(Boolean(slide.imageUrl));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cachingNow, setCachingNow] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [localRotation, setLocalRotation] = useState<0 | 90 | 180 | 270>(
    slide.rotationDeg ?? 0
  );
  const [isDragging, setIsDragging] = useState(false);
  const [animateTransform, setAnimateTransform] = useState(false);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  const rotation = slide.rotationDeg ?? localRotation;

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    startMid: { x: number; y: number };
  } | null>(null);
  const didPinchRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const pointerStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  // Reset error & viewport when active slide changes
  useEffect(() => {
    setImageError(false);
    setUseProxyFallback(false);
    setOfflineDataUrl(null);
    setThumbReady(false);
    setFullRequested(false);
    setIsImageLoading(Boolean(slide.imageUrl || slide.highResUrl || slide.thumbnailUrl));
    setAnimateTransform(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLocalRotation(slide.rotationDeg ?? 0);
    setHoveredPinId(null);
    activePointersRef.current.clear();
    pinchStateRef.current = null;
  }, [slide.id, slide.imageUrl, slide.highResUrl, slide.rotationDeg]);

  // Progressive full-res trigger when zooming in or after lightweight preview paints
  useEffect(() => {
    if (zoom >= 1.25 || thumbReady) {
      setFullRequested(true);
    }
  }, [zoom, thumbReady]);

  // Pre-check IndexedDB offline image if currently offline
  useEffect(() => {
    let active = true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      getOfflineCachedDataUrl(slide.id).then((url) => {
        if (active && url) {
          setOfflineDataUrl(url);
          setImageError(false);
          setIsImageLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [slide.id]);

  // Listen to fullscreen state changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && viewerRootRef.current) {
        await viewerRootRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore if browser blocks fullscreen in iframe
    }
  };

  // Measure container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Base fit dimensions at zoom = 1
  const padX = 48;
  const padY = 112;
  const availW = Math.max(200, containerSize.width - padX);
  const availH = Math.max(200, containerSize.height - padY);
  const isRotatedQuarter = rotation === 90 || rotation === 270;
  const effectiveW = isRotatedQuarter ? naturalSize.height : naturalSize.width;
  const effectiveH = isRotatedQuarter ? naturalSize.width : naturalSize.height;
  const baseScale = Math.min(availW / effectiveW, availH / effectiveH);
  const stageWidth = Math.max(100, naturalSize.width * baseScale);
  const stageHeight = Math.max(100, naturalSize.height * baseScale);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomAroundPoint = useCallback(
    (nextZoomRaw: number, clientX?: number, clientY?: number, smooth = false) => {
      const container = containerRef.current;
      const nextZoom = clampZoom(nextZoomRaw);

      setAnimateTransform(smooth);

      if (!container || clientX === undefined || clientY === undefined) {
        setZoom((prevZoom) => {
          const ratio = nextZoom / prevZoom;
          setPan((prevPan) => ({
            x: prevPan.x * ratio,
            y: prevPan.y * ratio,
          }));
          return nextZoom;
        });
        return;
      }

      const rect = container.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);

      setZoom((prevZoom) => {
        setPan((prevPan) => {
          const pointX = (dx - prevPan.x) / prevZoom;
          const pointY = (dy - prevPan.y) / prevZoom;
          return {
            x: dx - pointX * nextZoom,
            y: dy - pointY * nextZoom,
          };
        });
        return nextZoom;
      });
    },
    []
  );

  const handleFitReset = useCallback(() => {
    setAnimateTransform(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan/zoom smoothly to a pin when clicked in the Right Panel
  useEffect(() => {
    if (!focusRequest) return;
    const pin = slide.pins.find((p) => p.id === focusRequest.pinId);
    if (!pin) return;

    const targetZoom = Math.max(zoom, 2.2);
    const ox = ((pin.x - 50) / 100) * stageWidth;
    const oy = ((pin.y - 50) / 100) * stageHeight;

    let rx = ox;
    let ry = oy;
    if (rotation === 90) {
      rx = -oy;
      ry = ox;
    } else if (rotation === 180) {
      rx = -ox;
      ry = -oy;
    } else if (rotation === 270) {
      rx = oy;
      ry = -ox;
    }

    setAnimateTransform(true);
    setZoom(targetZoom);
    setPan({
      x: -rx * targetZoom,
      y: -ry * targetZoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // Attach non-passive wheel listener for responsive zoom-at-cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const intensity = e.ctrlKey ? 0.012 : 0.0018;
      const factor = Math.exp(-e.deltaY * intensity);
      zoomAroundPoint(zoom * factor, e.clientX, e.clientY, false);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, zoomAroundPoint]);

  const screenToStagePercent = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);

    const sx = (dx - pan.x) / zoom;
    const sy = (dy - pan.y) / zoom;

    // Inverse rotate around stage center
    let rx = sx;
    let ry = sy;
    if (rotation === 90) {
      rx = sy;
      ry = -sx;
    } else if (rotation === 180) {
      rx = -sx;
      ry = -sy;
    } else if (rotation === 270) {
      rx = -sy;
      ry = sx;
    }

    const xPct = ((rx + stageWidth / 2) / stageWidth) * 100;
    const yPct = ((ry + stageHeight / 2) / stageHeight) * 100;

    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) {
      return null;
    }
    return {
      x: Math.round(xPct * 10) / 10,
      y: Math.round(yPct * 10) / 10,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-viewer-hud="true"]') || target.closest('[data-pin-marker="true"]')) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if browser declines pointer capture
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimateTransform(false);
    setIsDragging(true);

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchStateRef.current = {
        active: true,
        startDist: Math.max(10, dist),
        startZoom: zoom,
        startPan: { ...pan },
        startMid: mid,
      };
      didPinchRef.current = true;
      pointerStateRef.current.moved = true;
      return;
    }

    didPinchRef.current = false;
    pointerStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size >= 2 && pinchStateRef.current?.active) {
      const container = containerRef.current;
      if (!container) return;
      const pts = Array.from(activePointersRef.current.values());
      const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const curMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

      const pState = pinchStateRef.current;
      const nextZoom = clampZoom(pState.startZoom * (curDist / pState.startDist));

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const startMidDx = pState.startMid.x - cx;
      const startMidDy = pState.startMid.y - cy;
      const curMidDx = curMid.x - cx;
      const curMidDy = curMid.y - cy;

      const worldX = (startMidDx - pState.startPan.x) / pState.startZoom;
      const worldY = (startMidDy - pState.startPan.y) / pState.startZoom;

      setAnimateTransform(false);
      setZoom(nextZoom);
      setPan({
        x: curMidDx - worldX * nextZoom,
        y: curMidDy - worldY * nextZoom,
      });
      return;
    }

    const coords = screenToStagePercent(e.clientX, e.clientY);
    setCursorCoords(coords);

    const st = pointerStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - st.startX;
    const deltaY = e.clientY - st.startY;
    if (!st.moved && Math.hypot(deltaX, deltaY) > 5) {
      st.moved = true;
    }

    if (st.moved) {
      setPan({
        x: st.startPanX + deltaX,
        y: st.startPanY + deltaY,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }

    activePointersRef.current.delete(e.pointerId);

    // If transitioning from 2 fingers back to 1 finger, smoothly re-anchor remaining pointer
    if (activePointersRef.current.size === 1 && pinchStateRef.current?.active) {
      pinchStateRef.current = null;
      const [remainingId, remainingPt] = Array.from(activePointersRef.current.entries())[0];
      pointerStateRef.current = {
        active: true,
        pointerId: remainingId,
        startX: remainingPt.x,
        startY: remainingPt.y,
        startPanX: pan.x,
        startPanY: pan.y,
        moved: true,
      };
      return;
    }

    if (activePointersRef.current.size === 0) {
      pinchStateRef.current = null;
      setIsDragging(false);
    }

    const st = pointerStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;

    const didMove = st.moved;
    pointerStateRef.current.active = false;
    pointerStateRef.current.pointerId = null;

    if (!didMove && !didPinchRef.current) {
      // Double-tap zoom in pan mode (or quick double tap on touch)
      if (toolMode === 'pan') {
        const now = Date.now();
        const last = lastTapRef.current;
        if (last && now - last.time < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32) {
          lastTapRef.current = null;
          if (zoom > 1.45) {
            handleFitReset();
          } else {
            zoomAroundPoint(2.6, e.clientX, e.clientY, true);
          }
          return;
        }
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        return;
      }

      if (toolMode === 'pin') {
        const coords = screenToStagePercent(e.clientX, e.clientY);
        if (coords) {
          onDropPin(coords.x, coords.y);
        }
      }
    }
  };

  const handleRotate = () => {
    const nextDeg = (((rotation + 90) % 360) as 0 | 90 | 180 | 270);
    setAnimateTransform(true);
    setLocalRotation(nextDeg);
    onRotateSlide?.(slide.id, nextDeg);
  };

  // Dynamic calibrated micrometer scale bar
  const umPerScreenPixel = slide.fieldWidthUm / (stageWidth * zoom);
  const scaleCandidatesUm = [200, 100, 50, 25, 10, 5];
  let chosenScaleUm = 50;
  for (const candidate of scaleCandidatesUm) {
    const px = candidate / umPerScreenPixel;
    if (px >= 48 && px <= 116) {
      chosenScaleUm = candidate;
      break;
    }
    if (px < 48) {
      chosenScaleUm = candidate;
    }
  }
  const scaleBarWidthPx = Math.min(130, Math.max(32, Math.round(chosenScaleUm / umPerScreenPixel)));

  const cursorClass = isDragging
    ? 'cursor-grabbing'
    : toolMode === 'pin'
      ? 'cursor-crosshair'
      : 'cursor-grab';

  const thumbUrl = getSlideThumbnailUrl(slide);
  const fullUrl = getSlideFullUrl(slide);
  const activeRemoteUrl =
    offlineDataUrl ||
    (thumbUrl && thumbUrl !== fullUrl && !fullRequested ? thumbUrl : fullUrl || thumbUrl);
  const displayImageSrc =
    offlineDataUrl ||
    (useProxyFallback && activeRemoteUrl.startsWith('https://')
      ? `/api/image-proxy?url=${encodeURIComponent(activeRemoteUrl)}`
      : activeRemoteUrl);
  const isExternalWithoutImage = slide.importStatus === 'external-reference' && !fullUrl && !thumbUrl;

  return (
    <main
      ref={viewerRootRef}
      className="relative flex flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-[#090C12]"
    >
      {/* Top Slide Header Bar inside Center Viewer */}
      <header className="z-20 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-200 bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-[#111622]/95">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onBackMobile ? (
            <button
              type="button"
              onClick={onBackMobile}
              aria-label="Back to library"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSidebarMobile}
              aria-label="Open tissue chapters sidebar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {hideHeaderMetadata ? 'Practical Exam Specimen' : slide.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              {hideHeaderMetadata ? (
                <span className="truncate">Identify organ, tissue type, and structures</span>
              ) : (
                <>
                  <span className="truncate">{slide.anatomicalSystem || slide.chapter}</span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline truncate">{slide.organ || slide.specimen}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{slide.stain}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums shrink-0">{slide.magnification}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {quizMode && !hideHeaderMetadata && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200 whitespace-nowrap shrink-0">
              <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Quiz Active: Tap pins to reveal</span>
            </div>
          )}

          {!hideHeaderMetadata && onCacheOfflineQuick && fullUrl.startsWith('https://') && (
            <button
              type="button"
              disabled={cachingNow}
              onClick={async () => {
                setCachingNow(true);
                try {
                  await onCacheOfflineQuick(slide.id);
                } finally {
                  setCachingNow(false);
                }
              }}
              title={
                offlineVariant === 'full'
                  ? 'Full resolution saved offline'
                  : offlineVariant === 'thumb'
                    ? 'Thumbnail saved offline (tap to save full-res)'
                    : 'Save slide for offline study'
              }
              aria-label="Save slide offline"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                offlineVariant === 'full'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : offlineVariant === 'thumb'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {cachingNow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : offlineVariant === 'full' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}

          {!hideHeaderMetadata && onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(slide.id)}
              aria-label={slide.isFavorite ? 'Remove from favorites' : 'Bookmark slide as favorite'}
              title={slide.isFavorite ? 'Bookmarked in Favorites' : 'Bookmark slide'}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                slide.isFavorite
                  ? 'border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-400'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Star className={`h-4 w-4 ${slide.isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}

          {!hideHeaderMetadata && slide.originalSourceUrl && (
            <a
              href={slide.originalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open original slide on ${slide.sourceInstitution}`}
              className="hidden md:flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Source</span>
            </a>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen viewer'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {!hideHeaderMetadata && (
            <button
              type="button"
              onClick={onOpenMobileNotes ?? onToggleRightPanel}
              aria-label={isRightPanelOpen ? 'Hide study notes panel' : 'Show study notes panel'}
              className="hidden lg:flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              {isRightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isRightPanelOpen ? 'Hide Notes' : 'Show Notes'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Route to OpenSeadragon Tiled WSI Viewer if slide provides a tileSourceUrl */}
      {slide.tileSourceUrl ? (
        <TiledSlideViewer
          tileSourceUrl={slide.tileSourceUrl}
          pins={slide.pins}
          selectedPinId={selectedPinId}
          quizMode={quizMode}
          revealedPinIds={revealedPinIds}
          toolMode={toolMode}
          onDropPin={onDropPin}
          onSelectPin={onSelectPin}
        />
      ) : isExternalWithoutImage ? (
        /* External Reference Stage (when source does not permit direct image import) */
        <div className="stage-grid flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <ExternalLink className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  External University Reference · {slide.sourceInstitution}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {slide.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{slide.anatomicalSystem}</span>
                  <span aria-hidden="true">·</span>
                  <span>{slide.organ}</span>
                  <span aria-hidden="true">·</span>
                  <span>{slide.stain}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {slide.overviewNotes}
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-400">
              Direct automated image importing is disabled for this university source to respect
              educational licensing. Open the original virtual slidebox in a new tab, or attach a
              permitted image file below to annotate it directly in HistoAtlas.
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {slide.originalSourceUrl && (
                <a
                  href={slide.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Original Slide</span>
                </a>
              )}

              {onAttachPermittedImage && (
                <>
                  <input
                    ref={attachFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          onAttachPermittedImage(slide.id, reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => attachFileRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Attach Permitted Image</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Pan & Zoom Canvas */
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => setCursorCoords(null)}
          className={`stage-grid relative flex-1 select-none overflow-hidden touch-none ${cursorClass}`}
        >
          {/* Centered Transformable Specimen Stage */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              style={{
                width: `${stageWidth}px`,
                height: `${stageHeight}px`,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: animateTransform ? 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              }}
              className="pointer-events-auto relative rounded-sm shadow-[0_8px_36px_rgba(15,23,42,0.16)] ring-1 ring-slate-300/80 dark:shadow-[0_12px_44px_rgba(0,0,0,0.65)] dark:ring-slate-700/80"
            >
              {/* Progressive lightweight thumbnail while full-resolution micrograph streams */}
              {thumbUrl && thumbUrl !== displayImageSrc && isImageLoading && !imageError && (
                <img
                  src={thumbUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  decoding="async"
                  onLoad={() => setThumbReady(true)}
                  className="absolute inset-0 h-full w-full rounded-sm object-contain"
                />
              )}

              {imageError ? (
                <div className="flex h-full w-full flex-col items-center justify-center bg-slate-200 p-6 text-center dark:bg-slate-900">
                  <Microscope className="h-10 w-10 text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {hideHeaderMetadata ? 'Specimen Image Unavailable' : slide.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    The micrograph could not be loaded (check connection or cache offline).
                  </p>
                  {slide.originalSourceUrl && (
                    <a
                      href={slide.originalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Original Source</span>
                    </a>
                  )}
                </div>
              ) : (
                <img
                  src={displayImageSrc}
                  alt={
                    hideHeaderMetadata
                      ? 'Histology specimen for practical identification'
                      : `${slide.title} (${slide.stain}, ${slide.magnification})`
                  }
                  referrerPolicy="no-referrer"
                  decoding="async"
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setIsImageLoading(false);
                    setThumbReady(true);
                    if (img.naturalWidth && img.naturalHeight) {
                      setNaturalSize({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }
                  }}
                  onError={async () => {
                    if (!useProxyFallback && activeRemoteUrl.startsWith('https://')) {
                      setUseProxyFallback(true);
                      setIsImageLoading(true);
                      return;
                    }
                    if (!offlineDataUrl) {
                      const cached = await getOfflineCachedDataUrl(slide.id);
                      if (cached) {
                        setOfflineDataUrl(cached);
                        setIsImageLoading(false);
                        return;
                      }
                    }
                    setIsImageLoading(false);
                    setImageError(true);
                  }}
                  className="block h-full w-full rounded-sm object-contain select-none"
                />
              )}

              {/* Loading indicator overlay */}
              {isImageLoading && !imageError && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/15">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Loading micrograph...</span>
                  </div>
                </div>
              )}

              {/* Numbered Anatomical Pins */}
              {slide.pins.map((pin: Pin) => {
                const isSelected = pin.id === selectedPinId;
                const isRevealed = !quizMode || revealedPinIds.has(pin.id);
                const isHovered = hoveredPinId === pin.id;

                const pinStyle =
                  quizMode && !isRevealed
                    ? isSelected
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/40 border-white'
                      : 'bg-amber-500/95 text-slate-950 border-white hover:bg-amber-400'
                    : isSelected
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/35 border-white'
                      : 'bg-slate-900/90 text-white border-white/90 hover:bg-blue-600 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-900 dark:hover:bg-blue-500 dark:hover:text-white';

                return (
                  <div
                    key={pin.id}
                    data-pin-marker="true"
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      transform: `translate(-50%, -50%) rotate(${-rotation}deg) scale(${1 / zoom})`,
                    }}
                    className="absolute z-10"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPin(pin.id);
                      }}
                      onMouseEnter={() => setHoveredPinId(pin.id)}
                      onMouseLeave={() => setHoveredPinId(null)}
                      aria-label={
                        isRevealed
                          ? `Pin ${pin.number}: ${pin.label}`
                          : `Hidden Pin ${pin.number}. Click to reveal`
                      }
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold tabular-nums shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${pinStyle}`}
                    >
                      {pin.number}
                    </button>

                    {/* Callout Label (Strictly hidden in Quiz Mode until revealed!) */}
                    {(isSelected || isHovered) && (
                      <div className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-900 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100">
                        {isRevealed ? (
                          <span>
                            <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">
                              #{pin.number}
                            </span>
                            {pin.label}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>Click pin #{pin.number} to reveal</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top-Left Subtle Instruction Hint */}
          <div
            data-viewer-hud="true"
            className="pointer-events-none absolute left-4 top-3 z-20 hidden sm:flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-[#111622]/90 dark:text-slate-300"
          >
            {toolMode === 'pin' ? (
              <>
                <Crosshair className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>Click slide to drop pin · Drag to pan · Scroll to zoom</span>
              </>
            ) : (
              <>
                <Hand className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>Pan mode active · Drag to move · Scroll to zoom</span>
              </>
            )}
          </div>

          {/* Top-Right Coordinates & Calibrated Micrometer Scale Bar */}
          <div
            data-viewer-hud="true"
            className="pointer-events-none absolute right-4 top-3 z-20 flex flex-col items-end gap-1.5"
          >
            <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-[#111622]/90">
              <div className="flex flex-col items-end">
                <div
                  style={{ width: `${scaleBarWidthPx}px` }}
                  className="h-1.5 border-x-2 border-b-2 border-slate-800 dark:border-slate-200"
                />
                <span className="mt-0.5 font-mono text-[10px] font-medium tabular-nums text-slate-700 dark:text-slate-300">
                  {chosenScaleUm} µm
                </span>
              </div>
            </div>

            {cursorCoords && (
              <div className="hidden md:block rounded-md border border-slate-200/80 bg-white/85 px-2 py-0.5 font-mono text-[10px] tabular-nums text-slate-500 backdrop-blur-sm dark:border-slate-800 dark:bg-[#111622]/85 dark:text-slate-400">
                X {cursorCoords.x.toFixed(1)}% · Y {cursorCoords.y.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Bottom-Center Floating Microscopy Control Dock */}
          <div
            data-viewer-hud="true"
            className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm dark:border-slate-700/80 dark:bg-[#111622]/95"
          >
            {/* Tool Segmented Switch: Drop Pin vs Pan */}
            <div
              role="group"
              aria-label="Canvas interaction tool"
              className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/90 shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeToolMode('pin')}
                className={`flex h-9 sm:h-auto items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  toolMode === 'pin'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pin</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeToolMode('pan')}
                className={`flex h-9 sm:h-auto items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  toolMode === 'pan'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pan</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => zoomAroundPoint(zoom / 1.35, undefined, undefined, true)}
                aria-label="Zoom out"
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <span className="min-w-[2.8rem] text-center font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {zoom.toFixed(1)}×
              </span>

              <button
                type="button"
                onClick={() => zoomAroundPoint(zoom * 1.35, undefined, undefined, true)}
                aria-label="Zoom in"
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />

            {/* Preset Objective Multipliers */}
            <div className="hidden sm:flex items-center gap-0.5 shrink-0">
              {[1, 2, 4].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    preset === 1
                      ? handleFitReset()
                      : zoomAroundPoint(preset, undefined, undefined, true)
                  }
                  className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium tabular-nums transition-colors ${
                    Math.abs(zoom - preset) < 0.15
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset}×
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRotate}
              title={`Rotate slide (${rotation}°)`}
              aria-label="Rotate slide 90 degrees"
              className="flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleFitReset}
              title="Fit slide to screen"
              aria-label="Fit slide to screen"
              className="flex h-9 sm:h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 whitespace-nowrap"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Fit</span>
            </button>

            {onOpenMobileNotes && !hideHeaderMetadata && (
              <>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 lg:hidden" aria-hidden="true" />
                <button
                  type="button"
                  onClick={onOpenMobileNotes}
                  className="flex lg:hidden h-9 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Notes</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
