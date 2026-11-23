import {
  Slide,
  SlideAuditIssue,
  SlideAuditIssueCode,
  SlideQualityStatus,
} from '../types/histology';

export const QUALITY_STATUS_OPTIONS: Array<{
  value: SlideQualityStatus;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'verified',
    label: 'Verified',
    shortLabel: 'Verified',
    description: 'Confirmed real histology micrograph with accurate labels and attribution.',
  },
  {
    value: 'needs-review',
    label: 'Needs Review',
    shortLabel: 'Needs Review',
    description: 'Imported or uncurated slide awaiting manual visual inspection.',
  },
  {
    value: 'poor-image-quality',
    label: 'Poor Image Quality',
    shortLabel: 'Poor Quality',
    description: 'Broken URL, invalid MIME type, low resolution, blurry, or obscured field.',
  },
  {
    value: 'incorrect-category',
    label: 'Incorrect Category',
    shortLabel: 'Wrong Category',
    description: 'Tissue, organ, or anatomical system assignment does not match the specimen.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate',
    shortLabel: 'Duplicate',
    description: 'Identical image URL or visually duplicate micrograph already present.',
  },
  {
    value: 'pathology',
    label: 'Pathology',
    shortLabel: 'Pathology',
    description: 'Pathological lesion or tumor mixed into normal histology collection.',
  },
  {
    value: 'not-histology',
    label: 'Not Histology',
    shortLabel: 'Not Histology',
    description: 'Diagram, textbook illustration, gross anatomy, or non-microscopy image.',
  },
];

export const ISSUE_INFO: Record<
  SlideAuditIssueCode,
  { label: string; severity: 'error' | 'warning' | 'info' }
> = {
  'broken-image': { label: 'Broken Image', severity: 'error' },
  'invalid-mime': { label: 'Invalid Image MIME', severity: 'error' },
  'no-image-url': { label: 'Missing Image URL', severity: 'error' },
  'low-resolution': { label: 'Low Resolution', severity: 'warning' },
  'duplicate-image': { label: 'Duplicate Image', severity: 'warning' },
  'visually-similar': { label: 'Visually Similar', severity: 'info' },
  'not-histology': { label: 'Not Histology', severity: 'error' },
  'textbook-illustration': { label: 'Textbook Illustration', severity: 'warning' },
  'pathology-mixed': { label: 'Pathology Specimen', severity: 'warning' },
  'incorrect-category': { label: 'Category Mismatch', severity: 'warning' },
  'missing-specimen': { label: 'Missing Specimen Name', severity: 'info' },
  'missing-stain': { label: 'Generic/Missing Stain', severity: 'info' },
  'missing-attribution': { label: 'Missing Attribution', severity: 'info' },
  'missing-license': { label: 'Missing/Generic License', severity: 'info' },
};

const ILLUSTRATION_RE =
  /\b(diagram|schematic|illustration|drawing|sketch|cartoon|engraving|openstax|gray'?s\s+anatomy|nordisk\s+familjebok|plate\s+\d+|figure\s+\d+|vector\s+graphic)\b|\bpsm\s+v\d+/i;

const NON_HISTOLOGY_RE =
  /\b(gross\s+anatomy|macroscopic\s+view|autopsy\s+specimen|radiograph|x-?ray|mri\s+scan|ct\s+scan|ultrasound|endoscopy|colonoscopy|ekg|ecg|electrocardiogram|clinical\s+photograph|anatomical\s+model)\b/i;

const PATHOLOGY_RE =
  /\b(carcinoma|adenocarcinoma|sarcoma|melanoma|lymphoma|leukemia|leukaemia|punlmp|neoplasm|tumou?r|metastasis|metastatic|glioblastoma|meningioma|adenoma|dysplasia|cirrhosis|atherosclerosis|infarct|necrosis|tuberculosis|granuloma|pneumonia|gastritis|hepatitis|nephritis|malignant|cancer|pathology|pathological)\b/i;

const CATEGORY_SYSTEM_RULES: Array<{
  pattern: RegExp;
  expectedSystems: string[];
  label: string;
}> = [
  {
    pattern: /\b(cerebellum|cerebrum|cerebral cortex|hippocampus|spinal cord|purkinje|dorsal root ganglion|schwann|peripheral nerve)\b/i,
    expectedSystems: ['Nervous System', 'Basic Tissues'],
    label: 'Nervous system specimen',
  },
  {
    pattern: /\b(myocardium|epicardium|endocardium|aorta|elastic artery|muscular artery|purkinje fibers)\b/i,
    expectedSystems: ['Cardiovascular System', 'Basic Tissues'],
    label: 'Cardiovascular specimen',
  },
  {
    pattern: /\b(trachea|bronchus|bronchiole|alveoli|alveolus|lung parenchyma|respiratory epithelium)\b/i,
    expectedSystems: ['Respiratory System', 'Basic Tissues'],
    label: 'Respiratory specimen',
  },
  {
    pattern: /\b(glomerulus|renal cortex|renal medulla|nephron|bowman'?s capsule|ureter|urinary bladder|urothelium)\b/i,
    expectedSystems: ['Urinary System', 'Basic Tissues'],
    label: 'Urinary specimen',
  },
  {
    pattern: /\b(esophagus|oesophagus|stomach|fundus|pylorus|duodenum|jejunum|ileum|colon|appendix|rectum|salivary gland|parotid|submandibular|hepatocyte|hepatic lobule|gallbladder|islets? of langerhans)\b/i,
    expectedSystems: ['Gastrointestinal System', 'Basic Tissues', 'Endocrine System'],
    label: 'GI / hepatobiliary specimen',
  },
  {
    pattern: /\b(thyroid|parathyroid|adrenal cortex|adrenal medulla|pituitary|adenohypophysis|neurohypophysis|pineal gland)\b/i,
    expectedSystems: ['Endocrine System'],
    label: 'Endocrine specimen',
  },
  {
    pattern: /\b(seminiferous|epididymis|prostate|ovarian follicle|corpus luteum|endometrium|myometrium|fallopian tube|oviduct|cervix|placenta|testis|testicle)\b/i,
    expectedSystems: ['Reproductive System'],
    label: 'Reproductive specimen',
  },
  {
    pattern: /\b(lymph node|spleen|white pulp|red pulp|thymus|hassall|tonsil|peyer'?s patch)\b/i,
    expectedSystems: ['Lymphatic & Immune System', 'Gastrointestinal System'],
    label: 'Lymphatic/immune specimen',
  },
  {
    pattern: /\b(epidermis|dermis|hair follicle|sweat gland|sebaceous gland|retina|cochlea|organ of corti|cornea|taste bud)\b/i,
    expectedSystems: ['Special Senses', 'Basic Tissues'],
    label: 'Integument / special senses specimen',
  },
];

function normalizeUrlForDup(url: string): string {
  return url.trim().split('?')[0].toLowerCase();
}

export function hammingDistanceHex64(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    if (Number.isNaN(x)) return 64;
    // Popcount 4-bit nibble
    dist += ((x >> 0) & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return dist;
}

export interface AuditRunSummary {
  issuesBySlideId: Record<string, SlideAuditIssue[]>;
  cleanCount: number;
  flaggedCount: number;
  issueCounts: Record<SlideAuditIssueCode, number>;
  similarGroups: Array<{ primaryId: string; matchId: string; distance: number }>;
}

export function runMetadataAndHeuristicAudit(slides: Slide[]): AuditRunSummary {
  const issuesBySlideId: Record<string, SlideAuditIssue[]> = {};
  const issueCounts = Object.keys(ISSUE_INFO).reduce(
    (acc, k) => ({ ...acc, [k]: 0 }),
    {} as Record<SlideAuditIssueCode, number>
  );

  const urlGroups = new Map<string, string[]>();
  const sourceIdGroups = new Map<string, string[]>();
  const hashSlides: Array<{ id: string; hash: string }> = [];

  for (const slide of slides) {
    const rawUrl = slide.highResUrl || slide.imageUrl || slide.thumbnailUrl || '';
    if (rawUrl && !rawUrl.startsWith('data:')) {
      const normUrl = normalizeUrlForDup(rawUrl);
      const list = urlGroups.get(normUrl) ?? [];
      list.push(slide.id);
      urlGroups.set(normUrl, list);
    }
    if (slide.sourceId) {
      const sList = sourceIdGroups.get(slide.sourceId) ?? [];
      sList.push(slide.id);
      sourceIdGroups.set(slide.sourceId, sList);
    }
    if (slide.visualHash && slide.visualHash.length === 16) {
      hashSlides.push({ id: slide.id, hash: slide.visualHash });
    }
  }

  const similarPairs: Array<{ primaryId: string; matchId: string; distance: number }> = [];
  const exactVisualDups = new Set<string>();
  const nearVisualDups = new Map<string, { otherId: string; distance: number }>();

  for (let i = 0; i < hashSlides.length; i++) {
    for (let j = i + 1; j < hashSlides.length; j++) {
      const dist = hammingDistanceHex64(hashSlides[i].hash, hashSlides[j].hash);
      if (dist === 0) {
        exactVisualDups.add(hashSlides[i].id);
        exactVisualDups.add(hashSlides[j].id);
        similarPairs.push({
          primaryId: hashSlides[i].id,
          matchId: hashSlides[j].id,
          distance: 0,
        });
      } else if (dist <= 6) {
        if (!nearVisualDups.has(hashSlides[i].id)) {
          nearVisualDups.set(hashSlides[i].id, { otherId: hashSlides[j].id, distance: dist });
        }
        if (!nearVisualDups.has(hashSlides[j].id)) {
          nearVisualDups.set(hashSlides[j].id, { otherId: hashSlides[i].id, distance: dist });
        }
        similarPairs.push({
          primaryId: hashSlides[i].id,
          matchId: hashSlides[j].id,
          distance: dist,
        });
      }
    }
  }

  const pushIssue = (slideId: string, code: SlideAuditIssueCode, detail: string) => {
    const info = ISSUE_INFO[code];
    const existing = issuesBySlideId[slideId] ?? [];
    if (existing.some((i) => i.code === code)) return;
    existing.push({
      code,
      severity: info.severity,
      label: info.label,
      detail,
    });
    issuesBySlideId[slideId] = existing;
    issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  };

  for (const slide of slides) {
    const rawUrl = slide.imageUrl || slide.highResUrl || slide.thumbnailUrl || '';
    if (!rawUrl) {
      pushIssue(
        slide.id,
        'no-image-url',
        'No direct image URL stored on this slide record.'
      );
    } else if (/\.svg(\?|$)/i.test(rawUrl)) {
      pushIssue(
        slide.id,
        'textbook-illustration',
        'Vector SVG asset detected rather than a raster microscope micrograph.'
      );
      pushIssue(slide.id, 'invalid-mime', 'SVG file extension is not a raster micrograph.');
    }

    // Duplicate URL / sourceId / exact visual hash
    if (rawUrl && !rawUrl.startsWith('data:')) {
      const dupIds = urlGroups.get(normalizeUrlForDup(rawUrl)) ?? [];
      if (dupIds.length > 1) {
        pushIssue(
          slide.id,
          'duplicate-image',
          `Shares identical image URL with ${dupIds.length - 1} other slide(s).`
        );
      }
    }
    if (slide.sourceId) {
      const sDupIds = sourceIdGroups.get(slide.sourceId) ?? [];
      if (sDupIds.length > 1) {
        pushIssue(
          slide.id,
          'duplicate-image',
          `Shares source ID (${slide.sourceId}) with ${sDupIds.length - 1} other slide(s).`
        );
      }
    }
    if (exactVisualDups.has(slide.id)) {
      pushIssue(
        slide.id,
        'duplicate-image',
        'Perceptual dHash matches another slide in the library (distance 0).'
      );
    } else if (nearVisualDups.has(slide.id)) {
      const near = nearVisualDups.get(slide.id)!;
      pushIssue(
        slide.id,
        'visually-similar',
        `Perceptually similar to slide "${near.otherId}" (dHash distance ${near.distance}/64).`
      );
    }

    // Low resolution if measured
    if (slide.imageDimensions) {
      const { width, height } = slide.imageDimensions;
      if (Math.min(width, height) < 400 || width * height < 200_000) {
        pushIssue(
          slide.id,
          'low-resolution',
          `Measured dimensions ${width}×${height} px are below recommended 400 px minimum.`
        );
      }
    }

    // Preserve prior live-probe flags if already audited
    if (slide.auditFlags?.includes('broken-image')) {
      pushIssue(slide.id, 'broken-image', 'Image URL failed live HTTP/canvas load check.');
    }
    if (slide.auditFlags?.includes('invalid-mime')) {
      pushIssue(slide.id, 'invalid-mime', 'Remote resource did not return a raster image/* MIME.');
    }

    // Heuristic text screening (title + specimen + overviewNotes + tags)
    const corpus = `${slide.title} ${slide.specimen} ${slide.overviewNotes} ${(slide.tags ?? []).join(' ')}`;

    if (ILLUSTRATION_RE.test(corpus)) {
      pushIssue(
        slide.id,
        'textbook-illustration',
        'Title or notes match textbook diagram/illustration keywords.'
      );
    }
    if (NON_HISTOLOGY_RE.test(corpus)) {
      pushIssue(
        slide.id,
        'not-histology',
        'Keywords suggest gross anatomy, radiology, or non-histology image.'
      );
    }
    if (PATHOLOGY_RE.test(corpus)) {
      const match = corpus.match(PATHOLOGY_RE)?.[0] ?? 'pathology';
      pushIssue(
        slide.id,
        'pathology-mixed',
        `Detected pathology term "${match}" — verify whether specimen belongs in normal histology.`
      );
    }

    // Category mismatch check (check title + specimen against assigned anatomicalSystem)
    const titleOrganText = `${slide.title} ${slide.specimen} ${slide.organ}`;
    for (const rule of CATEGORY_SYSTEM_RULES) {
      if (
        rule.pattern.test(titleOrganText) &&
        !rule.expectedSystems.includes(slide.anatomicalSystem)
      ) {
        pushIssue(
          slide.id,
          'incorrect-category',
          `${rule.label} keywords found, but assigned to "${slide.anatomicalSystem}".`
        );
        break;
      }
    }

    // Metadata completeness checks
    const spec = (slide.specimen ?? '').trim().toLowerCase();
    if (!spec || spec === 'histology specimen' || spec === 'specimen' || spec.length < 3) {
      pushIssue(slide.id, 'missing-specimen', 'Specimen name is missing or generic.');
    }

    const stain = (slide.stain ?? '').trim().toLowerCase();
    if (!stain || stain === 'light microscopy' || stain === 'microscopy' || stain === 'unknown') {
      pushIssue(
        slide.id,
        'missing-stain',
        `Stain is "${slide.stain || 'blank'}" — verify specific stain (H&E, Masson, PAS, Silver, etc.).`
      );
    }

    const attr = (slide.attribution ?? '').trim().toLowerCase();
    if (!attr || attr === 'unknown' || attr === 'wikimedia commons contributor') {
      pushIssue(
        slide.id,
        'missing-attribution',
        `Attribution is "${slide.attribution || 'blank'}" — confirm original author/source.`
      );
    }

    const lic = (slide.license ?? '').trim().toLowerCase();
    if (!lic || lic === 'unknown' || lic === 'creative commons / public domain') {
      pushIssue(
        slide.id,
        'missing-license',
        `License is "${slide.license || 'blank'}" — confirm exact CC/PD license version.`
      );
    }
  }

  let cleanCount = 0;
  let flaggedCount = 0;
  for (const slide of slides) {
    const list = issuesBySlideId[slide.id] ?? [];
    if (list.length === 0) cleanCount++;
    else flaggedCount++;
  }

  return {
    issuesBySlideId,
    cleanCount,
    flaggedCount,
    issueCounts,
    similarGroups: similarPairs,
  };
}

export interface ServerImageAuditResult {
  id: string;
  ok: boolean;
  status: number;
  contentType: string;
  contentLength?: number;
  error?: string;
}

export async function probeServerImagesBatch(
  items: Array<{ id: string; url: string }>
): Promise<ServerImageAuditResult[]> {
  if (items.length === 0) return [];
  const res = await fetch('/api/audit-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error(`Audit probe failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { results?: ServerImageAuditResult[] };
  return data.results ?? [];
}

/**
 * Loads an image safely via same-origin proxy (or directly for data:/local URLs),
 * reads natural dimensions, and computes a 64-bit grayscale difference hash (dHash).
 */
export async function measureImageAndComputeDHash(slide: Slide): Promise<{
  width: number;
  height: number;
  visualHash: string;
  ok: boolean;
}> {
  const rawUrl = slide.imageUrl || slide.highResUrl || slide.thumbnailUrl || '';
  if (!rawUrl) {
    return { width: 0, height: 0, visualHash: '', ok: false };
  }

  const fetchUrl = rawUrl.startsWith('https://')
    ? `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`
    : rawUrl;

  let objectUrl: string | null = null;
  try {
    let imgSrc = fetchUrl;
    if (fetchUrl.startsWith('/api/image-proxy')) {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) {
        return { width: 0, height: 0, visualHash: '', ok: false };
      }
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') {
        return { width: 0, height: 0, visualHash: '', ok: false };
      }
      objectUrl = URL.createObjectURL(blob);
      imgSrc = objectUrl;
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image'));
      el.src = imgSrc;
    });

    const width = img.naturalWidth || 0;
    const height = img.naturalHeight || 0;
    if (!width || !height) {
      return { width: 0, height: 0, visualHash: '', ok: false };
    }

    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { width, height, visualHash: '', ok: true };
    }

    ctx.drawImage(img, 0, 0, 9, 8);
    const pixels = ctx.getImageData(0, 0, 9, 8).data;

    let hex = '';
    let nibble = 0;
    let bitIndex = 0;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idxL = (y * 9 + x) * 4;
        const idxR = (y * 9 + x + 1) * 4;
        const lumL = 0.299 * pixels[idxL] + 0.587 * pixels[idxL + 1] + 0.114 * pixels[idxL + 2];
        const lumR = 0.299 * pixels[idxR] + 0.587 * pixels[idxR + 1] + 0.114 * pixels[idxR + 2];
        nibble = (nibble << 1) | (lumL > lumR ? 1 : 0);
        bitIndex++;
        if (bitIndex === 4) {
          hex += nibble.toString(16);
          nibble = 0;
          bitIndex = 0;
        }
      }
    }

    return { width, height, visualHash: hex, ok: true };
  } catch {
    return { width: 0, height: 0, visualHash: '', ok: false };
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
