import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'HistoAtlasLibraryBuilder/2.1 (Medical Histology Educational Atlas; https://commons.wikimedia.org)';

type CategoryBucket =
  | 'Basic Tissues'
  | 'Cardiovascular System'
  | 'Respiratory System'
  | 'Gastrointestinal Tract'
  | 'Liver, Gallbladder & Pancreas'
  | 'Urinary System'
  | 'Endocrine System'
  | 'Male Reproductive System'
  | 'Female Reproductive System'
  | 'Nervous System'
  | 'Lymphatic & Immune System'
  | 'Skin & Special Senses';

interface TargetCategoryConfig {
  bucket: CategoryBucket;
  anatomicalSystem: string;
  targetCount: number;
  categories: string[];
  searches: string[];
}

const TARGET_BUCKETS: TargetCategoryConfig[] = [
  {
    bucket: 'Basic Tissues',
    anatomicalSystem: 'Basic Tissues',
    targetCount: 58,
    categories: [
      'Category:Histology_of_human_hyaline_cartilage',
      'Category:Histology_of_elastic_cartilage',
      'Category:Histology_of_human_cartilage',
      'Category:Histology_of_human_bones',
      'Category:Histology_of_bone_marrow',
      'Category:Histology_of_adipose_tissue',
      'Category:Histology_of_brown_adipose_tissue',
      'Category:Histology_of_human_connective_tissues',
      'Category:Histology_of_dense_connective_tissues',
      'Category:Histology_of_loose_connective_tissue',
      'Category:Histology_of_tendon',
      'Category:Histology_of_human_skeletal_muscles',
      'Category:Histology_of_human_smooth_muscles',
      'Category:Histology_of_blood',
      'Category:Epithelium',
    ],
    searches: [
      'simple squamous epithelium histology micrograph',
      'simple cuboidal epithelium histology micrograph',
      'pseudostratified ciliated columnar epithelium histology',
      'transitional epithelium urothelium histology',
      'hyaline cartilage high mag',
      'elastic cartilage histology',
      'fibrocartilage histology',
      'compact bone osteon histology',
      'spongy bone trabeculae histology',
      'adipose tissue histology',
      'dense regular connective tissue tendon histology',
      'skeletal muscle histology',
      'smooth muscle histology',
      'peripheral blood smear leukocyte',
      'bone marrow megakaryocyte histology',
    ],
  },
  {
    bucket: 'Cardiovascular System',
    anatomicalSystem: 'Cardiovascular System',
    targetCount: 30,
    categories: [
      'Category:Histology_of_the_human_heart',
      'Category:Histology_of_heart',
      'Category:Histology_of_human_cardiac_muscles',
      'Category:Histology_of_aorta',
      'Category:Histology_of_arteries',
      'Category:Histology_of_veins',
      'Category:Histology_of_blood_vessels',
      'Category:Histology_of_Purkinje_fibers',
      'Category:Histology_of_sinoatrial_node',
      'Category:Histology_of_human_cardiovascular_system',
    ],
    searches: [
      'cardiac muscle high mag',
      'intercalated disc myocardium histology',
      'aorta elastic artery histology',
      'muscular artery histology',
      'arteriole venule histology',
      'vein tunica media histology',
      'purkinje fibers heart histology',
      'coronary artery histology',
      'endocardium epicardium histology',
    ],
  },
  {
    bucket: 'Respiratory System',
    anatomicalSystem: 'Respiratory System',
    targetCount: 30,
    categories: [
      'Category:Histology_of_trachea',
      'Category:Histology_of_bronchi',
      'Category:Histology_of_the_lung',
      'Category:Histology_of_lungs',
      'Category:Histology_of_lower_respiratory_tract',
      'Category:Histology_of_upper_respiratory_tract',
    ],
    searches: [
      'trachea histology epithelium',
      'lung alveoli histology',
      'bronchiole histology',
      'bronchus cartilage histology',
      'olfactory epithelium histology',
      'epiglottis elastic cartilage histology',
      'larynx histology',
      'normal lung high mag',
      'terminal bronchiole histology',
    ],
  },
  {
    bucket: 'Gastrointestinal Tract',
    anatomicalSystem: 'Gastrointestinal System',
    targetCount: 62,
    categories: [
      'Category:Histology_of_human_tongue',
      'Category:Histology_of_salivary_glands',
      'Category:Histology_of_submandibular_glands',
      'Category:Histology_of_human_esophagus',
      'Category:Histology_of_human_stomach',
      'Category:Histology_of_human_duodenum',
      'Category:Histology_of_human_jejunum',
      'Category:Histology_of_ileum',
      'Category:Histology_of_appendix',
      'Category:Histology_of_human_colon',
      'Category:Histology_of_human_rectum_and_anus',
      'Category:Histology_of_the_gastrointestinal_tract',
      'Category:Histology_of_Paneth_cells',
    ],
    searches: [
      'esophagus stratified squamous histology',
      'stomach parietal chief cells histology',
      'stomach pylorus histology',
      'duodenum brunner glands histology',
      'jejunum villi goblet cells histology',
      'ileum peyer patch histology',
      'colon crypts goblet cells high mag',
      'appendix histology lymphoid',
      'tongue papillae taste bud histology',
      'parotid gland histology',
      'submandibular gland histology',
      'sublingual gland histology',
      'rectum anal canal histology',
      'small intestine high mag',
    ],
  },
  {
    bucket: 'Liver, Gallbladder & Pancreas',
    anatomicalSystem: 'Gastrointestinal System',
    targetCount: 36,
    categories: [
      'Category:Histology_of_human_liver',
      'Category:Histology_of_liver',
      'Category:Histology_of_gallbladder',
      'Category:Histology_of_biliary_system',
      'Category:Histology_of_human_pancreas',
      'Category:Histology_of_human_accessory_digestive_glands',
    ],
    searches: [
      'liver lobule portal triad histology',
      'hepatocytes central vein high mag',
      'liver normal high mag',
      'gallbladder mucosa histology',
      'pancreas acini islet langerhans histology',
      'exocrine pancreas histology',
      'bile duct portal tract histology',
      'liver trichrome histology',
    ],
  },
  {
    bucket: 'Urinary System',
    anatomicalSystem: 'Urinary System',
    targetCount: 36,
    categories: [
      'Category:Histology_of_kidney',
      'Category:Histology_of_urinary_system',
      'Category:Histology_of_ureters',
      'Category:Histology_of_urinary_bladder',
      'Category:Histology_of_urothelium',
      'Category:Histology_of_the_vascular_system_of_kidneys',
    ],
    searches: [
      'kidney glomerulus high mag',
      'renal cortex proximal distal tubule histology',
      'bowman capsule glomerulus histology',
      'kidney medulla loop henle collecting duct histology',
      'glomerulus PAS histology',
      'ureter transitional epithelium histology',
      'urinary bladder urothelium histology',
      'juxtaglomerular apparatus histology',
    ],
  },
  {
    bucket: 'Endocrine System',
    anatomicalSystem: 'Endocrine System',
    targetCount: 30,
    categories: [
      'Category:Histology_of_thyroid',
      'Category:Histology_of_human_parathyroid',
      'Category:Histology_of_adrenal_glands',
      'Category:Histology_of_the_pituitary_gland',
      'Category:Histology_of_the_human_pineal_gland',
      'Category:Histology_of_endocrine_system',
    ],
    searches: [
      'thyroid gland follicles colloid high mag',
      'parathyroid gland chief oxyphil high mag',
      'adrenal gland cortex medulla high mag',
      'zona fasciculata adrenal histology',
      'pituitary gland anterior posterior histology',
      'adenohypophysis neurohypophysis histology',
      'pancreatic islet langerhans histology',
      'pineal gland histology',
    ],
  },
  {
    bucket: 'Male Reproductive System',
    anatomicalSystem: 'Reproductive System',
    targetCount: 26,
    categories: [
      'Category:Histology_of_seminiferous_tubule',
      'Category:Histology_of_testis',
      'Category:Histology_of_human_epididymis',
      'Category:Histology_of_vas_deferens',
      'Category:Histology_of_the_seminal_vesicles',
      'Category:Histology_of_prostate',
      'Category:Histology_of_bulbourethral_gland',
      'Category:Histology_of_male_reproductive_system',
    ],
    searches: [
      'testis seminiferous tubules high mag',
      'sertoli leydig cells testis histology',
      'epididymis stereocilia histology',
      'vas deferens histology',
      'prostate gland high mag',
      'seminal vesicle histology',
      'spermatogenesis histology',
    ],
  },
  {
    bucket: 'Female Reproductive System',
    anatomicalSystem: 'Reproductive System',
    targetCount: 30,
    categories: [
      'Category:Histology_of_human_ovary',
      'Category:Histology_of_ovary',
      'Category:Histology_of_fallopian_tube',
      'Category:Histology_of_human_uteruses',
      'Category:Normal_endometrium',
      'Category:Histology_of_cervix_uteri',
      'Category:Histology_of_human_vaginas',
      'Category:Histology_of_the_placenta',
      'Category:Normal_breast_histology',
      'Category:Histology_of_decidua',
    ],
    searches: [
      'ovary ovarian follicle histology',
      'corpus luteum ovary histology',
      'proliferative endometrium high mag',
      'secretory endometrium histology',
      'fallopian tube histology',
      'cervix squamocolumnar junction histology',
      'placenta chorionic villi high mag',
      'normal breast lobule histology',
    ],
  },
  {
    bucket: 'Nervous System',
    anatomicalSystem: 'Nervous System',
    targetCount: 30,
    categories: [
      'Category:Histology_of_human_cerebellum',
      'Category:Histology_of_cerebellum',
      'Category:Histology_of_human_brain',
      'Category:Histology_of_cerebrum',
      'Category:Histology_of_human_spinal_cord',
      'Category:Histology_of_spinal_cord',
      'Category:Histology_of_human_nerves',
      'Category:Histology_of_dorsal_root_ganglion',
      'Category:Histology_of_ganglia',
      'Category:Histology_of_white_matter',
    ],
    searches: [
      'cerebellum purkinje cell high mag',
      'cerebral cortex pyramidal neuron histology',
      'spinal cord motor neuron histology',
      'peripheral nerve cross section histology',
      'dorsal root ganglion histology',
      'choroid plexus histology',
      'hippocampus histology micrograph',
      'myelin luxol fast blue histology',
    ],
  },
  {
    bucket: 'Lymphatic & Immune System',
    anatomicalSystem: 'Lymphatic & Immune System',
    targetCount: 26,
    categories: [
      'Category:Histology_of_lymphatic_system',
      'Category:Histology_of_the_immune_system',
      'Category:Histology_of_human_spleen',
      'Category:Histology_of_spleen',
      'Category:Histology_of_thymus',
      'Category:Histology_of_the_adenoids',
    ],
    searches: [
      'lymph node germinal center high mag',
      'spleen white pulp red pulp high mag',
      'thymus hassall corpuscle high mag',
      'palatine tonsil crypts histology',
      'lymph node subcapsular sinus histology',
      'peyer patch lymphoid histology',
    ],
  },
  {
    bucket: 'Skin & Special Senses',
    anatomicalSystem: 'Special Senses',
    targetCount: 30,
    categories: [
      'Category:Histology_of_human_skin',
      'Category:Histology_of_skin',
      'Category:Histology_of_thick_skin',
      'Category:Histology_of_thin_skin',
      'Category:Histology_of_hair_follicle',
      'Category:Histology_of_sebaceous_gland',
      'Category:Histology_of_sweat_glands',
      'Category:Histology_of_the_cornea',
      'Category:Histology_of_the_human_retina',
      'Category:Histology_of_the_human_eye',
      'Category:Histology_of_the_ears',
    ],
    searches: [
      'thick skin epidermis stratum corneum histology',
      'thin skin hair follicle sebaceous gland histology',
      'pacinian corpuscle meissner corpuscle histology',
      'cornea layers histology micrograph',
      'retina layers histology micrograph',
      'organ of corti cochlea histology',
      'eccrine sweat gland skin histology',
      'eye lens iris ciliary body histology',
    ],
  },
];

const REJECT_TITLE_RE =
  /schematic|diagram|chart|graph|logo|map|portrait|drawing|sketch|illustration|icon|flowchart|meme|banner|cover|anatomy_of|location_of|gray\d+|muscular_system|skeleton|organ_system_diagram|poster|infographic|slide_box|microscope_photo|camera|building|university|campus|person|scientist|doctor|professor|nordisk familjebok|compendium of histology|popular science|^\d{3,4}\s+[A-Z]|\bpsm\s+v\d+|187\d|188\d|189\d|190\d|191\d|meyers|brockhaus|engraving|woodcut|deroceras|snail|slug|plant|botany|leaf|moss|fungus|insect|beetle|bbs organs|carcinoma|adenocarcinoma|sarcoma|melanoma|lymphoma|leukemia|neoplasm|\btumor\b|\bgist\b|\bnevus\b|metasta/i;

const REJECT_DESC_RE =
  /schematic|diagram|flowchart|cartoon|engraving|woodcut|nordisk familjebok|popular science monthly|openstax|connexions|drawing of|illustration of|plate from/i;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(input?: string): string {
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

function inferStain(text: string): string {
  const lower = text.toLowerCase();
  if (/\bh\s*&\s*e\b|hematoxylin|haematoxylin|\bhe\b/.test(lower)) return 'H&E';
  if (/\bpas\b|periodic acid/.test(lower)) return 'PAS';
  if (/trichrome|masson/.test(lower)) return "Masson's Trichrome";
  if (/giemsa|wright/.test(lower)) return 'Wright-Giemsa';
  if (/silver|reticulin|golgi|jones/.test(lower)) return 'Silver Stain';
  if (/luxol/.test(lower)) return 'Luxol Fast Blue';
  if (/toluidine/.test(lower)) return 'Toluidine Blue';
  if (/alcian/.test(lower)) return 'Alcian Blue';
  if (/verhoeff|orcein|van gieson|elastic stain/.test(lower)) return 'Elastic Stain';
  if (/nissl|cresyl/.test(lower)) return 'Nissl / Cresyl Violet';
  if (/ihc|immunohistochem|cd\d+|ki-?67|p53/.test(lower)) return 'Immunohistochemistry';
  return 'Light Microscopy';
}

function inferMagnification(text: string): string {
  const match = text.match(/\b(20|40|100|200|400|600|1000)\s*[x×]\b/i);
  if (match) return `${match[1]}×`;
  if (/very\s*high\s*mag/i.test(text)) return '400×';
  if (/high\s*mag|high\s*power/i.test(text)) return '400×';
  if (/intermed\s*mag|medium\s*mag/i.test(text)) return '200×';
  if (/low\s*mag|low\s*power/i.test(text)) return '100×';
  return '200×';
}

function inferOrganFromTitle(title: string, fallback: string): string {
  const cleaned = title.split(/[-–—:(]/)[0].trim();
  if (cleaned.length >= 3 && cleaned.length <= 42) return cleaned;
  return fallback;
}

interface WikimediaImageInfo {
  size?: number;
  width?: number;
  height?: number;
  mime?: string;
  sha1?: string;
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: {
    LicenseShortName?: { value?: string };
    Artist?: { value?: string };
    Credit?: { value?: string };
    ImageDescription?: { value?: string };
  };
}

interface WikimediaPage {
  pageid: number;
  title: string;
  index?: number;
  imageinfo?: WikimediaImageInfo[];
}

async function fetchJsonWithRetry(url: string, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      await sleep(90);
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      const text = await res.text();
      if (res.status === 429 || res.status === 503 || text.startsWith('You are making too many')) {
        if (attempt < retries) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return JSON.parse(text);
    } catch {
      if (attempt < retries) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function fetchWikimediaCategoryImages(categoryTitle: string, limit = 45): Promise<WikimediaPage[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'categorymembers');
  url.searchParams.set('gcmtitle', categoryTitle);
  url.searchParams.set('gcmtype', 'file');
  url.searchParams.set('gcmlimit', String(limit));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime|sha1');
  url.searchParams.set('iiurlwidth', '1280');
  url.searchParams.set('format', 'json');

  const data = (await fetchJsonWithRetry(url.toString())) as {
    query?: { pages?: Record<string, WikimediaPage> };
  } | null;
  if (!data?.query?.pages) return [];
  return Object.values(data.query.pages);
}

async function fetchWikimediaSubcategories(categoryTitle: string): Promise<string[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'categorymembers');
  url.searchParams.set('cmtitle', categoryTitle);
  url.searchParams.set('cmtype', 'subcat');
  url.searchParams.set('cmlimit', '25');
  url.searchParams.set('format', 'json');

  const data = (await fetchJsonWithRetry(url.toString())) as {
    query?: { categorymembers?: Array<{ title: string }> };
  } | null;
  return (data?.query?.categorymembers ?? [])
    .map((m) => m.title)
    .filter(
      (t) =>
        !/svg|video|3d|histopatholog|carcinoma|tumor|cancer|adenocarcinoma|diagram|drawing|18\d\d|animal|plant/i.test(
          t
        )
    );
}

async function fetchWikimediaSearch(query: string, limit = 20): Promise<WikimediaPage[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', `${query} -filetype:svg`);
  url.searchParams.set('gsrlimit', String(limit));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime|sha1');
  url.searchParams.set('iiurlwidth', '1280');
  url.searchParams.set('format', 'json');

  const data = (await fetchJsonWithRetry(url.toString())) as {
    query?: { pages?: Record<string, WikimediaPage> };
  } | null;
  if (!data?.query?.pages) return [];
  return Object.values(data.query.pages).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

interface OpenverseResult {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  provider?: string;
  width?: number;
  height?: number;
}

async function fetchOpenverseSearch(query: string, limit = 12): Promise<OpenverseResult[]> {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('license', 'cc0,pdm,by,by-sa,by-nc,by-nc-sa');

  const data = (await fetchJsonWithRetry(url.toString(), 2)) as {
    results?: OpenverseResult[];
  } | null;
  return data?.results ?? [];
}

async function verifyImageUrlHead(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (res.status === 429 || res.status === 503) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (res.status === 405) {
        const getCtrl = new AbortController();
        const getTimeout = setTimeout(() => getCtrl.abort(), 5000);
        try {
          const getRes = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1024' },
            signal: getCtrl.signal,
          });
          const ct = getRes.headers.get('content-type') || '';
          return getRes.ok && ct.startsWith('image/');
        } finally {
          clearTimeout(getTimeout);
        }
      }
      if (!res.ok) return false;
      const ct = res.headers.get('content-type') || '';
      return ct.startsWith('image/');
    } catch {
      if (attempt < 1) {
        await sleep(500);
        continue;
      }
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

interface RawCandidate {
  id: string;
  chapter: CategoryBucket;
  title: string;
  specimen: string;
  organ: string;
  anatomicalSystem: string;
  tissueType: string;
  stain: string;
  magnification: string;
  fieldWidthUm: number;
  imageUrl: string;
  thumbnailUrl: string;
  highResUrl: string;
  fallbackOriginalUrl?: string;
  overviewNotes: string;
  sourceInstitution: string;
  sourceId: string;
  originalSourceUrl: string;
  license: string;
  attribution: string;
  importStatus: 'imported';
  tags: string[];
  createdAt: number;
}

async function main() {
  const seenPageIds = new Set<number>();
  const seenSha1 = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  const existingDefaultTitles = new Set([
    'Trachea: Respiratory Epithelium',
    'Small Intestine: Absorptive Villi',
    'Thick Skin: Keratinized Epidermis',
    'Hyaline Cartilage & Perichondrium',
    'Compact Bone: Haversian Osteons',
    'Cardiac Muscle: Myocardium',
    'Skeletal Muscle Fascicle Architecture',
    'Smooth Muscle & Myenteric Plexus',
    'Cerebellar Cortex: Three Layers',
    'Peripheral Nerve: Fascicles & Myelin',
    'Kidney: Renal Cortex & Corpuscle',
  ]);

  let rejectedCount = 0;
  let duplicateCount = 0;

  const candidatesByBucket = new Map<CategoryBucket, RawCandidate[]>();
  for (const cfg of TARGET_BUCKETS) {
    candidatesByBucket.set(cfg.bucket, []);
  }

  const addWikimediaPages = (
    cfg: TargetCategoryConfig,
    pages: WikimediaPage[],
    maxForBucket: number,
    maxPerCall = maxForBucket
  ) => {
    const bucketList = candidatesByBucket.get(cfg.bucket)!;
    let addedHere = 0;
    for (const page of pages) {
      if (bucketList.length >= maxForBucket || addedHere >= maxPerCall) break;
      if (seenPageIds.has(page.pageid)) {
        duplicateCount++;
        continue;
      }

      const info = page.imageinfo?.[0];
      if (!info || !info.url) {
        rejectedCount++;
        continue;
      }
      if (!info.mime || !info.mime.startsWith('image/') || info.mime.includes('svg')) {
        rejectedCount++;
        continue;
      }
      if ((info.width ?? 0) < 320 || (info.height ?? 0) < 220) {
        rejectedCount++;
        continue;
      }

      const cleanTitle = page.title
        .replace(/^File:/i, '')
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanTitle || cleanTitle.length < 4 || REJECT_TITLE_RE.test(cleanTitle)) {
        rejectedCount++;
        continue;
      }
      if (existingDefaultTitles.has(cleanTitle)) {
        duplicateCount++;
        continue;
      }

      const titleKey = cleanTitle.toLowerCase();
      if (seenTitles.has(titleKey)) {
        duplicateCount++;
        continue;
      }
      if (info.sha1 && seenSha1.has(info.sha1)) {
        duplicateCount++;
        continue;
      }

      const previewUrl =
        info.mime === 'image/tiff' ? info.thumburl || '' : info.thumburl || info.url;
      if (!previewUrl || !previewUrl.startsWith('https://')) {
        rejectedCount++;
        continue;
      }
      if (seenUrls.has(previewUrl)) {
        duplicateCount++;
        continue;
      }

      const meta = info.extmetadata ?? {};
      const desc = stripHtml(meta.ImageDescription?.value);
      const artist =
        stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value) || 'Wikimedia Contributor';
      if (
        (desc && REJECT_DESC_RE.test(desc.slice(0, 260))) ||
        /openstax/i.test(artist)
      ) {
        rejectedCount++;
        continue;
      }

      const license =
        stripHtml(meta.LicenseShortName?.value) || 'Creative Commons / Public Domain';
      const combined = `${cleanTitle} ${desc}`;
      const stain = inferStain(combined);
      const magnification = inferMagnification(combined);
      const thumbUrl = previewUrl.includes('/1280px-')
        ? previewUrl.replace('/1280px-', '/480px-')
        : previewUrl;

      seenPageIds.add(page.pageid);
      if (info.sha1) seenSha1.add(info.sha1);
      seenUrls.add(previewUrl);
      seenTitles.add(titleKey);
      addedHere++;

      bucketList.push({
        id: `slide-wm-${page.pageid}`,
        chapter: cfg.bucket,
        title: cleanTitle,
        specimen: cleanTitle,
        organ: inferOrganFromTitle(cleanTitle, cfg.bucket),
        anatomicalSystem: cfg.anatomicalSystem,
        tissueType: cfg.bucket,
        stain,
        magnification,
        fieldWidthUm: 450,
        imageUrl: previewUrl,
        thumbnailUrl: thumbUrl,
        highResUrl: info.mime === 'image/tiff' ? previewUrl : info.url,
        fallbackOriginalUrl:
          info.mime !== 'image/tiff' && info.url !== previewUrl ? info.url : undefined,
        overviewNotes:
          desc.slice(0, 420) ||
          `${cleanTitle} (${stain}). Open-access microscopy slide acquired from Wikimedia Commons.`,
        sourceInstitution: 'Wikimedia Commons (Open Access)',
        sourceId: `wm-${page.pageid}`,
        originalSourceUrl:
          info.descriptionurl ||
          `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        license,
        attribution: `${artist} (${license}) via Wikimedia Commons`,
        importStatus: 'imported',
        tags: [cfg.bucket.toLowerCase(), stain.toLowerCase(), 'wikimedia'],
        createdAt: 1700010000000 + seenPageIds.size,
      });
    }
  };

  console.log('Starting automated histology slide acquisition...');

  for (const cfg of TARGET_BUCKETS) {
    const bucketList = candidatesByBucket.get(cfg.bucket)!;
    console.log(`\nCollecting for [${cfg.bucket}] (target ${cfg.targetCount})...`);

    const cachedPages: WikimediaPage[] = [];
    const perCatQuota = Math.max(3, Math.floor(cfg.targetCount / Math.max(4, cfg.categories.length)));
    const perSearchQuota = Math.max(2, Math.floor(cfg.targetCount / Math.max(4, cfg.searches.length)));

    // Pass 1: Direct files from each specific organ category (polite sequential calls)
    for (const cat of cfg.categories) {
      if (bucketList.length >= cfg.targetCount) break;
      const directPages = await fetchWikimediaCategoryImages(cat, 30);
      cachedPages.push(...directPages);
      addWikimediaPages(cfg, directPages, cfg.targetCount, perCatQuota);
    }

    // Pass 2: Spread across search queries (guarantees cerebellum, tonsil, retina, cochlea, etc.)
    for (const query of cfg.searches) {
      if (bucketList.length >= cfg.targetCount) break;
      const searchPages = await fetchWikimediaSearch(query, 14);
      cachedPages.push(...searchPages);
      addWikimediaPages(cfg, searchPages, cfg.targetCount, perSearchQuota);
    }

    // Pass 3: Subcategories (capped at first 4 categories) if still below target
    if (bucketList.length < cfg.targetCount) {
      for (const cat of cfg.categories.slice(0, 4)) {
        if (bucketList.length >= cfg.targetCount) break;
        const subcats = await fetchWikimediaSubcategories(cat);
        for (const sub of subcats.slice(0, 2)) {
          if (bucketList.length >= cfg.targetCount) break;
          const subPages = await fetchWikimediaCategoryImages(sub, 20);
          cachedPages.push(...subPages);
          addWikimediaPages(cfg, subPages, cfg.targetCount, 4);
        }
      }
    }

    // Pass 4: Top up from already-fetched pages if still under target
    if (bucketList.length < cfg.targetCount && cachedPages.length > 0) {
      addWikimediaPages(cfg, cachedPages, cfg.targetCount);
    }

    if (bucketList.length < cfg.targetCount) {
      for (const query of cfg.searches.slice(0, 4)) {
        if (bucketList.length >= cfg.targetCount) break;
        const ovResults = await fetchOpenverseSearch(query, 12);
        for (const item of ovResults) {
          if (bucketList.length >= cfg.targetCount) break;
          if (!item.url || !item.url.startsWith('https://') || !item.foreign_landing_url) {
            rejectedCount++;
            continue;
          }
          if (item.url.toLowerCase().endsWith('.svg')) {
            rejectedCount++;
            continue;
          }
          if ((item.width ?? 400) < 300 || (item.height ?? 300) < 220) {
            rejectedCount++;
            continue;
          }
          const cleanTitle = (item.title || '').trim();
          if (!cleanTitle || cleanTitle.length < 4 || REJECT_TITLE_RE.test(cleanTitle)) {
            rejectedCount++;
            continue;
          }
          const titleKey = cleanTitle.toLowerCase();
          if (seenUrls.has(item.url) || seenTitles.has(titleKey)) {
            duplicateCount++;
            continue;
          }

          seenUrls.add(item.url);
          seenTitles.add(titleKey);
          const licenseLabel = item.license
            ? `CC ${item.license.toUpperCase()} ${item.license_version ?? ''}`.trim()
            : 'Creative Commons';
          const creator = item.creator?.trim() || 'Openverse Contributor';
          const stain = inferStain(cleanTitle);

          bucketList.push({
            id: `slide-ov-${item.id}`,
            chapter: cfg.bucket,
            title: cleanTitle,
            specimen: cleanTitle,
            organ: inferOrganFromTitle(cleanTitle, cfg.bucket),
            anatomicalSystem: cfg.anatomicalSystem,
            tissueType: cfg.bucket,
            stain,
            magnification: inferMagnification(cleanTitle),
            fieldWidthUm: 450,
            imageUrl: item.url,
            thumbnailUrl: item.thumbnail || item.url,
            highResUrl: item.url,
            overviewNotes: `${cleanTitle}. Licensed under ${licenseLabel} by ${creator}.`,
            sourceInstitution: `${item.provider || 'Openverse'} (Open Access)`,
            sourceId: `ov-${item.id}`,
            originalSourceUrl: item.foreign_landing_url,
            license: licenseLabel,
            attribution: `${creator} (${licenseLabel}) via Openverse`,
            importStatus: 'imported',
            tags: [cfg.bucket.toLowerCase(), stain.toLowerCase(), 'openverse'],
            createdAt: 1700020000000 + seenUrls.size,
          });
        }
      }
    }

    console.log(`  -> Collected ${bucketList.length} candidates for ${cfg.bucket}`);
  }

  const allCandidates = TARGET_BUCKETS.flatMap((cfg) => candidatesByBucket.get(cfg.bucket)!);
  console.log(`\nValidating ${allCandidates.length} image URLs politely via live HTTP HEAD checks...`);

  const verifiedSlides: Omit<RawCandidate, 'fallbackOriginalUrl'>[] = [];
  let headFailures = 0;
  const CONCURRENCY = 6;

  for (let i = 0; i < allCandidates.length; i += CONCURRENCY) {
    const batch = allCandidates.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(
      batch.map(async (slide) => {
        let ok = await verifyImageUrlHead(slide.imageUrl);
        const finalSlide = { ...slide };
        if (!ok && slide.fallbackOriginalUrl) {
          const origOk = await verifyImageUrlHead(slide.fallbackOriginalUrl);
          if (origOk) {
            ok = true;
            finalSlide.imageUrl = slide.fallbackOriginalUrl;
            finalSlide.thumbnailUrl = slide.fallbackOriginalUrl;
          }
        }
        return { slide: finalSlide, ok };
      })
    );

    for (const { slide, ok } of checks) {
      if (ok) {
        const { fallbackOriginalUrl: _drop, ...cleanSlide } = slide;
        verifiedSlides.push(cleanSlide);
      } else {
        headFailures++;
      }
    }

    if (i > 0 && i % 60 === 0) {
      console.log(`  Verified ${Math.min(i + CONCURRENCY, allCandidates.length)}/${allCandidates.length} (${verifiedSlides.length} passed)...`);
    }
    await sleep(90);
  }

  const outPath = path.resolve(__dirname, '../src/data/populatedSlides.json');
  fs.writeFileSync(outPath, JSON.stringify(verifiedSlides, null, 2), 'utf-8');

  console.log('\n=== ACQUISITION SUMMARY ===');
  for (const cfg of TARGET_BUCKETS) {
    const count = verifiedSlides.filter((s) => s.chapter === cfg.bucket).length;
    console.log(`  ${cfg.bucket}: ${count} verified slides`);
  }
  console.log(`Total verified slides written: ${verifiedSlides.length}`);
  console.log(`Rejected (non-image/diagram/small): ${rejectedCount}`);
  console.log(`Duplicates skipped: ${duplicateCount}`);
  console.log(`Failed HTTP HEAD validation: ${headFailures}`);
  console.log(`Output written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Population script failed:', err);
  process.exit(1);
});
