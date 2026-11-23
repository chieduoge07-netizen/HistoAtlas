import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  AnatomicalSystem,
  CustomCollection,
  Pin,
  QuizConfidence,
  Slide,
  SlideQualityStatus,
} from '../types/histology';
import { SYSTEM_SECTIONS } from '../data/histologyCatalog';
import { QUALITY_STATUS_OPTIONS } from '../utils/slideAudit';
import { IdentificationEditor } from './IdentificationEditor';

interface StudyNotesPanelProps {
  slide: Slide;
  selectedPinId: string | null;
  newlyDroppedPinId: string | null;
  quizMode: boolean;
  onToggleQuizMode: () => void;
  revealedPinIds: Set<string>;
  revealedSlideSummary: boolean;
  onRevealSlideSummary: () => void;
  onRevealPin: (pinId: string) => void;
  onHideAllQuiz: () => void;
  onRevealAllQuiz: () => void;
  quizConfidence: Record<string, QuizConfidence>;
  onSetQuizConfidence: (pinId: string, status: QuizConfidence) => void;
  onSelectAndFocusPin: (pinId: string) => void;
  onUpdateSlideNotes: (slideId: string, overviewNotes: string) => void;
  onUpdateSlideMetadata: (slideId: string, updates: Partial<Slide>) => void;
  onCacheOfflineImage?: (slideId: string) => Promise<void>;
  customCollections: CustomCollection[];
  onToggleSlideInCollection: (slideId: string, collectionId: string) => void;
  onUpdatePin: (slideId: string, pinId: string, updates: { label?: string; notes?: string }) => void;
  onDeletePin: (slideId: string, pinId: string) => void;
  onClearNewPinFlag: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const StudyNotesPanel: React.FC<StudyNotesPanelProps> = ({
  slide,
  selectedPinId,
  newlyDroppedPinId,
  quizMode,
  onToggleQuizMode,
  revealedPinIds,
  revealedSlideSummary,
  onRevealSlideSummary,
  onRevealPin,
  onHideAllQuiz,
  onRevealAllQuiz,
  quizConfidence,
  onSetQuizConfidence,
  onSelectAndFocusPin,
  onUpdateSlideNotes,
  onUpdateSlideMetadata,
  onCacheOfflineImage,
  customCollections,
  onToggleSlideInCollection,
  onUpdatePin,
  onDeletePin,
  onClearNewPinFlag,
  isOpen,
  onCloseMobile,
}) => {
  const [editingSlideNotes, setEditingSlideNotes] = useState(false);
  const [slideNotesDraft, setSlideNotesDraft] = useState(slide.overviewNotes);

  const [showMetadata, setShowMetadata] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    organ: slide.organ,
    anatomicalSystem: slide.anatomicalSystem,
    tissueType: slide.tissueType,
    stain: slide.stain,
    magnification: slide.magnification,
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [cachingOffline, setCachingOffline] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinLabelDraft, setPinLabelDraft] = useState('');
  const [pinNotesDraft, setPinNotesDraft] = useState('');

  const pinCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingSlideNotes(false);
    setEditingMetadata(false);
    setSlideNotesDraft(slide.overviewNotes);
    setMetaDraft({
      organ: slide.organ,
      anatomicalSystem: slide.anatomicalSystem,
      tissueType: slide.tissueType,
      stain: slide.stain,
      magnification: slide.magnification,
    });
    setEditingPinId(null);
    setCacheMessage(null);
  }, [
    slide.id,
    slide.overviewNotes,
    slide.organ,
    slide.anatomicalSystem,
    slide.tissueType,
    slide.stain,
    slide.magnification,
  ]);

  useEffect(() => {
    if (!newlyDroppedPinId) return;
    const pin = slide.pins.find((p) => p.id === newlyDroppedPinId);
    if (!pin) return;

    setEditingPinId(pin.id);
    setPinLabelDraft(pin.label);
    setPinNotesDraft(pin.notes);
    onClearNewPinFlag();

    requestAnimationFrame(() => {
      pinCardRefs.current[pin.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    });
  }, [newlyDroppedPinId, slide.pins, onClearNewPinFlag]);

  useEffect(() => {
    if (!selectedPinId) return;
    pinCardRefs.current[selectedPinId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedPinId]);

  if (!isOpen) return null;

  const totalPins = slide.pins.length;
  const revealedCount = slide.pins.filter((p) => revealedPinIds.has(p.id)).length;
  const recalledCount = slide.pins.filter((p) => quizConfidence[p.id] === 'recalled').length;

  const startEditingPin = (pin: Pin) => {
    setEditingPinId(pin.id);
    setPinLabelDraft(pin.label);
    setPinNotesDraft(pin.notes);
  };

  const savePinEdit = (pinId: string) => {
    onUpdatePin(slide.id, pinId, {
      label: pinLabelDraft.trim() || `Structure #${slide.pins.find((p) => p.id === pinId)?.number ?? ''}`,
      notes: pinNotesDraft.trim(),
    });
    setEditingPinId(null);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newTagInput.trim().toLowerCase();
    if (!t) return;
    const current = slide.tags ?? [];
    if (!current.includes(t)) {
      onUpdateSlideMetadata(slide.id, { tags: [...current, t] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateSlideMetadata(slide.id, {
      tags: (slide.tags ?? []).filter((t) => t !== tag),
    });
  };

  const isRemoteHttps =
    slide.importStatus === 'imported' &&
    typeof slide.imageUrl === 'string' &&
    slide.imageUrl.startsWith('https://');

  const panelBody = (
    <aside
      aria-label="Study Notes and Quiz Recall"
      className="flex h-full w-full sm:w-96 shrink-0 flex-col border-l border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100"
    >
      {/* Top Quiz Mode Header */}
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap
              className={`h-4 w-4 shrink-0 ${
                quizMode
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
              Study & Recall Notes
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={quizMode}
              onClick={onToggleQuizMode}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                quizMode
                  ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/80'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>Quiz Mode</span>
              <span
                className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  quizMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    quizMode ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close study notes panel"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quiz Mode Progress Bar & Quick Controls */}
        {quizMode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-500/30 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-amber-900 dark:text-amber-200">
                Recall Progress
              </span>
              <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300">
                {revealedCount}/{totalPins} revealed
                {recalledCount > 0 ? ` · ${recalledCount} recalled` : ''}
              </span>
            </div>

            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-900/50">
              <div
                style={{
                  width: `${totalPins > 0 ? Math.round((revealedCount / totalPins) * 100) : 0}%`,
                }}
                className="h-full rounded-full bg-amber-500 transition-[width] duration-200"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onHideAllQuiz}
                className="flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline dark:text-amber-300 whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Hide All</span>
              </button>
              <button
                type="button"
                onClick={onRevealAllQuiz}
                className="flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline dark:text-amber-300 whitespace-nowrap"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                <span>Reveal All</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Notes & Pins */}
      <div className="histo-scroll flex-1 overflow-y-auto px-4 py-4">
        {/* Section 1: Slide Overview Notes */}
        <section aria-label="Slide overview notes">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400">
              Slide Overview
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSlideMetadata(slide.id, { needsReview: !slide.needsReview })
                }
                title="Flag slide for review"
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  slide.needsReview
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Flag className="h-3 w-3" aria-hidden="true" />
                <span>{slide.needsReview ? 'Flagged' : 'Review'}</span>
              </button>

              {(!quizMode || revealedSlideSummary) && !editingSlideNotes && (
                <button
                  type="button"
                  onClick={() => {
                    setSlideNotesDraft(slide.overviewNotes);
                    setEditingSlideNotes(true);
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>

          <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-slate-50">
            {slide.title}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{slide.anatomicalSystem || slide.chapter}</span>
            <span aria-hidden="true">·</span>
            <span>{slide.stain}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{slide.magnification}</span>
            <span aria-hidden="true">·</span>
            <select
              aria-label="Slide quality verification status"
              value={slide.qualityStatus ?? 'needs-review'}
              onChange={(e) =>
                onUpdateSlideMetadata(slide.id, {
                  qualityStatus: e.target.value as SlideQualityStatus,
                  lastAuditedAt: Date.now(),
                })
              }
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {QUALITY_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            {quizMode && !revealedSlideSummary ? (
              <button
                type="button"
                onClick={onRevealSlideSummary}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3.5 py-3 text-left transition-colors hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Slide summary hidden in Quiz Mode</span>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  Click to reveal
                </span>
              </button>
            ) : editingSlideNotes ? (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={4}
                  value={slideNotesDraft}
                  onChange={(e) => setSlideNotesDraft(e.target.value)}
                  className="w-full rounded-lg border border-blue-400 bg-white p-2.5 text-xs leading-relaxed text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-[#0B0F17] dark:text-slate-100"
                  placeholder="Write histological overview, diagnostic hallmarks, and clinical notes..."
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlideNotes(false)}
                    className="rounded-md px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSlideNotes(slide.id, slideNotesDraft.trim());
                      setEditingSlideNotes(false);
                    }}
                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {slide.overviewNotes || 'No slide overview notes yet. Click Edit to add study notes.'}
              </p>
            )}
          </div>

          <div className="mt-4">
            <IdentificationEditor
              identification={slide.identification}
              fallbackOrgan={slide.organ}
              fallbackTissue={slide.tissueType}
              quizHidden={quizMode && !revealedSlideSummary}
              onRevealQuiz={onRevealSlideSummary}
              compact
              onSave={(nextId) =>
                onUpdateSlideMetadata(slide.id, { identification: nextId })
              }
            />
          </div>

          {/* Collapsible Slide Details, Attribution & Collections */}
          <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800/70">
            <button
              type="button"
              onClick={() => setShowMetadata((s) => !s)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <span className="flex items-center gap-1">
                {showMetadata ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Slide Metadata, Tags & Attribution</span>
              </span>
            </button>

            {showMetadata && (
              <div className="mt-2.5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-[#0B0F17]">
                {editingMetadata ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Organ
                      <input
                        type="text"
                        value={metaDraft.organ}
                        onChange={(e) => setMetaDraft((d) => ({ ...d, organ: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Anatomical System
                      <select
                        value={metaDraft.anatomicalSystem}
                        onChange={(e) =>
                          setMetaDraft((d) => ({
                            ...d,
                            anatomicalSystem: e.target.value as AnatomicalSystem,
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {SYSTEM_SECTIONS.map((s) => (
                          <option key={s.system} value={s.system}>
                            {s.system}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Tissue Type
                      <input
                        type="text"
                        value={metaDraft.tissueType}
                        onChange={(e) => setMetaDraft((d) => ({ ...d, tissueType: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Stain
                        <input
                          type="text"
                          value={metaDraft.stain}
                          onChange={(e) => setMetaDraft((d) => ({ ...d, stain: e.target.value }))}
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Magnification
                        <input
                          type="text"
                          value={metaDraft.magnification}
                          onChange={(e) =>
                            setMetaDraft((d) => ({ ...d, magnification: e.target.value }))
                          }
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingMetadata(false)}
                        className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSlideMetadata(slide.id, metaDraft);
                          setEditingMetadata(false);
                        }}
                        className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                      >
                        Save Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-1.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Organ</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                        {slide.organ}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Tissue Type</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                        {slide.tissueType}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Source</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                        {slide.sourceInstitution}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">License</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                        {slide.license}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Attribution</dt>
                      <dd className="text-slate-700 dark:text-slate-300 text-right">
                        {slide.attribution}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingMetadata(true)}
                        className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit Metadata
                      </button>
                      {slide.originalSourceUrl && (
                        <a
                          href={slide.originalSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <span>Original URL</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </dl>
                )}

                {/* Tags Editor */}
                <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Tags
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    {(slide.tags ?? []).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1">
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddTag} className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="Add tag..."
                      className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  </form>
                </div>

                {/* Custom Collections Membership */}
                {customCollections.length > 0 && (
                  <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Custom Collections
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {customCollections.map((col) => {
                        const checked = (slide.collectionIds ?? []).includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleSlideInCollection(slide.id, col.id)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>{col.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Offline Cache Action for Remote Imported Slides */}
                {isRemoteHttps && onCacheOfflineImage && (
                  <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={cachingOffline}
                      onClick={async () => {
                        setCachingOffline(true);
                        setCacheMessage(null);
                        try {
                          await onCacheOfflineImage(slide.id);
                          setCacheMessage('Cached locally in IndexedDB for offline study.');
                        } catch {
                          setCacheMessage('Could not cache remotely; stream mode remains active.');
                        } finally {
                          setCachingOffline(false);
                        }
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {cachingOffline ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      <span>{cachingOffline ? 'Caching...' : 'Cache Image Offline'}</span>
                    </button>
                    {cacheMessage && (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {cacheMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <hr className="my-5 border-slate-200 dark:border-slate-800" />

        {/* Section 2: Numbered Anatomical Pins */}
        <section aria-label="Numbered pin annotations">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-tight text-slate-500 dark:text-slate-400">
              Annotated Structures
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {totalPins} {totalPins === 1 ? 'pin' : 'pins'}
            </span>
          </div>

          {totalPins === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center dark:border-slate-800 dark:bg-[#0B0F17]">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                No pins placed on this slide yet
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Click anywhere on the slide canvas in the center viewer to drop Pin #1.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {slide.pins.map((pin) => {
                const isSelected = pin.id === selectedPinId;
                const isRevealed = !quizMode || revealedPinIds.has(pin.id);
                const isEditing = editingPinId === pin.id && isRevealed;
                const confidence = quizConfidence[pin.id] ?? 'unanswered';

                return (
                  <div
                    key={pin.id}
                    ref={(el) => {
                      pinCardRefs.current[pin.id] = el;
                    }}
                    className={`rounded-lg border transition-colors ${
                      isSelected
                        ? quizMode && !isRevealed
                          ? 'border-amber-400 bg-amber-50/60 dark:border-amber-500/60 dark:bg-amber-950/25'
                          : 'border-blue-500/60 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-950/25'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F17]/70 dark:hover:border-slate-700'
                    }`}
                  >
                    {!isRevealed ? (
                      <button
                        type="button"
                        onClick={() => {
                          onRevealPin(pin.id);
                          onSelectAndFocusPin(pin.id);
                        }}
                        className="flex w-full items-center justify-between gap-3 p-3 text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-semibold tabular-nums text-slate-950">
                            {pin.number}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              Pin #{pin.number} · Label & Notes Hidden
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              Recall structure, then click to reveal
                            </p>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      </button>
                    ) : isEditing ? (
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 font-mono text-xs font-semibold tabular-nums text-white">
                            {pin.number}
                          </span>
                          <input
                            ref={labelInputRef}
                            type="text"
                            value={pinLabelDraft}
                            onChange={(e) => setPinLabelDraft(e.target.value)}
                            placeholder="Structure name (e.g., Goblet Cell)"
                            aria-label={`Label for pin ${pin.number}`}
                            className="w-full rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <textarea
                          rows={3}
                          value={pinNotesDraft}
                          onChange={(e) => setPinNotesDraft(e.target.value)}
                          placeholder="Add cellular features, staining details, or clinical pearls..."
                          aria-label={`Study notes for pin ${pin.number}`}
                          className="mt-2 w-full rounded-md border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onDeletePin(slide.id, pin.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                            <span>Delete Pin</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingPinId(null)}
                              className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => savePinEdit(pin.id)}
                              className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectAndFocusPin(pin.id)}
                            className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                          >
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                              }`}
                            >
                              {pin.number}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold leading-snug text-slate-900 dark:text-slate-50">
                                {pin.label}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                                X {pin.x.toFixed(1)}% · Y {pin.y.toFixed(1)}%
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onSelectAndFocusPin(pin.id)}
                              title="Center slide on pin"
                              aria-label={`Center viewer on pin ${pin.number}`}
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-200/70 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                            >
                              <Crosshair className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingPin(pin)}
                              title="Edit pin label and notes"
                              aria-label={`Edit pin ${pin.number}`}
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePin(slide.id, pin.id)}
                              title="Delete pin"
                              aria-label={`Delete pin ${pin.number}`}
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="mt-2 pl-8.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {pin.notes || (
                            <span className="italic text-slate-400 dark:text-slate-500">
                              No study notes yet — click edit to add histological notes.
                            </span>
                          )}
                        </p>

                        {quizMode && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2 pl-8.5 dark:border-slate-800">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Self-check:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSetQuizConfidence(pin.id, 'recalled')}
                                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                  confidence === 'recalled'
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                Got it
                              </button>
                              <button
                                type="button"
                                onClick={() => onSetQuizConfidence(pin.id, 'review')}
                                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                  confidence === 'review'
                                    ? 'bg-amber-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                Review again
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{panelBody}</div>

      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm lg:hidden">
        <div
          className="fixed inset-0 bg-slate-950/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
        <div className="relative z-10 ml-auto flex h-full w-full max-w-sm shadow-2xl">
          {panelBody}
        </div>
      </div>
    </>
  );
};
