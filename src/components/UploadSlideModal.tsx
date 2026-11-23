import React, { useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { AnatomicalSystem, Slide } from '../types/histology';
import { DEFAULT_CHAPTER_ORDER } from '../data/defaultSlides';
import { SYSTEM_SECTIONS } from '../data/histologyCatalog';

interface UploadSlideModalProps {
  isOpen: boolean;
  existingChapters: string[];
  onClose: () => void;
  onSaveSlide: (slide: Slide) => void;
}

export const UploadSlideModal: React.FC<UploadSlideModalProps> = ({
  isOpen,
  existingChapters,
  onClose,
  onSaveSlide,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const combinedChapters = Array.from(
    new Set([...DEFAULT_CHAPTER_ORDER, ...existingChapters])
  );

  const [title, setTitle] = useState('');
  const [specimen, setSpecimen] = useState('');
  const [organ, setOrgan] = useState('');
  const [anatomicalSystem, setAnatomicalSystem] = useState<AnatomicalSystem>('Basic Tissues');
  const [chapterChoice, setChapterChoice] = useState(combinedChapters[0] ?? 'Epithelium');
  const [customChapter, setCustomChapter] = useState('');
  const [stain, setStain] = useState('H&E');
  const [magnification, setMagnification] = useState('400×');
  const [overviewNotes, setOverviewNotes] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP, or GIF).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Image exceeds 20 MB. Please choose a smaller micrograph.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
        setFileName(file.name);
        if (!title.trim()) {
          const cleanName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          setTitle(cleanName);
        }
      }
    };
    reader.onerror = () => {
      setErrorMsg('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setErrorMsg('Please upload a slide image first.');
      return;
    }
    const finalTitle = title.trim();
    if (!finalTitle) {
      setErrorMsg('Please enter a slide title.');
      return;
    }

    const resolvedChapter =
      chapterChoice === '__custom__'
        ? customChapter.trim() || 'Uncategorized'
        : chapterChoice;

    const newSlide: Slide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      chapter: resolvedChapter,
      title: finalTitle,
      specimen: specimen.trim() || 'Uploaded Tissue Section',
      organ: organ.trim() || specimen.trim() || finalTitle,
      anatomicalSystem,
      tissueType: resolvedChapter,
      stain: stain.trim() || 'H&E',
      magnification: magnification.trim() || '400×',
      fieldWidthUm: 350,
      imageUrl: imagePreview,
      overviewNotes:
        overviewNotes.trim() ||
        'Click anywhere on the slide canvas to drop numbered anatomical pins and record your histological notes.',
      pins: [],
      sourceInstitution: 'Personal Upload',
      license: 'Personal Study Upload',
      attribution: 'Uploaded by User',
      importStatus: 'uploaded',
      tags: [resolvedChapter.toLowerCase(), (stain || 'h&e').toLowerCase()],
      isCustom: true,
      createdAt: Date.now(),
    };

    onSaveSlide(newSlide);
    setTitle('');
    setSpecimen('');
    setOrgan('');
    setOverviewNotes('');
    setImagePreview(null);
    setFileName('');
    setCustomChapter('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-slide-heading"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#111622] dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 id="upload-slide-heading" className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Upload Histology Slide
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Add a micrograph to your personal library and annotate structures with pins.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="histo-scroll flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Slide Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
              />
              {imagePreview ? (
                <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#090C12]">
                  <div className="relative h-44 w-full">
                    <img
                      src={imagePreview}
                      alt="Uploaded slide preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                    <span className="truncate font-mono text-slate-600 dark:text-slate-300">
                      {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap ml-3"
                    >
                      Replace Image
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                  className={`mt-1.5 flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100/70 dark:border-slate-700 dark:bg-[#0B0F17] dark:hover:border-blue-500/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <ImagePlus className="h-7 w-7 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    Click to choose a micrograph or drag and drop
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    PNG, JPG, or WebP up to 20 MB
                  </p>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="slide-title-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Slide Title
                </label>
                <input
                  id="slide-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Renal Cortex: Glomerulus"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="slide-organ-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Organ
                </label>
                <input
                  id="slide-organ-input"
                  type="text"
                  value={organ}
                  onChange={(e) => setOrgan(e.target.value)}
                  placeholder="e.g., Kidney, Liver, Thyroid"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="slide-system-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Anatomical System
                </label>
                <select
                  id="slide-system-select"
                  value={anatomicalSystem}
                  onChange={(e) => setAnatomicalSystem(e.target.value as AnatomicalSystem)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                >
                  {SYSTEM_SECTIONS.map((s) => (
                    <option key={s.system} value={s.system}>
                      {s.system}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="slide-specimen-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Specimen / Section
                </label>
                <input
                  id="slide-specimen-input"
                  type="text"
                  value={specimen}
                  onChange={(e) => setSpecimen(e.target.value)}
                  placeholder="e.g., Human Kidney (Paraffin)"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="slide-chapter-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Deck Chapter
                </label>
                <select
                  id="slide-chapter-select"
                  value={chapterChoice}
                  onChange={(e) => setChapterChoice(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                >
                  {combinedChapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                  <option value="__custom__">+ New Chapter...</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="slide-stain-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Stain
                </label>
                <input
                  id="slide-stain-input"
                  type="text"
                  value={stain}
                  onChange={(e) => setStain(e.target.value)}
                  placeholder="H&E, PAS, Trichrome"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="slide-mag-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Magnification
                </label>
                <input
                  id="slide-mag-input"
                  type="text"
                  value={magnification}
                  onChange={(e) => setMagnification(e.target.value)}
                  placeholder="400×"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                />
              </div>
            </div>

            {chapterChoice === '__custom__' && (
              <div>
                <label
                  htmlFor="custom-chapter-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  New Chapter Name
                </label>
                <input
                  id="custom-chapter-input"
                  type="text"
                  value={customChapter}
                  onChange={(e) => setCustomChapter(e.target.value)}
                  placeholder="e.g., Lymphoid Organs"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="slide-notes-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Slide Study Notes (Optional)
              </label>
              <textarea
                id="slide-notes-input"
                rows={3}
                value={overviewNotes}
                onChange={(e) => setOverviewNotes(e.target.value)}
                placeholder="Key identifying features, tissue architecture, and diagnostic hallmarks..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save Slide to Deck</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
