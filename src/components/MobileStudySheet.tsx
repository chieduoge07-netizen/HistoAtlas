import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomCollection,
  Pin,
  QuizConfidence,
  Slide,
  SlideQualityStatus,
} from '../types/histology';
import { QUALITY_STATUS_OPTIONS } from '../utils/slideAudit';
import { IdentificationEditor } from './IdentificationEditor';

export type MobileSheetTab = 'notes' | 'pins' | 'info' | 'features' | 'clinical' | 'quiz';
export type MobileSheetHeight = 'closed' | 'half' | 'full';

interface MobileStudySheetProps {
  slide: Slide;
  sheetHeight: MobileSheetHeight;
  onChangeHeight: (h: MobileSheetHeight) => void;
  activeTab: MobileSheetTab;
  onChangeTab: (t: MobileSheetTab) => void;
  selectedPinId: string | null;
  newlyDroppedPinId: string | null;
  onClearNewPinFlag: () => void;
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
  onUpdatePin: (slideId: string, pinId: string, updates: { label?: string; notes?: string }) => void;
  onDeletePin: (slideId: string, pinId: string) => void;
  customCollections: CustomCollection[];
  onToggleSlideInCollection: (slideId: string, collectionId: string) => void;
  offlineVariant?: 'thumb' | 'full';
  onCacheOfflineImage?: (slideId: string) => Promise<void>;
}

export const MobileStudySheet: React.FC<MobileStudySheetProps> = ({
  slide,
  sheetHeight,
  onChangeHeight,
  activeTab,
  onChangeTab,
  selectedPinId,
  newlyDroppedPinId,
  onClearNewPinFlag,
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
  onUpdatePin,
  onDeletePin,
  customCollections,
  onToggleSlideInCollection,
  offlineVariant,
  onCacheOfflineImage,
}) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(slide.overviewNotes);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinLabelDraft, setPinLabelDraft] = useState('');
  const [pinNotesDraft, setPinNotesDraft] = useState('');
  const [cachingNow, setCachingNow] = useState(false);

  useEffect(() => {
    setEditingNotes(false);
    setNotesDraft(slide.overviewNotes);
    setEditingPinId(null);
  }, [slide.id, slide.overviewNotes]);

  useEffect(() => {
    if (!newlyDroppedPinId) return;
    const pin = slide.pins.find((p) => p.id === newlyDroppedPinId);
    if (!pin) return;
    onChangeTab('pins');
    setEditingPinId(pin.id);
    setPinLabelDraft(pin.label);
    setPinNotesDraft(pin.notes);
    onClearNewPinFlag();
  }, [newlyDroppedPinId, slide.pins, onClearNewPinFlag, onChangeTab]);

  if (sheetHeight === 'closed') return null;

  const heightClass = sheetHeight === 'full' ? 'h-[86dvh]' : 'h-[47dvh]';
  const totalPins = slide.pins.length;
  const revealedCount = slide.pins.filter((p) => revealedPinIds.has(p.id)).length;
  const recalledCount = slide.pins.filter((p) => quizConfidence[p.id] === 'recalled').length;

  const activeQuizPin: Pin | undefined =
    slide.pins.find((p) => p.id === selectedPinId) ?? slide.pins[0];
  const isQuizPinRevealed = activeQuizPin ? revealedPinIds.has(activeQuizPin.id) : false;

  const tabs: Array<{ id: MobileSheetTab; label: string }> = [
    { id: 'notes', label: 'Notes' },
    { id: 'pins', label: `Pins (${totalPins})` },
    { id: 'info', label: 'Slide Info' },
    { id: 'features', label: 'Features' },
    { id: 'clinical', label: 'Clinical' },
    { id: 'quiz', label: 'Quiz' },
  ];

  const startEditPin = (pin: Pin) => {
    setEditingPinId(pin.id);
    setPinLabelDraft(pin.label);
    setPinNotesDraft(pin.notes);
  };

  return (
    <section
      aria-label="Mobile Study Notes Sheet"
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-10px_32px_rgba(15,23,42,0.18)] transition-[height] duration-200 dark:border-slate-700 dark:bg-[#111622] lg:hidden ${heightClass}`}
    >
      {/* Grabber & Sheet Controls */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onChangeHeight(sheetHeight === 'half' ? 'full' : 'half')}
          className="flex min-h-[36px] items-center gap-2 text-left min-w-0 flex-1"
        >
          {sheetHeight === 'full' ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
            {slide.title}
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={quizMode}
            onClick={() => {
              onToggleQuizMode();
              if (!quizMode) onChangeTab('quiz');
            }}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
              quizMode
                ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Quiz</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeHeight('closed')}
            aria-label="Minimize notes sheet"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Section Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[36px] shrink-0 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Content */}
      <div className="histo-scroll flex-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* TAB 1: Study Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSlideMetadata(slide.id, { needsReview: !slide.needsReview })
                  }
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
                    slide.needsReview
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{slide.needsReview ? 'Flagged' : 'Flag Review'}</span>
                </button>
              </div>

              {!editingNotes && (!quizMode || revealedSlideSummary) && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(slide.overviewNotes);
                    setEditingNotes(true);
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Notes</span>
                </button>
              )}
            </div>

            {quizMode && !revealedSlideSummary ? (
              <button
                type="button"
                onClick={onRevealSlideSummary}
                className="flex min-h-[56px] w-full items-center justify-between rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <span>Slide overview hidden in Quiz Mode</span>
                <span>Tap to reveal</span>
              </button>
            ) : editingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="w-full rounded-xl border border-blue-400 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-[#0B0F17] dark:text-slate-100"
                  placeholder="Write histological overview and study notes..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingNotes(false)}
                    className="h-10 rounded-lg px-4 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSlideNotes(slide.id, notesDraft.trim());
                      setEditingNotes(false);
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {slide.overviewNotes || 'No overview notes yet. Tap Edit Notes to add your study notes.'}
              </p>
            )}
          </div>
        )}

        {/* TAB 2: Pin Identification */}
        {activeTab === 'pins' && (
          <div className="space-y-2.5">
            {slide.pins.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Switch to Pin tool in the viewer and tap the micrograph to drop Pin #1.
              </div>
            ) : (
              slide.pins.map((pin) => {
                const isSelected = pin.id === selectedPinId;
                const isRevealed = !quizMode || revealedPinIds.has(pin.id);
                const isEditing = editingPinId === pin.id && isRevealed;

                return (
                  <div
                    key={pin.id}
                    className={`rounded-xl border p-3 ${
                      isSelected
                        ? 'border-blue-500/60 bg-blue-50/40 dark:border-blue-500/50 dark:bg-blue-950/20'
                        : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-[#0B0F17]'
                    }`}
                  >
                    {!isRevealed ? (
                      <button
                        type="button"
                        onClick={() => {
                          onRevealPin(pin.id);
                          onSelectAndFocusPin(pin.id);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 font-mono text-xs font-semibold text-slate-950">
                            {pin.number}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Pin #{pin.number} · Tap to reveal
                          </span>
                        </span>
                        <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </button>
                    ) : isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={pinLabelDraft}
                          onChange={(e) => setPinLabelDraft(e.target.value)}
                          placeholder="Structure name"
                          className="min-h-[40px] w-full rounded-lg border border-blue-400 bg-white px-3 text-sm font-semibold dark:border-blue-500 dark:bg-slate-900"
                        />
                        <textarea
                          rows={3}
                          value={pinNotesDraft}
                          onChange={(e) => setPinNotesDraft(e.target.value)}
                          placeholder="Add cellular features & notes..."
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePin(slide.id, pin.id);
                              setEditingPinId(null);
                            }}
                            className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPinId(null)}
                              className="h-9 rounded-lg px-3 text-xs text-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdatePin(slide.id, pin.id, {
                                  label: pinLabelDraft.trim() || `Structure #${pin.number}`,
                                  notes: pinNotesDraft.trim(),
                                });
                                setEditingPinId(null);
                              }}
                              className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectAndFocusPin(pin.id)}
                            className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 font-mono text-xs font-semibold text-white">
                              {pin.number}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {pin.label}
                              </p>
                              <p className="font-mono text-[10px] tabular-nums text-slate-400">
                                X {pin.x.toFixed(1)}% · Y {pin.y.toFixed(1)}%
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onSelectAndFocusPin(pin.id)}
                              aria-label="Center on pin"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                            >
                              <Crosshair className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditPin(pin)}
                              aria-label="Edit pin"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {pin.notes && (
                          <p className="mt-2 pl-9 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {pin.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: Slide Info & Offline */}
        {activeTab === 'info' && (
          <div className="space-y-3 text-xs">
            <dl className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0B0F17]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Organ</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{slide.organ}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Tissue</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{slide.tissueType}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Stain</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{slide.stain}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Magnification</dt>
                <dd className="font-mono font-medium text-slate-900 dark:text-slate-100 text-right">{slide.magnification}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Source</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{slide.sourceInstitution}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">License</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{slide.license}</dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Quality Status
              </span>
              <select
                value={slide.qualityStatus ?? 'needs-review'}
                onChange={(e) =>
                  onUpdateSlideMetadata(slide.id, {
                    qualityStatus: e.target.value as SlideQualityStatus,
                    lastAuditedAt: Date.now(),
                  })
                }
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {QUALITY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {customCollections.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">My Collections</p>
                {customCollections.map((col) => {
                  const checked = (slide.collectionIds ?? []).includes(col.id);
                  return (
                    <label key={col.id} className="flex min-h-[32px] items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSlideInCollection(slide.id, col.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span>{col.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {onCacheOfflineImage && slide.imageUrl.startsWith('https://') && (
                <button
                  type="button"
                  disabled={cachingNow}
                  onClick={async () => {
                    setCachingNow(true);
                    try {
                      await onCacheOfflineImage(slide.id);
                    } finally {
                      setCachingNow(false);
                    }
                  }}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {cachingNow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : offlineVariant === 'full' ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>
                    {offlineVariant === 'full'
                      ? 'Saved Full-Res Offline'
                      : offlineVariant === 'thumb'
                        ? 'Upgrade Offline Copy'
                        : 'Save Offline'}
                  </span>
                </button>
              )}

              {slide.originalSourceUrl && (
                <a
                  href={slide.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 font-medium text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Source</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Histological Features */}
        {activeTab === 'features' && (
          <IdentificationEditor
            identification={slide.identification}
            fallbackOrgan={slide.organ}
            fallbackTissue={slide.tissueType}
            quizHidden={quizMode && !revealedSlideSummary}
            onRevealQuiz={onRevealSlideSummary}
            compact
            onSave={(nextId) => onUpdateSlideMetadata(slide.id, { identification: nextId })}
          />
        )}

        {/* TAB 5: Clinical Correlations & Exam Questions */}
        {activeTab === 'clinical' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#0B0F17]">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                Clinical Correlation
              </h3>
              <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                {slide.identification?.clinicalRelevance ||
                  'No clinical correlation added yet. Open Features tab to record verified clinical notes.'}
              </p>
            </div>

            {slide.identification?.differentialIdentification && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#0B0F17]">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  Differential Identification
                </h3>
                <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                  {slide.identification.differentialIdentification}
                </p>
              </div>
            )}

            {slide.identification?.commonExamQuestions &&
              slide.identification.commonExamQuestions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#0B0F17]">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Common Practical Questions
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                    {slide.identification.commonExamQuestions.map((q, idx) => (
                      <li key={idx}>
                        {idx + 1}. {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}

        {/* TAB 6: One-Handed Mobile Quiz Mode */}
        {activeTab === 'quiz' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-950/25">
              <span className="font-mono tabular-nums font-medium text-amber-900 dark:text-amber-200">
                {revealedCount}/{totalPins} revealed · {recalledCount} got it
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onHideAllQuiz}
                  className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={onRevealAllQuiz}
                  className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Reveal All</span>
                </button>
              </div>
            </div>

            {totalPins === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
                This slide has no pins yet. Drop numbered pins on structures to quiz yourself.
              </p>
            ) : (
              <>
                {/* Numbered Pin Selector Row */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {slide.pins.map((p) => {
                    const selected = activeQuizPin?.id === p.id;
                    const conf = quizConfidence[p.id];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectAndFocusPin(p.id)}
                        className={`flex h-11 min-w-[44px] items-center justify-center rounded-xl border px-3 font-mono text-xs font-semibold tabular-nums transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : conf === 'recalled'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : conf === 'review'
                                ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        #{p.number}
                      </button>
                    );
                  })}
                </div>

                {activeQuizPin && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#0B0F17] space-y-3">
                    {!isQuizPinRevealed ? (
                      <button
                        type="button"
                        onClick={() => onRevealPin(activeQuizPin.id)}
                        className="flex min-h-[64px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-amber-400 bg-amber-50/80 px-4 py-3 text-center dark:border-amber-500/50 dark:bg-amber-950/30"
                      >
                        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          Tap to Reveal Pin #{activeQuizPin.number}
                        </span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                          Recall the anatomical structure before checking
                        </span>
                      </button>
                    ) : (
                      <>
                        <div>
                          <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            Pin #{activeQuizPin.number}
                          </p>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {activeQuizPin.label}
                          </h4>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {activeQuizPin.notes || 'No notes saved for this structure.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => onSetQuizConfidence(activeQuizPin.id, 'recalled')}
                            className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
                              quizConfidence[activeQuizPin.id] === 'recalled'
                                ? 'bg-emerald-600 text-white'
                                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                            }`}
                          >
                            <Check className="h-4 w-4" />
                            <span>Got It</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSetQuizConfidence(activeQuizPin.id, 'review')}
                            className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
                              quizConfidence[activeQuizPin.id] === 'review'
                                ? 'bg-rose-600 text-white'
                                : 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                            }`}
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Missed It</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
