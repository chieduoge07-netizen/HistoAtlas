import { LibrarySortOption, Slide, SmartCollectionId } from '../types/histology';

export interface IndexedSlideEntry {
  slide: Slide;
  searchTokens: string;
}

export function buildSlideSearchIndex(slides: Slide[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const slide of slides) {
    const parts = [
      slide.title,
      slide.specimen,
      slide.organ,
      slide.anatomicalSystem,
      slide.tissueType,
      slide.chapter,
      slide.stain,
      slide.sourceInstitution,
      slide.license,
      slide.identification?.organ ?? '',
      slide.identification?.tissue ?? '',
      ...(slide.identification?.keyFeatures ?? []),
      ...(slide.identification?.cellsToIdentify ?? []),
      ...(slide.identification?.structuresToIdentify ?? []),
      slide.identification?.stainCharacteristics ?? '',
      slide.identification?.differentialIdentification ?? '',
      slide.identification?.clinicalRelevance ?? '',
      ...(slide.tags ?? []),
      ...slide.pins.map((p) => `${p.label} ${p.notes}`),
    ];
    index.set(slide.id, parts.join(' ').toLowerCase());
  }
  return index;
}

export function filterAndSortSlides(
  slides: Slide[],
  searchIndex: Map<string, string>,
  options: {
    query: string;
    smartCollection: SmartCollectionId | null;
    customCollectionId: string | null;
    sortBy: LibrarySortOption;
  }
): Slide[] {
  const q = options.query.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  let filtered = slides.filter((slide) => {
    // Collection filter
    if (options.customCollectionId) {
      if (!(slide.collectionIds ?? []).includes(options.customCollectionId)) {
        return false;
      }
    } else if (options.smartCollection && options.smartCollection !== 'all') {
      const qStatus = slide.qualityStatus ?? 'needs-review';
      switch (options.smartCollection) {
        case 'verified':
          if (qStatus !== 'verified') return false;
          break;
        case 'quality-needs-review':
          if (qStatus !== 'needs-review') return false;
          break;
        case 'quality-flagged':
          if (qStatus === 'verified' && (!slide.auditFlags || slide.auditFlags.length === 0)) {
            return false;
          }
          if (qStatus === 'needs-review' && (!slide.auditFlags || slide.auditFlags.length === 0)) {
            return false;
          }
          break;
        case 'favorites':
          if (!slide.isFavorite) return false;
          break;
        case 'uploaded':
          if (slide.importStatus !== 'uploaded') return false;
          break;
        case 'imported':
          if (slide.importStatus !== 'imported') return false;
          break;
        case 'external':
          if (slide.importStatus !== 'external-reference') return false;
          break;
        case 'recent-viewed':
          if (!slide.lastViewedAt) return false;
          break;
        case 'unstudied':
          if ((slide.studiedCount ?? 0) > 0 || slide.lastViewedAt) return false;
          break;
        case 'needs-review':
          if (!slide.needsReview) return false;
          break;
        case 'recent-added':
          // All slides sorted by createdAt desc below
          break;
      }
    }

    if (tokens.length === 0) return true;
    const text = searchIndex.get(slide.id) ?? '';
    return tokens.every((tok) => text.includes(tok));
  });

  filtered = [...filtered];

  if (options.smartCollection === 'recent-viewed') {
    filtered.sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0));
    return filtered;
  }

  if (options.smartCollection === 'recent-added' || options.sortBy === 'recent-added') {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered;
  }

  switch (options.sortBy) {
    case 'organ':
      filtered.sort((a, b) => a.organ.localeCompare(b.organ));
      break;
    case 'tissue':
      filtered.sort((a, b) => a.tissueType.localeCompare(b.tissueType));
      break;
    case 'system':
      filtered.sort((a, b) => a.anatomicalSystem.localeCompare(b.anatomicalSystem));
      break;
    case 'title':
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  return filtered;
}
