import type { DiscoveredSlideItem, SlideSourceConnector, SourceDescriptor, SourceSearchParams } from './types.ts';

interface AtlasTopicEntry {
  title: string;
  organ: string;
  system: string;
  tissueType: string;
  stain: string;
  keywords: string[];
  features: string;
}

const ATLAS_REFERENCE_TOPICS: AtlasTopicEntry[] = [
  {
    title: 'Liver Lobule & Portal Triad',
    organ: 'Liver',
    system: 'Gastrointestinal System',
    tissueType: 'Hepatic parenchyma',
    stain: 'H&E',
    keywords: ['liver', 'hepatic', 'hepatocyte', 'portal triad', 'central vein', 'sinusoid', 'bile duct'],
    features: 'Hexagonal hepatic lobules with central vein, radiating cords of hepatocytes, and portal triads.',
  },
  {
    title: 'Renal Cortex, Glomerulus & Convoluted Tubules',
    organ: 'Kidney',
    system: 'Urinary System',
    tissueType: 'Renal cortex',
    stain: 'H&E / PAS',
    keywords: ['kidney', 'renal', 'cortex', 'glomerulus', 'bowman', 'pct', 'dct', 'pas', 'nephron'],
    features: 'Renal corpuscles with capillary glomeruli and Bowman space flanked by PAS-positive PCT brush borders.',
  },
  {
    title: 'Thyroid & Parathyroid Glands',
    organ: 'Thyroid Gland',
    system: 'Endocrine System',
    tissueType: 'Endocrine follicles',
    stain: 'H&E',
    keywords: ['thyroid', 'follicle', 'colloid', 'parathyroid', 'c cell', 'oxyphil'],
    features: 'Spherical follicles lined by simple cuboidal thyrocytes filled with eosinophilic thyroglobulin colloid.',
  },
  {
    title: 'Cardiac Muscle (Longitudinal & Intercalated Discs)',
    organ: 'Heart',
    system: 'Cardiovascular System',
    tissueType: 'Cardiac muscle',
    stain: 'H&E',
    keywords: ['heart', 'cardiac', 'muscle', 'myocardium', 'intercalated', 'longitudinal'],
    features: 'Branching striated cardiomyocytes with single central nuclei and perpendicular step-like intercalated discs.',
  },
  {
    title: 'Cerebellar Cortex, Spinal Cord & Peripheral Nerves',
    organ: 'Cerebellum / Spinal Cord / Nerve',
    system: 'Nervous System',
    tissueType: 'Central & peripheral nervous tissue',
    stain: 'H&E / Silver / Luxol Fast Blue',
    keywords: ['cerebellum', 'cerebellar', 'purkinje', 'granular', 'molecular', 'brain', 'nervous', 'spinal', 'cord', 'ganglion', 'peripheral nerve', 'myelin'],
    features: 'Three-layered cerebellar cortex, spinal cord anterior horn motor neurons, dorsal root ganglia, and myelinated nerve fascicles.',
  },
  {
    title: 'Elastic Cartilage (Epiglottis / Pinna)',
    organ: 'Epiglottis',
    system: 'Basic Tissues',
    tissueType: 'Elastic cartilage',
    stain: 'Verhoeff / Orcein / H&E',
    keywords: ['elastic', 'cartilage', 'epiglottis', 'ear', 'pinna', 'chondrocyte'],
    features: 'Chondrocytes in lacunae embedded in a matrix packed with dark-staining branching elastic fiber networks.',
  },
  {
    title: 'Small Intestine (Jejunum Villi & Goblet Cells)',
    organ: 'Small Intestine',
    system: 'Gastrointestinal System',
    tissueType: 'Simple columnar epithelium',
    stain: 'H&E / PAS',
    keywords: ['small intestine', 'jejunum', 'duodenum', 'ileum', 'villi', 'goblet', 'brush border', 'peyer', 'brunner'],
    features: 'Mucosal villi lined by absorptive enterocytes with microvillous brush border, goblet cells, and crypts of Lieberkühn.',
  },
  {
    title: 'Testis (Seminiferous Tubules & Leydig Cells)',
    organ: 'Testis',
    system: 'Reproductive System',
    tissueType: 'Spermatogenic epithelium',
    stain: 'H&E / PAS',
    keywords: ['testis', 'seminiferous', 'tubule', 'spermatogenesis', 'sertoli', 'leydig', 'epididymis'],
    features: 'Coiled seminiferous tubules showing spermatogonia to spermatozoa maturation plus interstitial Leydig cell clusters.',
  },
  {
    title: 'Lymph Node, Spleen & Thymus',
    organ: 'Lymph Node / Spleen / Thymus',
    system: 'Lymphatic & Immune System',
    tissueType: 'Lymphoid tissue',
    stain: 'H&E',
    keywords: ['lymph', 'node', 'spleen', 'thymus', 'tonsil', 'hassall', 'white pulp', 'germinal center', 'malt'],
    features: 'Lymphoid follicles with germinal centers, splenic PALS/red pulp, or thymic lobules with Hassall corpuscles.',
  },
  {
    title: 'Lung Alveoli, Bronchioles & Trachea',
    organ: 'Lung / Trachea',
    system: 'Respiratory System',
    tissueType: 'Respiratory mucosa & alveoli',
    stain: 'H&E',
    keywords: ['lung', 'alveoli', 'alveolar', 'bronchiole', 'bronchus', 'trachea', 'pneumocyte', 'respiratory'],
    features: 'Thin alveolar septa with Type I/II pneumocytes, smooth-muscle-ringed bronchioles, and tracheal cartilage.',
  },
  {
    title: 'Adrenal Gland & Pituitary Gland',
    organ: 'Adrenal / Pituitary',
    system: 'Endocrine System',
    tissueType: 'Endocrine parenchyma',
    stain: 'H&E',
    keywords: ['adrenal', 'pituitary', 'hypophysis', 'cortex', 'medulla', 'fasciculata', 'chromaffin'],
    features: 'Zoned lipid-rich adrenal cortex over chromaffin medulla, or anterior/posterior pituitary lobes.',
  },
  {
    title: 'Ovary, Uterus & Placenta',
    organ: 'Ovary / Uterus / Placenta',
    system: 'Reproductive System',
    tissueType: 'Female reproductive tract',
    stain: 'H&E',
    keywords: ['ovary', 'follicle', 'corpus luteum', 'uterus', 'endometrium', 'cervix', 'vagina', 'placenta', 'mammary'],
    features: 'Staged ovarian follicles, proliferative/secretory endometrial glands, or placental chorionic villi.',
  },
  {
    title: 'Eye (Cornea & Retina) and Inner Ear (Cochlea)',
    organ: 'Eye / Ear',
    system: 'Special Senses',
    tissueType: 'Sensory neuroepithelium',
    stain: 'H&E',
    keywords: ['eye', 'cornea', 'retina', 'optic', 'lens', 'cochlea', 'corti', 'ear'],
    features: '5-layered cornea, 10-layered retina, or cochlear scalae with the sensory Organ of Corti.',
  },
  {
    title: 'Compact Bone, Spongy Bone & Hyaline Cartilage',
    organ: 'Bone / Cartilage',
    system: 'Basic Tissues',
    tissueType: 'Skeletal connective tissue',
    stain: 'Ground / H&E',
    keywords: ['bone', 'compact', 'spongy', 'trabecular', 'osteon', 'haversian', 'marrow', 'cartilage', 'fibrocartilage'],
    features: 'Concentric Haversian osteons, anastomosing marrow-filled trabeculae, or hyaline/fibrocartilage matrix.',
  },
  {
    title: 'Elastic Artery (Aorta) & Muscular Artery',
    organ: 'Aorta / Arteries / Veins',
    system: 'Cardiovascular System',
    tissueType: 'Vascular wall',
    stain: 'H&E / Verhoeff',
    keywords: ['aorta', 'artery', 'arteriole', 'vein', 'venule', 'capillary', 'elastic', 'muscular', 'vascular'],
    features: 'Concentric wavy elastic lamellae in elastic arteries vs prominent internal elastic lamina in muscular arteries.',
  },
  {
    title: 'Pancreas, Stomach, Esophagus & Colon',
    organ: 'Pancreas / Stomach / Colon',
    system: 'Gastrointestinal System',
    tissueType: 'GI mucosa & glands',
    stain: 'H&E',
    keywords: ['pancreas', 'islets', 'stomach', 'fundus', 'pylorus', 'parietal', 'chief', 'esophagus', 'colon', 'rectum', 'salivary'],
    features: 'Pancreatic serous acini & pale islets, gastric parietal/chief cells, or goblet-rich colonic crypts.',
  },
];

function buildUniversityConnector(descriptor: SourceDescriptor): SlideSourceConnector {
  return {
    descriptor,
    async search(params: SourceSearchParams) {
      const q = params.query.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter((t) => t.length > 1);

      const matched = ATLAS_REFERENCE_TOPICS.filter((topic) => {
        if (params.system && params.system !== 'all' && topic.system !== params.system) {
          return false;
        }
        if (tokens.length === 0) return true;
        const haystack = `${topic.title} ${topic.organ} ${topic.system} ${topic.tissueType} ${topic.stain} ${topic.keywords.join(' ')}`.toLowerCase();
        return tokens.some((tok) => haystack.includes(tok));
      });

      const slice = matched.slice(0, 4);
      const items: DiscoveredSlideItem[] = slice.map((topic, idx) => ({
        id: `${descriptor.id}-${idx}-${topic.organ.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        sourceId: descriptor.id,
        sourceName: descriptor.shortName,
        sourceInstitution: descriptor.institution,
        title: `${topic.title} (${descriptor.shortName} Reference)`,
        specimenName: topic.title,
        organ: topic.organ,
        anatomicalSystem: topic.system,
        tissueType: topic.tissueType,
        stain: topic.stain,
        magnification: 'Virtual Slidebox',
        description: `${topic.features} Available on ${descriptor.name}. Direct automated image extraction is disabled to respect institutional educational licensing; open the original virtual microscope or save as an external reference.`,
        originalUrl: descriptor.baseUrl,
        license: 'Institutional Educational Resource (External Reference Only)',
        attribution: `${descriptor.institution} (${descriptor.baseUrl})`,
        directImportAllowed: false,
        importLimitation: descriptor.limitationNotice,
        tags: [topic.organ.toLowerCase(), descriptor.id, 'external-reference'],
      }));

      return {
        sourceId: descriptor.id,
        items,
        hasMore: false,
      };
    },
  };
}

export const universitySources: SlideSourceConnector[] = [
  buildUniversityConnector({
    id: 'histology-guide',
    name: 'Histology Guide Virtual Microscopy',
    shortName: 'Histology Guide',
    institution: 'Histology Guide (University Teaching Atlas)',
    baseUrl: 'https://histologyguide.com/slidebox/slidebox.html',
    kind: 'university-atlas',
    capabilities: {
      search: true,
      resultsListing: true,
      thumbnailPreview: false,
      directImport: false,
      imageMetadata: true,
      licenseInfo: true,
      tiledWsi: false,
    },
    limitationNotice:
      'No public open-access image API. Opens original slidebox on histologyguide.com or saves as an external study reference.',
  }),
  buildUniversityConnector({
    id: 'umich-histology',
    name: 'University of Michigan Histology',
    shortName: 'UMich Histology',
    institution: 'University of Michigan Medical School',
    baseUrl: 'https://histology.medicine.umich.edu/',
    kind: 'university-atlas',
    capabilities: {
      search: true,
      resultsListing: true,
      thumbnailPreview: false,
      directImport: false,
      imageMetadata: true,
      licenseInfo: true,
      tiledWsi: false,
    },
    limitationNotice:
      'Virtual whole-slide viewer hosted by UMich without a direct image export API. Open externally or save as a study reference.',
  }),
  buildUniversityConnector({
    id: 'uiowa-slidebox',
    name: 'University of Iowa Virtual Slidebox',
    shortName: 'UIowa Slidebox',
    institution: 'University of Iowa Carver College of Medicine',
    baseUrl: 'https://histology.medicine.uiowa.edu/',
    kind: 'university-atlas',
    capabilities: {
      search: true,
      resultsListing: true,
      thumbnailPreview: false,
      directImport: false,
      imageMetadata: true,
      licenseInfo: true,
      tiledWsi: false,
    },
    limitationNotice:
      'University of Iowa Virtual Slidebox may require direct browser/institutional access and does not permit automated bulk downloading.',
  }),
  buildUniversityConnector({
    id: 'ouhsc-histology',
    name: 'University of Oklahoma Histology Atlas',
    shortName: 'Oklahoma Histology',
    institution: 'University of Oklahoma Health Sciences Center',
    baseUrl: 'https://www.ouhsc.edu/',
    kind: 'university-atlas',
    capabilities: {
      search: true,
      resultsListing: true,
      thumbnailPreview: false,
      directImport: false,
      imageMetadata: true,
      licenseInfo: true,
      tiledWsi: false,
    },
    limitationNotice:
      'University portal reference without a public image search API. Open externally or attach a permitted local slide image.',
  }),
];
