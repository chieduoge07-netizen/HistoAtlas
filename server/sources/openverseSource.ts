import type { DiscoveredSlideItem, SlideSourceConnector, SourceSearchParams } from './types.ts';

const USER_AGENT = 'HistoAtlas/2.0 (Educational Histology Study Studio)';

interface OpenverseResult {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  provider?: string;
  source?: string;
  width?: number;
  height?: number;
  tags?: Array<{ name: string }>;
}

function formatLicense(license?: string, version?: string): string {
  if (!license) return 'Creative Commons';
  const upper = license.toUpperCase();
  if (upper === 'CC0' || upper === 'PDM') return upper === 'CC0' ? 'CC0 Public Domain' : 'Public Domain Mark';
  return version ? `CC ${upper} ${version}` : `CC ${upper}`;
}

export const openverseSource: SlideSourceConnector = {
  descriptor: {
    id: 'openverse',
    name: 'Openverse Scientific & CC Microscopy',
    shortName: 'Openverse',
    institution: 'Openverse (CC & Public Domain Index)',
    baseUrl: 'https://openverse.org',
    kind: 'open-access-api',
    capabilities: {
      search: true,
      resultsListing: true,
      thumbnailPreview: true,
      directImport: true,
      imageMetadata: true,
      licenseInfo: true,
      tiledWsi: false,
    },
  },

  async search(params: SourceSearchParams) {
    const cleanQuery = params.query.trim();
    const hasHisto = /histolog|microscop|pathology|tissue|section/i.test(cleanQuery);
    const qParts = [cleanQuery];
    if (params.stain && params.stain !== 'all') qParts.push(params.stain);
    if (!hasHisto) qParts.push('histology');

    const url = new URL('https://api.openverse.org/v1/images/');
    url.searchParams.set('q', qParts.join(' '));
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('page_size', String(Math.min(20, params.limit)));
    url.searchParams.set('license', 'cc0,pdm,by,by-sa,by-nc,by-nc-sa');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          sourceId: 'openverse',
          items: [],
          hasMore: false,
          error: `Openverse returned HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as {
        result_count?: number;
        page_count?: number;
        results?: OpenverseResult[];
      };

      const results = data.results ?? [];
      const items: DiscoveredSlideItem[] = [];

      for (const item of results) {
        if (!item.url || !item.foreign_landing_url) continue;
        if (item.url.toLowerCase().endsWith('.svg')) continue;
        const title = (item.title || 'Histology Micrograph').trim();
        const licenseLabel = formatLicense(item.license, item.license_version);
        const creator = item.creator?.trim() || 'Openverse Contributor';
        const provider = item.provider || item.source || 'Openverse';
        const tags = (item.tags ?? []).map((t) => t.name).slice(0, 6);

        items.push({
          id: `ov-${item.id}`,
          sourceId: 'openverse',
          sourceName: 'Openverse',
          sourceInstitution: `${provider} via Openverse`,
          title,
          specimenName: title,
          organ: cleanQuery,
          anatomicalSystem: params.system && params.system !== 'all' ? params.system : 'Basic Tissues',
          tissueType: cleanQuery,
          stain: params.stain && params.stain !== 'all' ? params.stain : 'Microscopy',
          magnification: 'Light Microscopy',
          description: `${title}. Licensed under ${licenseLabel} by ${creator}.`,
          thumbnailUrl: item.thumbnail || item.url,
          imageUrl: item.url,
          highResUrl: item.url,
          originalUrl: item.foreign_landing_url,
          license: licenseLabel,
          attribution: `${creator} (${licenseLabel}) via ${provider}`,
          width: item.width,
          height: item.height,
          directImportAllowed: true,
          tags: [...tags, 'openverse'],
        });
      }

      return {
        sourceId: 'openverse',
        items,
        totalEstimate: data.result_count,
        hasMore: params.page < (data.page_count ?? 1),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return {
        sourceId: 'openverse',
        items: [],
        hasMore: false,
        error: `Openverse unavailable: ${msg}`,
      };
    }
  },
};
