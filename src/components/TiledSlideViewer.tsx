import React, { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { Eye, Maximize2, Minus, Plus, RotateCw } from 'lucide-react';
import { Pin, ViewerToolMode } from '../types/histology';

interface TiledSlideViewerProps {
  tileSourceUrl: string;
  pins: Pin[];
  selectedPinId: string | null;
  quizMode: boolean;
  revealedPinIds: Set<string>;
  toolMode: ViewerToolMode;
  onDropPin: (xPercent: number, yPercent: number) => void;
  onSelectPin: (pinId: string) => void;
}

export const TiledSlideViewer: React.FC<TiledSlideViewerProps> = ({
  tileSourceUrl,
  pins,
  selectedPinId,
  quizMode,
  revealedPinIds,
  toolMode,
  onDropPin,
  onSelectPin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<
    Array<{ pin: Pin; left: number; top: number; visible: boolean }>
  >([]);

  const syncPinPositions = () => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.world || viewer.world.getItemCount() === 0) return;

    const tiledImage = viewer.world.getItemAt(0);
    const contentSize = tiledImage.getContentSize();
    const mapped = pins.map((pin) => {
      const imgPoint = new OpenSeadragon.Point(
        (pin.x / 100) * contentSize.x,
        (pin.y / 100) * contentSize.y
      );
      const viewportPoint = tiledImage.imageToViewportCoordinates(imgPoint);
      const pixelPoint = viewer.viewport.viewportToViewerElementCoordinates(viewportPoint);
      return {
        pin,
        left: pixelPoint.x,
        top: pixelPoint.y,
        visible: true,
      };
    });
    setPinScreenCoords(mapped);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setLoadError(null);
    const viewer = OpenSeadragon({
      element: el,
      tileSources: tileSourceUrl,
      showNavigationControl: false,
      animationTime: 0.4,
      blendTime: 0.1,
      maxZoomPixelRatio: 2.5,
      visibilityRatio: 0.5,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: toolMode === 'pan',
      },
    });

    viewerRef.current = viewer;

    viewer.addHandler('open', () => {
      syncPinPositions();
    });
    viewer.addHandler('open-failed', () => {
      setLoadError('Could not load tiled whole-slide manifest from source.');
    });
    viewer.addHandler('animation', () => {
      setZoomLevel(Number(viewer.viewport.getZoom(true).toFixed(2)));
      syncPinPositions();
    });
    viewer.addHandler('resize', syncPinPositions);

    viewer.addHandler('canvas-click', (event) => {
      if (!event.quick || toolMode !== 'pin') return;
      if (!viewer.world || viewer.world.getItemCount() === 0) return;
      const tiledImage = viewer.world.getItemAt(0);
      const contentSize = tiledImage.getContentSize();
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = tiledImage.viewportToImageCoordinates(viewportPoint);

      const xPct = (imagePoint.x / contentSize.x) * 100;
      const yPct = (imagePoint.y / contentSize.y) * 100;
      if (xPct >= 0 && xPct <= 100 && yPct >= 0 && yPct <= 100) {
        onDropPin(Math.round(xPct * 10) / 10, Math.round(yPct * 10) / 10);
      }
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileSourceUrl]);

  useEffect(() => {
    syncPinPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, toolMode]);

  return (
    <div className="relative flex-1 overflow-hidden bg-slate-950">
      <div ref={containerRef} className="h-full w-full" />

      {/* Synchronized Pin Overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pinScreenCoords.map(({ pin, left, top }) => {
          const isSelected = pin.id === selectedPinId;
          const isRevealed = !quizMode || revealedPinIds.has(pin.id);

          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => onSelectPin(pin.id)}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`pointer-events-auto absolute flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold tabular-nums shadow-md ${
                quizMode && !isRevealed
                  ? 'border-white bg-amber-500 text-slate-950'
                  : isSelected
                    ? 'border-white bg-blue-600 text-white ring-4 ring-blue-500/40'
                    : 'border-white bg-slate-900 text-white hover:bg-blue-600'
              }`}
              title={isRevealed ? pin.label : `Pin #${pin.number} (Hidden)`}
            >
              {pin.number}
              {isSelected && (
                <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded bg-slate-900/95 px-2 py-1 text-[11px] font-medium text-white shadow">
                  {isRevealed ? pin.label : (
                    <span className="flex items-center gap-1 text-amber-300">
                      <Eye className="h-3 w-3" /> Hidden
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-6 text-center text-xs text-rose-300">
          {loadError}
        </div>
      )}

      {/* Compact WSI Controls */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-slate-100 shadow-lg backdrop-blur-sm">
        <span className="font-mono text-[11px] text-blue-300">WSI Tiled</span>
        <button
          type="button"
          onClick={() => viewerRef.current?.viewport.zoomBy(0.75)}
          aria-label="Zoom out"
          className="rounded p-1.5 hover:bg-slate-800"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-xs tabular-nums">{zoomLevel.toFixed(1)}×</span>
        <button
          type="button"
          onClick={() => viewerRef.current?.viewport.zoomBy(1.35)}
          aria-label="Zoom in"
          className="rounded p-1.5 hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const next = (rotation + 90) % 360;
            setRotation(next);
            viewerRef.current?.viewport.setRotation(next);
          }}
          aria-label="Rotate slide 90 degrees"
          className="rounded p-1.5 hover:bg-slate-800"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => viewerRef.current?.viewport.goHome()}
          aria-label="Reset view"
          className="rounded p-1.5 hover:bg-slate-800"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
