import type { DiscoveredSlideItem, SlideSourceConnector, SourceSearchParams } from './types.ts';

const USER_AGENT = 'HistoAtlas/2.0 (Educational Histology Study Studio; open-access microscopy lookup)';

function stripHtml(input: string | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferStain(text: string, fallbackStain?: string): string {
  const lower = text.toLowerCase();
  if (/\bh\s*&\s*e\b|\bhematoxylin\b|\bhaematoxylin\b/.test(lower)) return 'H&E';
  if (/\bpas\b|periodic acid/.test(lower)) return 'PAS';
  if (/trichrome|masson/.test(lower)) return "Masson's Trichrome";
  if (/giemsa|wright/.test(lower)) return 'Wright-Giemsa';
  if (/silver|reticulin|golgi|jones/.test(lower)) return 'Silver Stain';
  if (/luxol/.test(lower)) return 'Luxol Fast Blue';
  if (/toluidine/.test(lower)) return 'Toluidine Blue';
  if (/alcian/.test(lower)) return 'Alcian Blue';
  if (/verhoeff|orcein|elastic/.test(lower)) return 'Elastic Stain';
  if (/nissl|cresyl/.test(lower)) return 'Nissl / Cresyl Violet';
  return fallbackStain || 'Microscopy';
}

function inferMagnification(text: string): string {
  const match = text.match(/\b(40|100|200|400|600|1000)\s*[x×]\b/i);
  if (match) return `${match[1]}×`;
  if (/low\s*mag|low\s*power/i.test(text)) return '40×–100×';
  if (/high\s*mag|high\s*power/i.test(text)) return '400×';
  return 'Light Microscopy';
}

function inferSystemAndOrgan(text: string, fallbackSystem?: string): { system: string; organ: string } {
  const lower = text.toLowerCase();
  if (/(liver|hepat|pancrea|stomach|gastric|duoden|jejun|ileum|colon|esophag|salivary|parotid|gallbladder|appendix|tongue)/.test(lower)) {
    const organMatch = lower.match(/(liver|pancreas|stomach|duodenum|jejunum|ileum|colon|esophagus|parotid|gallbladder|appendix|tongue)/);
    return {
      system: 'Gastrointestinal System',
      organ: organMatch ? organMatch[1].replace(/^\w/, (c) => c.toUpperCase()) : 'GI Tract',
    };
  }
  if (/(kidney|renal|glomerul|nephron|ureter|bladder|urothel)/.test(lower)) {
    return { system: 'Urinary System', organ: /bladder|ureter/.test(lower) ? 'Urinary Tract' : 'Kidney' };
  }
  if (/(heart|myocard|aorta|artery|arteriole|vein|endocard)/.test(lower)) {
    return { system: 'Cardiovascular System', organ: /heart|myocard/.test(lower) ? 'Heart' : 'Blood Vessel' };
  }
  if (/(lung|alveol|trachea|bronch|nasal)/.test(lower)) {
    return { system: 'Respiratory System', organ: /trachea/.test(lower) ? 'Trachea' : 'Lung' };
  }
  if (/(thyroid|parathyroid|adrenal|pituitary|hypophysis|pineal|islet)/.test(lower)) {
    return { system: 'Endocrine System', organ: 'Endocrine Gland' };
  }
  if (/(testis|seminiferous|epididymis|prostate|ovary|follicle|uterus|endometrium|cervix|placenta|mammary)/.test(lower)) {
    return { system: 'Reproductive System', organ: 'Reproductive Organ' };
  }
  if (/(retina|cornea|cochlea|corti|sclera|iris|ciliary body|inner ear|lens)/.test(lower)) {
    return { system: 'Special Senses', organ: /cochlea|corti|ear/.test(lower) ? 'Inner Ear' : 'Eye' };
  }
  if (/(cerebell|cerebr|cortex|spinal|nerve|ganglion|purkinje|choroid plexus|schwann)/.test(lower)) {
    return { system: 'Nervous System', organ: /cerebell/.test(lower) ? 'Cerebellum' : 'Nervous Tissue' };
  }
  if (/(lymph node|spleen|thymus|tonsil|peyer|malt)/.test(lower)) {
    return { system: 'Lymphatic & Immune System', organ: 'Lymphoid Organ' };
  }
  return {
    system: fallbackSystem && fallbackSystem !== 'all' ? fallbackSystem : 'Basic Tissues',
    organ: 'Histology Specimen',
  };
}

interface WikimediaImageInfo {
  size?: number;
  width?: number;
  height?: number;
  mime?: string;
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: {
    LicenseShortName?: { value?: string };
    LicenseUrl?: { value?: string };
    Artist?: { value?: string };
    Credit?: { value?: string };
    ImageDescription?: { value?: string };
    ObjectName?: { value?: string };
  };
}

interface WikimediaPage {
  pageid: number;
  title: string;
  index?: number;
  imageinfo?: WikimediaImageInfo[];
}

export const wikimediaSource: SlideSourceConnector = {
  descriptor: {
    id: 'wikimedia-commons',
    name: 'Wikimedia Commons Microscopy',
    shortName: 'Wikimedia Commons',
    institution: 'Wikimedia Commons Open-Access Repository',
    baseUrl: 'https://commons.wikimedia.org',
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
    const cleanQuery = params.query
      .trim()
      .replace(/\bH\s*&\s*E\b/gi, 'hematoxylin eosin');
    const hasHistologyKeyword = /histolog|microscop|hematoxylin|eosin|epithel|cartilage|osteon|glomerul|alveol|myocard|cerebell/i.test(
      cleanQuery
    );
    const searchParts = [cleanQuery];
    if (params.stain && params.stain !== 'all') {
      const normalizedStain = params.stain.replace(/\bH\s*&\s*E\b/gi, 'hematoxylin eosin');
      if (!cleanQuery.toLowerCase().includes(normalizedStain.toLowerCase())) {
        searchParts.push(normalizedStain);
      }
    }
    if (!hasHistologyKeyword) {
      searchParts.push('histology');
    }
    const gsrsearch = `${searchParts.filter(Boolean).join(' ')} -filetype:svg`;
    const offset = Math.max(0, (params.page - 1) * params.limit);

    const runQuery = async (qStr: string) => {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.searchParams.set('action', 'query');
      url.searchParams.set('generator', 'search');
      url.searchParams.set('gsrnamespace', '6');
      url.searchParams.set('gsrsearch', qStr);
      url.searchParams.set('gsrlimit', String(Math.min(40, params.limit)));
      url.searchParams.set('gsroffset', String(offset));
      url.searchParams.set('prop', 'imageinfo');
      url.searchParams.set('iiprop', 'url|extmetadata|size|mime');
      url.searchParams.set('iiurlwidth', '1280');
      url.searchParams.set('format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as {
        continue?: { gsroffset?: number };
        query?: { pages?: Record<string, WikimediaPage> };
      };
    };

    try {
      let data = await runQuery(gsrsearch);
      if (!data.query?.pages && params.page === 1) {
        const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);
        if (tokens.length >= 2) {
          const relaxed = `${tokens[0]} ${tokens[tokens.length - 1]} histology -filetype:svg`;
          data = await runQuery(relaxed);
        }
      }

      const pagesObj = data.query?.pages;
      if (!pagesObj) {
        return {
          sourceId: 'wikimedia-commons',
          items: [],
          hasMore: false,
        };
      }

      const pages = Object.values(pagesObj).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const items: DiscoveredSlideItem[] = [];

      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;
        if (!info.mime || !info.mime.startsWith('image/') || info.mime.includes('svg')) continue;
        if ((info.width ?? 0) < 300 || (info.height ?? 0) < 200) continue;

        const rawTitle = page.title.replace(/^File:/i, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        if (
          /schematic|diagram|chart|flowchart|nordisk familjebok|popular science|^\d{3,4}\s+[A-Z]|\bpsm\s+v\d+|engraving|woodcut|187\d|188\d|189\d|190\d|191\d/i.test(
            rawTitle
          )
        ) {
          continue;
        }
        const meta = info.extmetadata ?? {};
        const description = stripHtml(meta.ImageDescription?.value) || rawTitle;
        const artist = stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value) || 'Wikimedia Contributor';
        if (
          /openstax|connexions|schematic|diagram|engraving|woodcut/i.test(
            `${description.slice(0, 220)} ${artist}`
          )
        ) {
          continue;
        }
        const license = stripHtml(meta.LicenseShortName?.value) || 'Creative Commons / Public Domain';
        const combinedText = `${rawTitle} ${description}`;
        const inferred = inferSystemAndOrgan(combinedText, params.system);
        const stain = inferStain(combinedText, params.stain !== 'all' ? params.stain : undefined);
        const magnification = inferMagnification(combinedText);

        // Build clean thumbnail vs high-res URLs
        const previewUrl = info.thumburl || info.url;
        const thumbUrl = previewUrl.includes('/1280px-')
          ? previewUrl.replace('/1280px-', '/480px-')
          : previewUrl;

        items.push({
          id: `wm-${page.pageid}`,
          sourceId: 'wikimedia-commons',
          sourceName: 'Wikimedia Commons',
          sourceInstitution: 'Wikimedia Commons (Open Access)',
          title: rawTitle,
          specimenName: rawTitle,
          organ: inferred.organ,
          anatomicalSystem: inferred.system,
          tissueType: cleanQuery,
          stain,
          magnification,
          description: description.slice(0, 320),
          thumbnailUrl: thumbUrl,
          imageUrl: previewUrl,
          highResUrl: info.mime === 'image/tiff' ? previewUrl : info.url,
          originalUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          license,
          attribution: `${artist} (${license}) via Wikimedia Commons`,
          width: info.width,
          height: info.height,
          directImportAllowed: true,
          tags: [stain.toLowerCase(), inferred.organ.toLowerCase(), 'wikimedia'].filter(Boolean),
        });
      }

      return {
        sourceId: 'wikimedia-commons',
        items,
        hasMore: Boolean(data.continue?.gsroffset),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return {
        sourceId: 'wikimedia-commons',
        items: [],
        hasMore: false,
        error: `Wikimedia Commons unavailable: ${msg}`,
      };
    }
  },
};
