import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Clock,
  GraduationCap,
  Layers,
  Microscope,
  Play,
  RotateCcw,
  Search,
  Target,
} from 'lucide-react';
import {
  PracticalAttemptRecord,
  Slide,
  SlideStudyProgress,
} from '../types/histology';
import {
  buildPerformanceAnalytics,
  DimensionStatRow,
  getSpacedRepetitionQueue,
} from '../utils/spacedRepetition';

interface PerformanceDashboardViewProps {
  slides: Slide[];
  progressMap: Record<string, SlideStudyProgress>;
  attempts: PracticalAttemptRecord[];
  onStartSpacedReview: (mode: 'spaced' | 'random', systemFilter?: string) => void;
  onOpenSlideInViewer: (slideId: string) => void;
  onResetPerformance: () => void;
}

type BreakdownDimension = 'tissue' | 'organ' | 'system' | 'structure' | 'feature';

function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function formatDueRelative(nextReviewAt: number, now: number): string {
  const diff = nextReviewAt - now;
  if (diff <= 0) return 'Due now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.round(diff / 3_600_000);
  if (hrs < 24) return `In ${hrs}h`;
  const days = Math.round(diff / 86_400_000);
  return `In ${days}d`;
}

export const PerformanceDashboardView: React.FC<PerformanceDashboardViewProps> = ({
  slides,
  progressMap,
  attempts,
  onStartSpacedReview,
  onOpenSlideInViewer,
  onResetPerformance,
}) => {
  const [activeDim, setActiveDim] = useState<BreakdownDimension>('tissue');
  const [queueFilter, setQueueFilter] = useState<'due-and-missed' | 'verified' | 'all'>('due-and-missed');
  const [queueSearch, setQueueSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const now = Date.now();
  const analytics = useMemo(
    () => buildPerformanceAnalytics(slides, progressMap, attempts, now),
    [slides, progressMap, attempts, now]
  );

  const verifiedSlides = useMemo(
    () => slides.filter((s) => (s.qualityStatus ?? 'needs-review') === 'verified'),
    [slides]
  );

  const fullQueue = useMemo(() => {
    const pool =
      queueFilter === 'verified'
        ? verifiedSlides
        : slides;
    const queue = getSpacedRepetitionQueue(pool, progressMap, now);
    const q = queueSearch.trim().toLowerCase();
    return queue.filter((item) => {
      if (queueFilter === 'due-and-missed') {
        const isDueOrMissed =
          item.status === 'overdue' ||
          item.status === 'due-soon' ||
          (item.progress && item.progress.incorrectCount > 0);
        if (!isDueOrMissed) return false;
      }
      if (!q) return true;
      const hay = `${item.slide.title} ${item.slide.organ} ${item.slide.tissueType} ${item.slide.anatomicalSystem}`.toLowerCase();
      return hay.includes(q);
    });
  }, [slides, verifiedSlides, progressMap, queueFilter, queueSearch, now]);

  const activeRows: DimensionStatRow[] = useMemo(() => {
    switch (activeDim) {
      case 'tissue':
        return analytics.byTissue;
      case 'organ':
        return analytics.byOrgan;
      case 'system':
        return analytics.bySystem;
      case 'structure':
        return analytics.byStructure;
      case 'feature':
        return analytics.byFeature;
    }
  }, [activeDim, analytics]);

  return (
    <div className="histo-scroll flex-1 overflow-y-auto bg-slate-50 px-4 py-6 text-slate-900 dark:bg-[#090C12] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Performance Tracking & Spaced Repetition
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Personal recall accuracy, weak anatomical areas, and adaptive review scheduling persisted locally in IndexedDB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onStartSpacedReview('spaced')}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start Spaced Repetition ({verifiedSlides.length} verified)</span>
            </button>

            {attempts.length > 0 && (
              confirmReset ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs dark:border-rose-800 dark:bg-rose-950/40">
                  <button
                    type="button"
                    onClick={() => {
                      onResetPerformance();
                      setConfirmReset(false);
                    }}
                    className="font-semibold text-rose-700 dark:text-rose-300"
                  >
                    Confirm Clear History
                  </button>
                  <span className="text-slate-400">/</span>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset History</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Practical Attempts
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {analytics.totalAttempts}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
              {analytics.studiedSlideCount} distinct slides
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Overall Accuracy
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {analytics.totalAttempts > 0 ? `${analytics.overallAccuracyPct}%` : '—'}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
              {analytics.totalCorrect} correct · {analytics.totalIncorrect} missed
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Avg Response Time
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatDurationMs(analytics.avgTimeMs)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">Per practical specimen</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Due for Review
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {analytics.dueNowCount}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">Missed or scheduled due</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Mastered Slides
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {analytics.masteredCount}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">2+ consecutive recalls</p>
          </div>
        </div>

        {/* Weak-Area Breakdown + Frequently Missed */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Multi-Dimensional Weak Area Analytics (2 cols) */}
          <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111622] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Weak Areas Breakdown (Lowest Accuracy First)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'tissue', label: 'Tissue' },
                    { id: 'organ', label: 'Organ' },
                    { id: 'system', label: 'System' },
                    { id: 'structure', label: 'Structure' },
                    { id: 'feature', label: 'Feature' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDim(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      activeDim === tab.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeRows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="h-9 w-9 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  No practical attempt history recorded for this dimension yet
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Complete specimens in Practical Exam 2.0 to track weak tissues, organs, structures, and features.
                </p>
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2 pr-3">{activeDim.toUpperCase()}</th>
                      <th className="py-2 px-2 text-right">Attempts</th>
                      <th className="py-2 px-2 text-right">Missed</th>
                      <th className="py-2 px-2 text-right">Avg Time</th>
                      <th className="py-2 pl-3 text-right w-36">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {activeRows.slice(0, 15).map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1">{row.label}</span>
                            {activeDim === 'system' && row.accuracyPct < 75 && (
                              <button
                                type="button"
                                onClick={() => onStartSpacedReview('spaced', row.label)}
                                className="shrink-0 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Drill
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {row.attempts}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          {row.incorrect}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500">
                          {formatDurationMs(row.avgTimeMs)}
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                style={{ width: `${row.accuracyPct}%` }}
                                className={`h-full rounded-full ${
                                  row.accuracyPct >= 80
                                    ? 'bg-emerald-500'
                                    : row.accuracyPct >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                }`}
                              />
                            </div>
                            <span className="w-9 text-right font-mono text-[11px] font-semibold tabular-nums">
                              {row.accuracyPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Frequently Missed Slides (1 col) */}
          <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <Target className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Frequently Missed Slides
              </h2>
            </div>

            {analytics.frequentlyMissedSlides.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  No missed specimens recorded yet
                </p>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {analytics.frequentlyMissedSlides.slice(0, 8).map(({ slide, progress, accuracyPct }) => (
                  <li
                    key={slide.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-[#0B0F17]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSlideInViewer(slide.id)}
                        className="text-left text-xs font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {slide.title}
                      </button>
                      <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {progress.incorrectCount} missed
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {slide.organ} · {slide.tissueType} · {accuracyPct}% accuracy
                    </p>
                    {progress.missedStructures.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        Missed structures: {progress.missedStructures.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Spaced Repetition Queue + Manual Review All Slides */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111622]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Spaced Repetition Review Queue & Manual Library Review
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Missed slides return immediately; repeatedly recalled slides expand intervals (1d → 3d → 7d+). You can also manually inspect any slide below anytime.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Filter queue..."
                  className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs dark:border-slate-700 dark:bg-[#0B0F17]"
                />
              </div>

              <select
                aria-label="Queue view filter"
                value={queueFilter}
                onChange={(e) =>
                  setQueueFilter(e.target.value as 'due-and-missed' | 'verified' | 'all')
                }
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-[#0B0F17]"
              >
                <option value="due-and-missed">Due & Frequently Missed</option>
                <option value="verified">All Verified Slides ({verifiedSlides.length})</option>
                <option value="all">Manual Review: All Slides ({slides.length})</option>
              </select>
            </div>
          </div>

          {fullQueue.length === 0 ? (
            <div className="py-10 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                No slides currently due in this filter
              </p>
              <button
                type="button"
                onClick={() => setQueueFilter('verified')}
                className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Show all verified slides or switch to Manual Review: All Slides
              </button>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 pr-3">Slide / Specimen</th>
                    <th className="py-2 px-2">Organ · System</th>
                    <th className="py-2 px-2">Quality</th>
                    <th className="py-2 px-2 text-right">Record</th>
                    <th className="py-2 px-2 text-right">Interval</th>
                    <th className="py-2 px-2 text-right">Next Review</th>
                    <th className="py-2 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {fullQueue.slice(0, 50).map((item) => (
                    <tr key={item.slide.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.slide.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.slide.tissueType} · {item.slide.stain}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                        {item.slide.organ} · {item.slide.anatomicalSystem}
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-400">
                        {item.slide.qualityStatus ?? 'needs-review'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.progress
                          ? `${item.progress.correctCount}/${item.progress.attemptCount} (${item.accuracyPct}%)`
                          : 'Unstudied'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500">
                        {item.progress ? `${item.progress.intervalDays}d` : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] tabular-nums">
                        <span
                          className={
                            item.status === 'overdue'
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : item.status === 'due-soon'
                                ? 'font-semibold text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {item.progress ? formatDueRelative(item.progress.nextReviewAt, now) : 'Ready'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenSlideInViewer(item.slide.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Microscope className="h-3 w-3" aria-hidden="true" />
                          <span>Study</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fullQueue.length > 50 && (
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Showing top 50 of {fullQueue.length} matching slides. Use the filter box above to narrow further.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
