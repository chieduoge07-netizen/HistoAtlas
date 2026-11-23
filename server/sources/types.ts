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

export interface DiscoveredSlideItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceInstitution: string;
  title: string;
  specimenName: string;
  organ: string;
  anatomicalSystem: string;
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

export interface SourceSearchParams {
  query: string;
  system?: string;
  stain?: string;
  page: number;
  limit: number;
}

export interface SourceSearchOutput {
  sourceId: string;
  items: DiscoveredSlideItem[];
  totalEstimate?: number;
  hasMore: boolean;
  error?: string;
}

export interface SlideSourceConnector {
  descriptor: SourceDescriptor;
  search: (params: SourceSearchParams) => Promise<SourceSearchOutput>;
}
