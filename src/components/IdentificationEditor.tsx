import React, { useEffect, useState } from 'react';
import { Check, EyeOff, FileText, Pencil } from 'lucide-react';
import { SlideIdentification } from '../types/histology';

interface IdentificationEditorProps {
  identification?: SlideIdentification;
  fallbackOrgan?: string;
  fallbackTissue?: string;
  onSave: (next: SlideIdentification) => void;
  quizHidden?: boolean;
  onRevealQuiz?: () => void;
  defaultEditing?: boolean;
  compact?: boolean;
}

function listToLines(arr?: string[]): string {
  return (arr ?? []).join('\n');
}

function linesToList(val: string): string[] {
  return val
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const IdentificationEditor: React.FC<IdentificationEditorProps> = ({
  identification,
  fallbackOrgan = '',
  fallbackTissue = '',
  onSave,
  quizHidden = false,
  onRevealQuiz,
  defaultEditing = false,
  compact = false,
}) => {
  const [editing, setEditing] = useState(defaultEditing);
  const [organ, setOrgan] = useState(identification?.organ ?? '');
  const [tissue, setTissue] = useState(identification?.tissue ?? '');
  const [keyFeaturesText, setKeyFeaturesText] = useState(listToLines(identification?.keyFeatures));
  const [cellsText, setCellsText] = useState(listToLines(identification?.cellsToIdentify));
  const [structuresText, setStructuresText] = useState(
    listToLines(identification?.structuresToIdentify)
  );
  const [stainCharacteristics, setStainCharacteristics] = useState(
    identification?.stainCharacteristics ?? ''
  );
  const [differentialIdentification, setDifferentialIdentification] = useState(
    identification?.differentialIdentification ?? ''
  );
  const [examQuestionsText, setExamQuestionsText] = useState(
    listToLines(identification?.commonExamQuestions)
  );
  const [clinicalRelevance, setClinicalRelevance] = useState(
    identification?.clinicalRelevance ?? ''
  );

  useEffect(() => {
    setEditing(defaultEditing);
    setOrgan(identification?.organ ?? '');
    setTissue(identification?.tissue ?? '');
    setKeyFeaturesText(listToLines(identification?.keyFeatures));
    setCellsText(listToLines(identification?.cellsToIdentify));
    setStructuresText(listToLines(identification?.structuresToIdentify));
    setStainCharacteristics(identification?.stainCharacteristics ?? '');
    setDifferentialIdentification(identification?.differentialIdentification ?? '');
    setExamQuestionsText(listToLines(identification?.commonExamQuestions));
    setClinicalRelevance(identification?.clinicalRelevance ?? '');
  }, [identification, defaultEditing]);

  if (quizHidden) {
    return (
      <button
        type="button"
        onClick={onRevealQuiz}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3.5 py-3 text-left transition-colors hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Structured identification hidden in Quiz Mode</span>
        </div>
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
          Click to reveal
        </span>
      </button>
    );
  }

  const hasAnyContent = Boolean(
    identification?.organ ||
      identification?.tissue ||
      (identification?.keyFeatures && identification.keyFeatures.length > 0) ||
      (identification?.cellsToIdentify && identification.cellsToIdentify.length > 0) ||
      (identification?.structuresToIdentify && identification.structuresToIdentify.length > 0) ||
      identification?.stainCharacteristics ||
      identification?.differentialIdentification ||
      (identification?.commonExamQuestions && identification.commonExamQuestions.length > 0) ||
      identification?.clinicalRelevance
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: SlideIdentification = {
      organ: organ.trim() || undefined,
      tissue: tissue.trim() || undefined,
      keyFeatures: linesToList(keyFeaturesText),
      cellsToIdentify: linesToList(cellsText),
      structuresToIdentify: linesToList(structuresText),
      stainCharacteristics: stainCharacteristics.trim() || undefined,
      differentialIdentification: differentialIdentification.trim() || undefined,
      commonExamQuestions: linesToList(examQuestionsText),
      clinicalRelevance: clinicalRelevance.trim() || undefined,
    };
    onSave(cleaned);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <h3 className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
            Histology Identification Sheet
          </h3>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            <span>{hasAnyContent ? 'Edit Sheet' : 'Add Info'}</span>
          </button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-[#0B0F17]"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Record only verified histological observations. Leave uncertain fields blank.
          </p>

          <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Organ
              <input
                type="text"
                value={organ}
                onChange={(e) => setOrgan(e.target.value)}
                placeholder={fallbackOrgan || 'e.g., Kidney'}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Tissue
              <input
                type="text"
                value={tissue}
                onChange={(e) => setTissue(e.target.value)}
                placeholder={fallbackTissue || 'e.g., Simple cuboidal epithelium'}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Key Identifying Microscopic Features (one per line)
            <textarea
              rows={2}
              value={keyFeaturesText}
              onChange={(e) => setKeyFeaturesText(e.target.value)}
              placeholder="Diagnostic hallmark 1&#10;Diagnostic hallmark 2"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Cells to Identify (one per line)
              <textarea
                rows={2}
                value={cellsText}
                onChange={(e) => setCellsText(e.target.value)}
                placeholder="e.g., Podocyte&#10;Mesangial cell"
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Structures to Identify (one per line)
              <textarea
                rows={2}
                value={structuresText}
                onChange={(e) => setStructuresText(e.target.value)}
                placeholder="e.g., Renal corpuscle&#10;Bowman space"
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Stain Characteristics
            <textarea
              rows={2}
              value={stainCharacteristics}
              onChange={(e) => setStainCharacteristics(e.target.value)}
              placeholder="Describe dye affinity / color uptake..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Differential Identification
            <textarea
              rows={2}
              value={differentialIdentification}
              onChange={(e) => setDifferentialIdentification(e.target.value)}
              placeholder="How to distinguish from similar tissues/organs..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Common Practical Examination Questions (one per line)
            <textarea
              rows={2}
              value={examQuestionsText}
              onChange={(e) => setExamQuestionsText(e.target.value)}
              placeholder="Identify the pointed cell type..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Clinical Relevance
            <textarea
              rows={2}
              value={clinicalRelevance}
              onChange={(e) => setClinicalRelevance(e.target.value)}
              placeholder="Normal structure-function correlation or high-yield pathology contrast..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              <span>Save Identification</span>
            </button>
          </div>
        </form>
      ) : !hasAnyContent ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-400">
          No structured histology identification recorded yet. Click <span className="font-medium">Add Info</span> after confirming this specimen visually.
        </div>
      ) : (
        <dl className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-[#0B0F17]">
          {(identification?.organ || identification?.tissue) && (
            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Organ
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {identification?.organ || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Tissue
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {identification?.tissue || '—'}
                </dd>
              </div>
            </div>
          )}

          {identification?.keyFeatures && identification.keyFeatures.length > 0 && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Key Identifying Features
              </dt>
              <dd className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {identification.keyFeatures.map((f, idx) => (
                  <p key={idx}>• {f}</p>
                ))}
              </dd>
            </div>
          )}

          {identification?.cellsToIdentify && identification.cellsToIdentify.length > 0 && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Cells to Identify
              </dt>
              <dd className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                {identification.cellsToIdentify.join(' · ')}
              </dd>
            </div>
          )}

          {identification?.structuresToIdentify && identification.structuresToIdentify.length > 0 && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Structures to Identify
              </dt>
              <dd className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                {identification.structuresToIdentify.join(' · ')}
              </dd>
            </div>
          )}

          {identification?.stainCharacteristics && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Stain Characteristics
              </dt>
              <dd className="mt-0.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {identification.stainCharacteristics}
              </dd>
            </div>
          )}

          {identification?.differentialIdentification && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Differential Identification
              </dt>
              <dd className="mt-0.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {identification.differentialIdentification}
              </dd>
            </div>
          )}

          {identification?.commonExamQuestions && identification.commonExamQuestions.length > 0 && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Common Practical Exam Questions
              </dt>
              <dd className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {identification.commonExamQuestions.map((q, idx) => (
                  <p key={idx}>{idx + 1}. {q}</p>
                ))}
              </dd>
            </div>
          )}

          {identification?.clinicalRelevance && (
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Clinical Relevance
              </dt>
              <dd className="mt-0.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {identification.clinicalRelevance}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
};
