import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  GraduationCap,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { SYSTEM_SECTIONS } from '../data/histologyCatalog';
import {
  Pin,
  PracticalAttemptRecord,
  PracticalQuestionCode,
  PracticalQuestionEvaluation,
  QuizConfidence,
  Slide,
  SlideStudyProgress,
  ViewerToolMode,
} from '../types/histology';
import { getSpacedRepetitionQueue } from '../utils/spacedRepetition';
import { SlideViewer } from './SlideViewer';

interface PracticalExamViewProps {
  slides: Slide[];
  progressMap: Record<string, SlideStudyProgress>;
  initialQueueMode?: 'spaced' | 'random';
  initialSystemFilter?: string;
  onRecordAttempt: (attempt: PracticalAttemptRecord, replaceId?: string) => void;
  onOpenAudit?: () => void;
  onFlagSlideNeedsReview?: (slideId: string, needsReview: boolean) => void;
  onBackMobile?: () => void;
}

interface GeneratedQuestion {
  code: PracticalQuestionCode;
  prompt: string;
  placeholder: string;
  expectedAnswer: string;
  acceptedTargets: string[];
  targetPin?: Pin;
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatches(guess: string, targets: string[]): boolean {
  const g = normalizeText(guess);
  if (!g || g.length < 3) return false;
  const guessTokens = g
    .split(' ')
    .filter((t) => t.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'cells', 'cell'].includes(t));
  if (guessTokens.length === 0) return false;
  const targetHay = normalizeText(targets.join(' '));
  return guessTokens.some((tok) => targetHay.includes(tok));
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestionsForSlide(slide: Slide): {
  questions: GeneratedQuestion[];
  targetPin: Pin | null;
} {
  const organTarget = slide.identification?.organ || slide.organ;
  const tissueTarget = slide.identification?.tissue || slide.tissueType;

  const targetPin =
    slide.pins.length > 0
      ? slide.pins[Math.floor(Math.random() * slide.pins.length)]
      : null;

  const pool: GeneratedQuestion[] = [];

  if (organTarget && organTarget.trim()) {
    pool.push({
      code: 'A',
      prompt: 'A. Identify the organ.',
      placeholder: 'e.g., Trachea, Kidney, Liver, Cerebellum...',
      expectedAnswer: organTarget,
      acceptedTargets: [organTarget, slide.specimen, slide.title],
    });
  }

  if (tissueTarget && tissueTarget.trim()) {
    pool.push({
      code: 'B',
      prompt: 'B. Identify the primary tissue.',
      placeholder: 'e.g., Pseudostratified ciliated columnar epithelium...',
      expectedAnswer: tissueTarget,
      acceptedTargets: [tissueTarget, slide.chapter, slide.anatomicalSystem],
    });
  }

  if (targetPin) {
    pool.push({
      code: 'C',
      prompt: `C. Identify the numbered structure at Pin #${targetPin.number}.`,
      placeholder: `Structure at Pin #${targetPin.number}...`,
      expectedAnswer: targetPin.label,
      acceptedTargets: [targetPin.label, targetPin.notes],
      targetPin,
    });
  }

  const keyFeatures =
    slide.identification?.keyFeatures && slide.identification.keyFeatures.length > 0
      ? slide.identification.keyFeatures
      : slide.expectedFeatures && slide.expectedFeatures.length > 0
        ? slide.expectedFeatures
        : [];

  if (keyFeatures.length >= 1) {
    pool.push({
      code: 'D',
      prompt: 'D. State two histological features used to identify this specimen.',
      placeholder: 'List two key microscopic hallmarks...',
      expectedAnswer: keyFeatures.slice(0, 3).join(' · '),
      acceptedTargets: keyFeatures,
    });
  }

  const cells = slide.identification?.cellsToIdentify ?? [];
  const cellMatchingPin = slide.pins.find((p) =>
    /\b(cell|neuron|purkinje|hepatocyte|podocyte|enterocyte|adipocyte|chondrocyte|osteocyte|goblet|macrophage|lymphocyte|fibroblast|cardiomyocyte)\b/i.test(
      p.label
    )
  );
  if (cellMatchingPin || cells.length > 0) {
    const chosenPin = cellMatchingPin ?? targetPin ?? undefined;
    const expectedCell = cellMatchingPin ? cellMatchingPin.label : cells.join(' / ');
    pool.push({
      code: 'E',
      prompt: chosenPin
        ? `E. Identify the specific cell type (reference Pin #${chosenPin.number}).`
        : 'E. Identify a characteristic cell type present in this section.',
      placeholder: 'e.g., Goblet cell, Purkinje neuron, Hepatocyte...',
      expectedAnswer: expectedCell,
      acceptedTargets: cellMatchingPin ? [cellMatchingPin.label, ...cells] : cells,
      targetPin: chosenPin,
    });
  }

  if (targetPin && targetPin.notes && targetPin.notes.trim().length > 20) {
    pool.push({
      code: 'F',
      prompt: `F. State the primary histological function of Pin #${targetPin.number}.`,
      placeholder: 'Describe physiological role of the pointed structure...',
      expectedAnswer: targetPin.notes,
      acceptedTargets: [targetPin.notes, targetPin.label],
      targetPin,
    });
  }

  // Randomize question order while keeping up to 4 crisp prompts per specimen
  const randomized = shuffleArray(pool).slice(0, 4);
  return { questions: randomized, targetPin };
}

export const PracticalExamView: React.FC<PracticalExamViewProps> = ({
  slides,
  progressMap,
  initialQueueMode = 'spaced',
  initialSystemFilter = 'all',
  onRecordAttempt,
  onOpenAudit,
  onFlagSlideNeedsReview,
  onBackMobile,
}) => {
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);
  const [queueMode, setQueueMode] = useState<'spaced' | 'random'>(initialQueueMode);
  const [systemFilter, setSystemFilter] = useState<string>(initialSystemFilter);
  const [missedOnlyMode, setMissedOnlyMode] = useState(false);

  useEffect(() => {
    setQueueMode(initialQueueMode);
  }, [initialQueueMode]);

  useEffect(() => {
    if (initialSystemFilter) setSystemFilter(initialSystemFilter);
  }, [initialSystemFilter]);

  const verifiedCount = useMemo(
    () =>
      slides.filter(
        (s) =>
          (s.qualityStatus ?? 'needs-review') === 'verified' &&
          Boolean(s.imageUrl || s.highResUrl || s.thumbnailUrl)
      ).length,
    [slides]
  );

  const examPool = useMemo(() => {
    let pool = slides.filter((s) => {
      if (!s.imageUrl && !s.highResUrl && !s.thumbnailUrl) return false;
      const st = s.qualityStatus ?? 'needs-review';
      if (includeUnreviewed) {
        return st === 'verified' || st === 'needs-review';
      }
      return st === 'verified';
    });

    if (systemFilter !== 'all') {
      pool = pool.filter((s) => s.anatomicalSystem === systemFilter);
    }
    if (missedOnlyMode) {
      pool = pool.filter((s) => {
        const p = progressMap[s.id];
        return Boolean(p && p.incorrectCount > 0);
      });
    }

    if (queueMode === 'spaced') {
      return getSpacedRepetitionQueue(pool, progressMap).map((q) => q.slide);
    }
    return shuffleArray(pool);
  }, [slides, includeUnreviewed, systemFilter, missedOnlyMode, queueMode, progressMap]);

  const [activeSlideId, setActiveSlideId] = useState<string>(() => examPool[0]?.id ?? '');
  const [specimenHistory, setSpecimenHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);

  const activeSlide = useMemo(
    () => examPool.find((s) => s.id === activeSlideId) ?? examPool[0],
    [examPool, activeSlideId]
  );

  const [{ questions, targetPin }, setQuestionBundle] = useState<{
    questions: GeneratedQuestion[];
    targetPin: Pin | null;
  }>(() =>
    activeSlide ? buildQuestionsForSlide(activeSlide) : { questions: [], targetPin: null }
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<PracticalQuestionEvaluation[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptOutcome, setAttemptOutcome] = useState<'correct' | 'incorrect' | null>(null);
  const [confidence, setConfidence] = useState<QuizConfidence>('unanswered');
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  const [toolMode, setToolMode] = useState<ViewerToolMode>('pan');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ pinId: string; seq: number } | null>(null);

  // Mobile collapsible Answer Sheet & Session Summary
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<PracticalAttemptRecord[]>([]);

  // Per-specimen live stopwatch
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);

  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

  // Regenerate questions whenever activeSlide switches
  const initializeForSlide = (slide: Slide) => {
    const bundle = buildQuestionsForSlide(slide);
    setQuestionBundle(bundle);
    setAnswers({});
    setEvaluations([]);
    setShowHint(false);
    setSubmitted(false);
    setAttemptOutcome(null);
    setConfidence('unanswered');
    setCurrentAttemptId(null);
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setFinalTimeMs(0);

    const pinToFocus = bundle.questions.find((q) => q.targetPin)?.targetPin ?? bundle.targetPin;
    if (pinToFocus) {
      setSelectedPinId(pinToFocus.id);
      setFocusRequest((prev) => ({ pinId: pinToFocus.id, seq: (prev?.seq ?? 0) + 1 }));
    } else {
      setSelectedPinId(null);
      setFocusRequest(null);
    }
  };

  useEffect(() => {
    if (!activeSlide) return;
    initializeForSlide(activeSlide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlide?.id]);

  useEffect(() => {
    if (submitted || !activeSlide) return;
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [submitted, activeSlide?.id]);

  const navigateToSpecimen = (targetSlide: Slide, recordHistory = true) => {
    if (recordHistory && activeSlide && activeSlide.id !== targetSlide.id) {
      setSpecimenHistory((prev) => {
        const sliced = historyCursor >= 0 ? prev.slice(0, historyCursor + 1) : prev;
        const next = [...sliced, activeSlide.id];
        setHistoryCursor(next.length - 1);
        return next;
      });
    }
    setActiveSlideId(targetSlide.id);
    initializeForSlide(targetSlide);
  };

  const pickPreviousSpecimen = () => {
    if (specimenHistory.length === 0) return;
    const prevIdx = historyCursor >= 0 ? historyCursor : specimenHistory.length - 1;
    const prevId = specimenHistory[prevIdx];
    const found = examPool.find((s) => s.id === prevId) ?? slides.find((s) => s.id === prevId);
    if (!found) return;
    setHistoryCursor(prevIdx - 1);
    setActiveSlideId(found.id);
    initializeForSlide(found);
  };

  const pickNextSpecimen = () => {
    if (examPool.length === 0) return;
    if (queueMode === 'spaced') {
      const otherCandidates = examPool.filter((s) => s.id !== activeSlide?.id);
      const next = otherCandidates[0] ?? examPool[0];
      navigateToSpecimen(next, true);
      return;
    }

    let nextIdx = 0;
    if (examPool.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * examPool.length);
      } while (examPool[nextIdx]?.id === activeSlide?.id);
    }
    const chosen = examPool[nextIdx];
    if (chosen) {
      navigateToSpecimen(chosen, true);
    }
  };

  if (!activeSlide) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-8 text-center dark:bg-[#090C12]">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#111622]">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-50">
            No Verified Slides Match Current Practical Filter
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Practical Exam 2.0 tests only Verified specimens ({verifiedCount} currently verified). Approve additional slides in Slide Audit or clear filters.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {onOpenAudit && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Open Slide Quality Audit
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSystemFilter('all');
                setMissedOnlyMode(false);
              }}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Reset Practical Filters
            </button>
          </div>
        </div>
      </div>
    );
  }

  const persistAttemptSnapshot = (
    evals: PracticalQuestionEvaluation[],
    overallCorrect: boolean,
    conf: QuizConfidence,
    timeMs: number,
    existingAttemptId: string | null
  ) => {
    const attemptId =
      existingAttemptId ?? `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const passCount = evals.filter((e) => e.correct).length;
    const scorePercent = evals.length > 0 ? Math.round((passCount / evals.length) * 100) : 0;

    const missedFeatures = evals
      .filter((e) => !e.correct && e.code === 'D')
      .map((e) => e.expectedAnswer);

    const record: PracticalAttemptRecord = {
      id: attemptId,
      slideId: activeSlide.id,
      slideTitle: activeSlide.title,
      organ: activeSlide.identification?.organ || activeSlide.organ,
      tissue: activeSlide.identification?.tissue || activeSlide.tissueType,
      anatomicalSystem: activeSlide.anatomicalSystem,
      targetPinId: targetPin?.id,
      targetPinLabel: targetPin?.label,
      missedFeatures,
      correct: overallCorrect,
      scorePercent,
      confidence: conf,
      timeTakenMs: timeMs,
      questionResults: evals,
      timestamp: Date.now(),
    };

    setCurrentAttemptId(attemptId);
    setSessionAttempts((prev) =>
      existingAttemptId
        ? prev.map((a) => (a.id === existingAttemptId ? record : a))
        : [record, ...prev]
    );
    onRecordAttempt(record, existingAttemptId ?? undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted) return;

    const elapsedMs = Math.max(500, Date.now() - startTimeRef.current);
    setFinalTimeMs(elapsedMs);

    const evals: PracticalQuestionEvaluation[] = questions.map((q) => {
      const userAnswer = (answers[q.code] ?? '').trim();
      const matched = userAnswer ? fuzzyMatches(userAnswer, q.acceptedTargets) : false;
      return {
        code: q.code,
        prompt: q.prompt,
        userAnswer,
        expectedAnswer: q.expectedAnswer,
        correct: matched,
        targetLabel: q.targetPin?.label,
      };
    });

    const passCount = evals.filter((ev) => ev.correct).length;
    const overallCorrect = evals.length > 0 ? passCount >= Math.ceil(evals.length / 2) : false;
    const defaultConf: QuizConfidence = overallCorrect ? 'recalled' : 'review';

    setEvaluations(evals);
    setSubmitted(true);
    setAttemptOutcome(overallCorrect ? 'correct' : 'incorrect');
    setConfidence(defaultConf);

    setSessionStats((s) => ({
      correct: s.correct + (overallCorrect ? 1 : 0),
      incorrect: s.incorrect + (overallCorrect ? 0 : 1),
    }));

    if (!overallCorrect) {
      onFlagSlideNeedsReview?.(activeSlide.id, true);
    }

    persistAttemptSnapshot(evals, overallCorrect, defaultConf, elapsedMs, null);
  };

  const toggleQuestionResult = (code: PracticalQuestionCode) => {
    if (!submitted) return;
    const nextEvals = evaluations.map((ev) =>
      ev.code === code ? { ...ev, correct: !ev.correct } : ev
    );
    const passCount = nextEvals.filter((ev) => ev.correct).length;
    const nextOverall = passCount >= Math.ceil(nextEvals.length / 2);

    if (nextOverall !== (attemptOutcome === 'correct')) {
      setSessionStats((s) => ({
        correct: Math.max(0, s.correct + (nextOverall ? 1 : -1)),
        incorrect: Math.max(0, s.incorrect + (nextOverall ? -1 : 1)),
      }));
      setAttemptOutcome(nextOverall ? 'correct' : 'incorrect');
      onFlagSlideNeedsReview?.(activeSlide.id, !nextOverall);
    }
    setEvaluations(nextEvals);
    persistAttemptSnapshot(nextEvals, nextOverall, confidence, finalTimeMs, currentAttemptId);
  };

  const handleChangeConfidence = (nextConf: QuizConfidence) => {
    setConfidence(nextConf);
    if (!submitted) return;
    persistAttemptSnapshot(
      evaluations,
      attemptOutcome === 'correct',
      nextConf,
      finalTimeMs,
      currentAttemptId
    );
  };

  // Before submission show ONLY reference pins targeted by active questions (labels hidden!)
  const referencedPinIds = new Set(
    questions.map((q) => q.targetPin?.id).filter((id): id is string => Boolean(id))
  );

  const displayedSlide: Slide = submitted
    ? activeSlide
    : {
        ...activeSlide,
        pins: activeSlide.pins.filter((p) => referencedPinIds.has(p.id)),
      };

  const totalAttempts = sessionStats.correct + sessionStats.incorrect;
  const accuracy = totalAttempts > 0 ? Math.round((sessionStats.correct / totalAttempts) * 100) : 0;
  const slideProgress = progressMap[activeSlide.id];

  const avgSessionSec =
    sessionAttempts.length > 0
      ? Math.round(
          sessionAttempts.reduce((sum, a) => sum + a.timeTakenMs, 0) /
            sessionAttempts.length /
            1000
        )
      : 0;

  return (
    <div className="relative flex flex-1 flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-[#090C12]">
      {/* Center Practical Microscopy Viewport */}
      <SlideViewer
        slide={displayedSlide}
        selectedPinId={selectedPinId}
        quizMode={!submitted}
        revealedPinIds={submitted ? new Set(activeSlide.pins.map((p) => p.id)) : new Set()}
        toolMode={toolMode}
        onChangeToolMode={setToolMode}
        onDropPin={() => {}}
        onSelectPin={(id) => {
          setSelectedPinId(id);
          if (submitted) {
            setFocusRequest((prev) => ({ pinId: id, seq: (prev?.seq ?? 0) + 1 }));
          }
        }}
        focusRequest={focusRequest}
        onOpenSidebarMobile={() => setMobileSheetOpen(true)}
        onBackMobile={onBackMobile}
        onOpenMobileNotes={() => setMobileSheetOpen(true)}
        isRightPanelOpen={true}
        onToggleRightPanel={() => {}}
        hideHeaderMetadata={!submitted}
      />

      {/* Mobile Compact Bottom Trigger Bar when Answer Sheet is collapsed */}
      {!mobileSheetOpen && (
        <div className="z-30 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] backdrop-blur-md dark:border-slate-800 dark:bg-[#111622]/95 lg:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={specimenHistory.length === 0 || historyCursor < 0}
              onClick={pickPreviousSpecimen}
              aria-label="Previous specimen"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={pickNextSpecimen}
              aria-label="Next specimen"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-1 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
              {submitted ? `${Math.round(finalTimeMs / 1000)}s` : `${elapsedSec}s`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            className="flex min-h-[42px] items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm"
          >
            <ChevronUp className="h-4 w-4" />
            <span>
              {submitted ? 'View Results & Next' : `Answer Sheet (${questions.length})`}
            </span>
          </button>
        </div>
      )}

      {/* Practical Examination 2.0 Console (Desktop Side Panel + Mobile Slide-Up Sheet) */}
      <aside
        aria-label="Practical Exam 2.0 Console"
        className={`${
          mobileSheetOpen
            ? 'fixed inset-x-0 bottom-0 z-40 flex max-h-[82dvh] rounded-t-2xl border-t shadow-[0_-10px_36px_rgba(15,23,42,0.22)]'
            : 'hidden'
        } histo-scroll lg:static lg:flex lg:h-full w-full lg:max-w-md shrink-0 flex-col overflow-y-auto border-slate-200 lg:border-l bg-white p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:pb-5 text-slate-900 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100`}
      >
        {/* Header & Timer */}
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GraduationCap className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                Practical Exam 2.0
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs tabular-nums text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{submitted ? `${Math.round(finalTimeMs / 1000)}s` : `${elapsedSec}s`}</span>
              </span>

              <button
                type="button"
                disabled={specimenHistory.length === 0 || historyCursor < 0}
                onClick={pickPreviousSpecimen}
                title="Previous specimen"
                aria-label="Previous specimen"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={pickNextSpecimen}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Skip</span>
              </button>

              {totalAttempts > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(true)}
                  className="flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-950"
                >
                  <Award className="h-3.5 w-3.5" />
                  <span>Score</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Collapse answer sheet to view slide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Session Score & Verified Pool Summary */}
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-[#0B0F17]">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Session Pass</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {sessionStats.correct}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Missed</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {sessionStats.incorrect}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Accuracy</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {accuracy}%
              </p>
            </div>
          </div>

          {/* Pool & Scheduling Controls */}
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQueueMode('spaced')}
                className={`flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  queueMode === 'spaced'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>Spaced Repetition</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueMode('random')}
                className={`flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  queueMode === 'random'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <RefreshCw className="h-3 w-3" />
                <span>Randomize Pool</span>
              </button>
            </div>

            <select
              aria-label="Filter practical exam by anatomical system"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-200"
            >
              <option value="all">Verified Pool: All Systems ({verifiedCount} verified)</option>
              {SYSTEM_SECTIONS.map((sec) => {
                const count = slides.filter(
                  (s) =>
                    s.anatomicalSystem === sec.system &&
                    (includeUnreviewed
                      ? ['verified', 'needs-review'].includes(s.qualityStatus ?? 'needs-review')
                      : (s.qualityStatus ?? 'needs-review') === 'verified')
                ).length;
                if (count === 0) return null;
                return (
                  <option key={sec.code} value={sec.system}>
                    {sec.code}. {sec.system} ({count})
                  </option>
                );
              })}
            </select>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnreviewed}
                  onChange={(e) => setIncludeUnreviewed(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Include unreviewed slides</span>
              </label>

              <button
                type="button"
                onClick={() => setMissedOnlyMode((m) => !m)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                  missedOnlyMode
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Missed Only</span>
              </button>
            </div>
          </div>
        </div>

        {/* Randomized Practical Questions Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          {slideProgress && (
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Prior record: {slideProgress.correctCount}/{slideProgress.attemptCount} correct ·
              Interval {slideProgress.intervalDays}d
            </p>
          )}

          {questions.map((q) => (
            <div key={q.code}>
              <label
                htmlFor={`practical-q-${q.code}`}
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {q.prompt}
              </label>
              {q.code === 'D' || q.code === 'F' ? (
                <textarea
                  id={`practical-q-${q.code}`}
                  rows={2}
                  disabled={submitted}
                  value={answers[q.code] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.code]: e.target.value }))
                  }
                  placeholder={q.placeholder}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                />
              ) : (
                <input
                  id={`practical-q-${q.code}`}
                  type="text"
                  disabled={submitted}
                  value={answers[q.code] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.code]: e.target.value }))
                  }
                  placeholder={q.placeholder}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                />
              )}
            </div>
          ))}

          {!submitted && (
            <>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowHint((h) => !h)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{showHint ? 'Hide Stain Hint' : 'Show Stain & Mag Hint'}</span>
                </button>
              </div>

              {showHint && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-300">
                  Stain: <span className="font-medium">{activeSlide.stain}</span> · Magnification:{' '}
                  <span className="font-mono">{activeSlide.magnification}</span>
                </div>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span>Submit Answers & Reveal Specimen</span>
              </button>
            </>
          )}
        </form>

        {/* Answer Reveal, Per-Question Grading, Confidence & Reference Details */}
        {submitted && (
          <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                attemptOutcome === 'correct'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
              }`}
            >
              <span className="flex items-center gap-2">
                {attemptOutcome === 'correct' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {attemptOutcome === 'correct'
                    ? 'Passed Specimen'
                    : 'Missed Specimen — Scheduled for Early Return'}
                </span>
              </span>
              <span className="font-mono text-[11px] tabular-nums">
                {Math.round(finalTimeMs / 1000)}s
              </span>
            </div>

            {/* Confidence Feedback (drives SM-2 interval) */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#0B0F17]">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Recall Confidence:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChangeConfidence('recalled')}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    confidence === 'recalled'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Confident
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeConfidence('review')}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    confidence === 'review'
                      ? 'bg-amber-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Return Soon
                </button>
              </div>
            </div>

            {/* Per-Question Verification with Self-Grade Toggle */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Question Breakdown (Click status to self-grade)
              </p>
              {evaluations.map((ev) => (
                <div
                  key={ev.code}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-[#0B0F17]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{ev.prompt}</p>
                    <button
                      type="button"
                      onClick={() => toggleQuestionResult(ev.code)}
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                        ev.correct
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {ev.correct ? 'Correct' : 'Missed'}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Your answer: <span className="text-slate-800 dark:text-slate-200">{ev.userAnswer || '—'}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Expected: <span className="font-medium text-blue-700 dark:text-blue-300">{ev.expectedAnswer}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Revealed Specimen Summary & Reference Pins */}
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {activeSlide.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {activeSlide.anatomicalSystem} · {activeSlide.stain} · {activeSlide.magnification}
              </p>

              {activeSlide.pins.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {activeSlide.pins.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPinId(p.id);
                          setFocusRequest((prev) => ({
                            pinId: p.id,
                            seq: (prev?.seq ?? 0) + 1,
                          }));
                        }}
                        className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left text-xs hover:border-blue-400 dark:border-slate-800 dark:bg-[#0B0F17]"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 font-mono text-[11px] font-semibold text-white">
                          {p.number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {p.label}
                          </p>
                          {p.notes && (
                            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                              {p.notes}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={pickNextSpecimen}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Next Practical Specimen</span>
            </button>
          </div>
        )}
      </aside>

      {/* Final Session Score & Missed Summary Modal */}
      {showSummaryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Practical Exam Session Summary"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Practical Exam Score Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                aria-label="Close score summary"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="histo-scroll flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-[#0B0F17]">
                <div>
                  <p className="text-[11px] text-slate-500">Passed</p>
                  <p className="font-mono text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {sessionStats.correct}/{totalAttempts}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Accuracy</p>
                  <p className="font-mono text-base font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {accuracy}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Avg Time</p>
                  <p className="font-mono text-base font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {avgSessionSec}s
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Specimens Tested This Session ({sessionAttempts.length})
                </h4>
                <ul className="space-y-2">
                  {sessionAttempts.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-[#0B0F17]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {att.slideTitle}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {att.organ} · {Math.round(att.timeTakenMs / 1000)}s
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          att.correct
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {att.scorePercent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="min-h-[42px] w-full rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Continue Practical
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
