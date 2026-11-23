export type AnatomicalSystem =
  | 'Basic Tissues'
  | 'Cardiovascular System'
  | 'Respiratory System'
  | 'Gastrointestinal System'
  | 'Urinary System'
  | 'Endocrine System'
  | 'Reproductive System'
  | 'Nervous System'
  | 'Special Senses'
  | 'Lymphatic & Immune System';

export type ImportStatus =
  | 'local-atlas'
  | 'uploaded'
  | 'imported'
  | 'external-reference';

export type SlideQualityStatus =
  | 'verified'
  | 'needs-review'
  | 'poor-image-quality'
  | 'incorrect-category'
  | 'duplicate'
  | 'pathology'
  | 'not-histology';

export type SlideAuditIssueCode =
  | 'broken-image'
  | 'invalid-mime'
  | 'low-resolution'
  | 'duplicate-image'
  | 'visually-similar'
  | 'not-histology'
  | 'textbook-illustration'
  | 'pathology-mixed'
  | 'incorrect-category'
  | 'missing-specimen'
  | 'missing-stain'
  | 'missing-attribution'
  | 'missing-license'
  | 'no-image-url';

export interface SlideAuditIssue {
  code: SlideAuditIssueCode;
  severity: 'error' | 'warning' | 'info';
  label: string;
  detail: string;
}

export interface SlideIdentification {
  organ?: string;
  tissue?: string;
  keyFeatures?: string[];
  cellsToIdentify?: string[];
  structuresToIdentify?: string[];
  stainCharacteristics?: string;
  differentialIdentification?: string;
  commonExamQuestions?: string[];
  clinicalRelevance?: string;
}

export interface Pin {
  id: string;
  number: number;
  /** Normalized horizontal position on the slide image (0 - 100%) */
  x: number;
  /** Normalized vertical position on the slide image (0 - 100%) */
  y: number;
  label: string;
  notes: string;
}

export interface Slide {
  id: string;
  /** Primary chapter / tissue grouping displayed in the sidebar tree */
  chapter: string;
  title: string;
  specimen: string;
  organ: string;
  anatomicalSystem: AnatomicalSystem;
  tissueType: string;
  stain: string;
  magnification: string;
  /** Width in micrometers of the full field of view at 1x fit, for calibrated scale bar */
  fieldWidthUm: number;
  imageUrl: string;
  thumbnailUrl?: string;
  highResUrl?: string;
  /** Optional Deep Zoom / IIIF / DZI tile source for OpenSeadragon WSI streaming */
  tileSourceUrl?: string;
  rotationDeg?: 0 | 90 | 180 | 270;
  overviewNotes: string;
  pins: Pin[];
  /** Rich catalog & attribution metadata */
  sourceInstitution: string;
  sourceId?: string;
  originalSourceUrl?: string;
  license: string;
  attribution: string;
  importStatus: ImportStatus;
  tags: string[];
  expectedFeatures?: string[];
  /** Quality audit & structured histology identification */
  qualityStatus?: SlideQualityStatus;
  auditFlags?: SlideAuditIssueCode[];
  auditNotes?: string;
  lastAuditedAt?: number;
  imageDimensions?: { width: number; height: number };
  visualHash?: string;
  identification?: SlideIdentification;
  isFavorite?: boolean;
  needsReview?: boolean;
  lastViewedAt?: number;
  studiedCount?: number;
  collectionIds?: string[];
  isCustom?: boolean;
  createdAt: number;
}

/** Stored separately in IndexedDB so image source changes never destroy user annotations */
export interface SlideAnnotationRecord {
  slideId: string;
  overviewNotes: string;
  pins: Pin[];
  tags: string[];
  isFavorite?: boolean;
  needsReview?: boolean;
  lastViewedAt?: number;
  studiedCount?: number;
  collectionIds?: string[];
  rotationDeg?: 0 | 90 | 180 | 270;
  qualityStatus?: SlideQualityStatus;
  auditFlags?: SlideAuditIssueCode[];
  auditNotes?: string;
  lastAuditedAt?: number;
  imageDimensions?: { width: number; height: number };
  visualHash?: string;
  identification?: SlideIdentification;
  metadataOverrides?: Partial<
    Pick<
      Slide,
      | 'title'
      | 'specimen'
      | 'organ'
      | 'anatomicalSystem'
      | 'tissueType'
      | 'chapter'
      | 'stain'
      | 'magnification'
      | 'sourceInstitution'
      | 'originalSourceUrl'
      | 'license'
      | 'attribution'
    >
  >;
  updatedAt: number;
}

export interface CustomCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export type SmartCollectionId =
  | 'all'
  | 'verified'
  | 'quality-needs-review'
  | 'quality-flagged'
  | 'recent-added'
  | 'favorites'
  | 'uploaded'
  | 'imported'
  | 'external'
  | 'recent-viewed'
  | 'unstudied'
  | 'needs-review';

export type LibrarySortOption =
  | 'recent-added'
  | 'organ'
  | 'tissue'
  | 'system'
  | 'title';

export type ViewerToolMode = 'pin' | 'pan';

export type ThemeMode = 'light' | 'dark';

export type QuizConfidence = 'unanswered' | 'recalled' | 'review';

export type WorkspaceTab =
  | 'viewer'
  | 'audit'
  | 'practical'
  | 'performance'
  | 'catalog'
  | 'discover';

export type PracticalQuestionCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface PracticalQuestionEvaluation {
  code: PracticalQuestionCode;
  prompt: string;
  userAnswer: string;
  expectedAnswer: string;
  correct: boolean;
  targetLabel?: string;
}

export interface PracticalAttemptRecord {
  id: string;
  slideId: string;
  slideTitle: string;
  organ: string;
  tissue: string;
  anatomicalSystem: AnatomicalSystem;
  targetPinId?: string;
  targetPinLabel?: string;
  missedFeatures: string[];
  correct: boolean;
  scorePercent: number;
  confidence: QuizConfidence;
  timeTakenMs: number;
  questionResults: PracticalQuestionEvaluation[];
  timestamp: number;
}

export interface SlideStudyProgress {
  slideId: string;
  correctCount: number;
  incorrectCount: number;
  consecutiveCorrect: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: number;
  lastAttemptAt?: number;
  lastTimeTakenMs?: number;
  totalTimeTakenMs: number;
  attemptCount: number;
  lastConfidence?: QuizConfidence;
  missedStructures: string[];
  missedFeatures: string[];
}

export interface CatalogTopic {
  id: string;
  systemCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  system: AnatomicalSystem;
  subcategory: string;
  name: string;
  organ: string;
  suggestedStains: string[];
  keyFeatures: string[];
  searchQuery: string;
}

export interface SourceCapabilities {
  search: boolean;
  resultsListing: boolean;
  thumbnailPreview: boolean;
  directImport: boolean;
  imageMetadata: boolean;
  licenseInfo: boolean;
  tiledWsi: boolean;
}

export interface SourceDescriptor {
  id: string;
  name: string;
  shortName: string;
  institution: string;
  baseUrl: string;
  kind: 'open-access-api' | 'university-atlas';
  capabilities: SourceCapabilities;
  limitationNotice?: string;
}

export interface DiscoveredSlideResult {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceInstitution: string;
  title: string;
  specimenName: string;
  organ: string;
  anatomicalSystem: AnatomicalSystem | string;
  tissueType: string;
  stain: string;
  magnification: string;
  description: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  highResUrl?: string;
  tileSourceUrl?: string;
  originalUrl: string;
  license: string;
  attribution: string;
  width?: number;
  height?: number;
  directImportAllowed: boolean;
  importLimitation?: string;
  tags: string[];
}
