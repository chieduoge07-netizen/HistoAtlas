import {
  AnatomicalSystem,
  PracticalAttemptRecord,
  Slide,
  SlideStudyProgress,
} from '../types/histology';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function updateSlideProgressSM2(
  prev: SlideStudyProgress | undefined,
  attempt: PracticalAttemptRecord
): SlideStudyProgress {
  const prevEase = prev?.easeFactor ?? 2.5;
  const prevInterval = prev?.intervalDays ?? 0;
  const prevConsecutive = prev?.consecutiveCorrect ?? 0;
  const prevCorrect = prev?.correctCount ?? 0;
  const prevIncorrect = prev?.incorrectCount ?? 0;
  const prevAttemptCount = prev?.attemptCount ?? 0;
  const prevTotalTime = prev?.totalTimeTakenMs ?? 0;

  const failedOrUncertain = !attempt.correct || attempt.confidence === 'review';

  let consecutiveCorrect = prevConsecutive;
  let easeFactor = prevEase;
  let intervalDays = prevInterval;
  let nextReviewAt = attempt.timestamp;

  if (failedOrUncertain) {
    consecutiveCorrect = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, Number((prevEase - 0.2).toFixed(2)));
    // Missed slides return within 2 minutes / next review batch
    nextReviewAt = attempt.timestamp + 2 * MINUTE_MS;
  } else {
    consecutiveCorrect = prevConsecutive + 1;
    if (attempt.confidence === 'recalled') {
      easeFactor = Math.min(2.8, Math.max(1.3, Number((prevEase + 0.08).toFixed(2))));
    }
    if (consecutiveCorrect === 1) {
      intervalDays = 1;
    } else if (consecutiveCorrect === 2) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(4, Math.round(Math.max(3, prevInterval) * easeFactor));
    }
    nextReviewAt = attempt.timestamp + intervalDays * DAY_MS;
  }

  const missedStructureSet = new Set(prev?.missedStructures ?? []);
  const missedFeatureSet = new Set(prev?.missedFeatures ?? []);

  for (const q of attempt.questionResults) {
    if (!q.correct) {
      if (q.code === 'C' && q.targetLabel) {
        missedStructureSet.add(q.targetLabel);
      } else if ((q.code === 'E' || q.code === 'F') && q.targetLabel) {
        missedStructureSet.add(q.targetLabel);
      } else if (q.code === 'D' && q.expectedAnswer) {
        missedFeatureSet.add(q.expectedAnswer);
      }
    }
  }
  for (const feat of attempt.missedFeatures) {
    if (feat.trim()) missedFeatureSet.add(feat.trim());
  }

  return {
    slideId: attempt.slideId,
    correctCount: prevCorrect + (attempt.correct ? 1 : 0),
    incorrectCount: prevIncorrect + (attempt.correct ? 0 : 1),
    consecutiveCorrect,
    easeFactor,
    intervalDays,
    nextReviewAt,
    lastAttemptAt: attempt.timestamp,
    lastTimeTakenMs: attempt.timeTakenMs,
    totalTimeTakenMs: prevTotalTime + attempt.timeTakenMs,
    attemptCount: prevAttemptCount + 1,
    lastConfidence: attempt.confidence,
    missedStructures: Array.from(missedStructureSet).slice(0, 12),
    missedFeatures: Array.from(missedFeatureSet).slice(0, 12),
  };
}

export function recomputeSlideProgressFromAttempts(
  slideId: string,
  allAttempts: PracticalAttemptRecord[]
): SlideStudyProgress | undefined {
  const slideAttempts = allAttempts
    .filter((a) => a.slideId === slideId)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (slideAttempts.length === 0) return undefined;
  let progress: SlideStudyProgress | undefined;
  for (const att of slideAttempts) {
    progress = updateSlideProgressSM2(progress, att);
  }
  return progress;
}

export interface SpacedRepetitionItem {
  slide: Slide;
  progress?: SlideStudyProgress;
  status: 'overdue' | 'due-soon' | 'new' | 'mastered';
  priorityScore: number;
  accuracyPct: number | null;
}

export function getSpacedRepetitionQueue(
  slides: Slide[],
  progressMap: Record<string, SlideStudyProgress>,
  now = Date.now()
): SpacedRepetitionItem[] {
  const items: SpacedRepetitionItem[] = slides.map((slide) => {
    const progress = progressMap[slide.id];
    if (!progress || progress.attemptCount === 0) {
      return {
        slide,
        progress,
        status: 'new',
        priorityScore: 50,
        accuracyPct: null,
      };
    }

    const total = progress.correctCount + progress.incorrectCount;
    const accuracyPct = total > 0 ? Math.round((progress.correctCount / total) * 100) : null;
    const overdueMs = now - progress.nextReviewAt;
    const isFailedRecently = progress.consecutiveCorrect === 0 || progress.incorrectCount > progress.correctCount;

    let status: SpacedRepetitionItem['status'] = 'mastered';
    let priorityScore = 10;

    if (overdueMs >= 0 || isFailedRecently) {
      status = 'overdue';
      const missBias = progress.incorrectCount * 20 - progress.correctCount * 4;
      priorityScore = 100 + missBias + Math.min(40, Math.max(0, overdueMs / DAY_MS));
    } else if (progress.nextReviewAt - now <= DAY_MS) {
      status = 'due-soon';
      priorityScore = 65;
    } else {
      status = 'mastered';
      priorityScore = Math.max(1, 25 - progress.intervalDays);
    }

    return {
      slide,
      progress,
      status,
      priorityScore,
      accuracyPct,
    };
  });

  items.sort((a, b) => b.priorityScore - a.priorityScore);
  return items;
}

export interface DimensionStatRow {
  label: string;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracyPct: number;
  avgTimeMs: number;
}

export interface PerformanceAnalytics {
  totalAttempts: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallAccuracyPct: number;
  avgTimeMs: number;
  studiedSlideCount: number;
  dueNowCount: number;
  masteredCount: number;
  byTissue: DimensionStatRow[];
  byOrgan: DimensionStatRow[];
  bySystem: DimensionStatRow[];
  byStructure: DimensionStatRow[];
  byFeature: DimensionStatRow[];
  frequentlyMissedSlides: Array<{
    slide: Slide;
    progress: SlideStudyProgress;
    accuracyPct: number;
  }>;
}

function finalizeRows(
  buckets: Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>
): DimensionStatRow[] {
  const rows: DimensionStatRow[] = [];
  for (const [label, b] of buckets.entries()) {
    if (!label.trim() || b.attempts === 0) continue;
    rows.push({
      label,
      attempts: b.attempts,
      correct: b.correct,
      incorrect: b.incorrect,
      accuracyPct: Math.round((b.correct / b.attempts) * 100),
      avgTimeMs: Math.round(b.totalMs / b.attempts),
    });
  }
  // Weakest areas first (lowest accuracy, then most incorrect)
  rows.sort((a, b) => {
    if (a.accuracyPct !== b.accuracyPct) return a.accuracyPct - b.accuracyPct;
    return b.incorrect - a.incorrect;
  });
  return rows;
}

function addToBucket(
  buckets: Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>,
  key: string,
  isCorrect: boolean,
  timeMs: number
) {
  const clean = key.trim();
  if (!clean) return;
  const cur = buckets.get(clean) ?? { attempts: 0, correct: 0, incorrect: 0, totalMs: 0 };
  cur.attempts += 1;
  cur.correct += isCorrect ? 1 : 0;
  cur.incorrect += isCorrect ? 0 : 1;
  cur.totalMs += timeMs;
  buckets.set(clean, cur);
}

export function buildPerformanceAnalytics(
  slides: Slide[],
  progressMap: Record<string, SlideStudyProgress>,
  attempts: PracticalAttemptRecord[],
  now = Date.now()
): PerformanceAnalytics {
  const slideMap = new Map(slides.map((s) => [s.id, s]));

  const tissueMap = new Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>();
  const organMap = new Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>();
  const systemMap = new Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>();
  const structureMap = new Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>();
  const featureMap = new Map<string, { attempts: number; correct: number; incorrect: number; totalMs: number }>();

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalTimeMs = 0;

  for (const att of attempts) {
    if (att.correct) totalCorrect++;
    else totalIncorrect++;
    totalTimeMs += att.timeTakenMs;

    const slide = slideMap.get(att.slideId);
    const tissue = slide?.identification?.tissue || slide?.tissueType || att.tissue;
    const organ = slide?.identification?.organ || slide?.organ || att.organ;
    const system: AnatomicalSystem | string = slide?.anatomicalSystem || att.anatomicalSystem;

    addToBucket(tissueMap, tissue, att.correct, att.timeTakenMs);
    addToBucket(organMap, organ, att.correct, att.timeTakenMs);
    addToBucket(systemMap, system, att.correct, att.timeTakenMs);

    for (const q of att.questionResults) {
      if ((q.code === 'C' || q.code === 'E' || q.code === 'F') && q.targetLabel) {
        addToBucket(structureMap, q.targetLabel, q.correct, att.timeTakenMs);
      }
      if (q.code === 'D') {
        const featList = slide?.identification?.keyFeatures ?? slide?.expectedFeatures ?? [];
        if (featList.length > 0) {
          for (const feat of featList.slice(0, 3)) {
            addToBucket(featureMap, feat, q.correct, att.timeTakenMs);
          }
        } else if (q.expectedAnswer) {
          addToBucket(featureMap, q.expectedAnswer, q.correct, att.timeTakenMs);
        }
      }
    }
  }

  const studiedProgressList = Object.values(progressMap).filter((p) => p.attemptCount > 0);
  const dueNowCount = studiedProgressList.filter((p) => p.nextReviewAt <= now).length;
  const masteredCount = studiedProgressList.filter(
    (p) => p.consecutiveCorrect >= 2 && p.nextReviewAt > now
  ).length;

  const frequentlyMissedSlides: PerformanceAnalytics['frequentlyMissedSlides'] = [];
  for (const progress of studiedProgressList) {
    const slide = slideMap.get(progress.slideId);
    if (!slide) continue;
    const total = progress.correctCount + progress.incorrectCount;
    if (progress.incorrectCount > 0 && total > 0) {
      frequentlyMissedSlides.push({
        slide,
        progress,
        accuracyPct: Math.round((progress.correctCount / total) * 100),
      });
    }
  }

  frequentlyMissedSlides.sort((a, b) => {
    if (b.progress.incorrectCount !== a.progress.incorrectCount) {
      return b.progress.incorrectCount - a.progress.incorrectCount;
    }
    return a.accuracyPct - b.accuracyPct;
  });

  const totalAttempts = attempts.length;

  return {
    totalAttempts,
    totalCorrect,
    totalIncorrect,
    overallAccuracyPct:
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    avgTimeMs: totalAttempts > 0 ? Math.round(totalTimeMs / totalAttempts) : 0,
    studiedSlideCount: studiedProgressList.length,
    dueNowCount,
    masteredCount,
    byTissue: finalizeRows(tissueMap),
    byOrgan: finalizeRows(organMap),
    bySystem: finalizeRows(systemMap),
    byStructure: finalizeRows(structureMap),
    byFeature: finalizeRows(featureMap),
    frequentlyMissedSlides,
  };
}
