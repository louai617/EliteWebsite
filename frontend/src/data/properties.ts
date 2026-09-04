/**
 * Shared property dataset.
 *
 * Phase 1 runs without the API, so this is the single source of truth for both
 * the listing grid and the detail page. Field names mirror the Mongo schema the
 * backend used, so swapping this for a real fetch later is a drop-in change.
 *
 * Free-text lives in both languages; fixed vocabulary (amenities, place types)
 * uses translation keys so it stays translatable.
 */

export type Purpose = 'sale' | 'rent';
export type Completion = 'ready' | 'offplan';
export type Furnishing = 'furnished' | 'semi_furnished' | 'unfurnished';
export type Ownership = 'freehold' | 'leasehold' | 'usufruct';

export interface PricePoint {
  /** Short month label, e.g. "Sep 25" */
  label: string;
  /** QAR per m² for this community */
  community: number;
  /** QAR per m² for the wider city */
  city: number;
}

export interface NearbyPlace {
  /** i18n key under `property.place` */
  category: 'school' | 'mall' | 'beach' | 'airport' | 'hospital' | 'metro' | 'landmark';
  name_en: string;
  name_ar: string;
  minutes: number;
  mode: 'drive' | 'walk';
}

export interface PaymentMilestone {
  /** i18n key under `property.milestone` */
  key: 'booking' | 'construction' | 'handover' | 'post_handover';
  percent: number;
  /** Free-text timing, e.g. "On booking" / "Over 36 months" */
  timing_en: string;
  timing_ar: string;
}

export interface Agent {
  full_name_en: string;
  full_name_ar: string;
  title_en: string;
  title_ar: string;
  phone: string;
  whatsapp: string;
  email: string;
  photo: string;
  /** i18n keys under `property.language` */
  languages: Array<'en' | 'ar' | 'fr' | 'hi'>;
  response_minutes: number;
  listings_count: number;
  is_superagent: boolean;
  agency_name_en: string;
  agency_name_ar: string;
  agency_listings: number;
  verified_agents: number;
}

export interface Property {
  _id: string;
  reference_number: string;

  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;

  /** i18n key under `property.type` */
  type: 'apartment' | 'villa' | 'penthouse' | 'townhouse';
  purpose: Purpose;

  price: number;
  currency: string;
  /** Rentals only — i18n key under `property.frequency` */
  price_frequency?: 'year' | 'month';

  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  plot_sqm?: number;
  floor?: number;
  total_floors?: number;
  parking: number;

  furnishing: Furnishing;
  completion: Completion;
  ownership: Ownership;
  /** ISO date */
  available_from: string;
  handover?: string;
  developer_en?: string;
  developer_ar?: string;
  year_built?: number;
  /** QAR per m² per year */
  service_charge_sqm?: number;

  location: {
    city_en: string;
    city_ar: string;
    area_en: string;
    area_ar: string;
    community_en: string;
    community_ar: string;
    address_en: string;
    address_ar: string;
    lat: number;
    lng: number;
  };

  /** i18n keys under `property.amenity` */
  amenities: string[];
  /** i18n keys under `property.highlight` */
  highlights: string[];

  images: string[];
  floor_plan?: string;

  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  listed_days_ago: number;

  agent: Agent;

  market: {
    /** Average sale/rent price for comparable units in this community */
    avg_price: number;
    /** Average size in m² for comparable units */
    avg_size_sqm: number;
    /** Total live listings in this community */
    community_listings: number;
    /** Buildings in the community */
    community_buildings: number;
    price_history: PricePoint[];
  };

  nearby: NearbyPlace[];
  payment_plan?: PaymentMilestone[];
}

const PEARL_HISTORY: PricePoint[] = [
  { label: 'Sep 25', community: 19_200, city: 12_400 },
  { label: 'Nov 25', community: 19_650, city: 12_500 },
  { label: 'Jan 26', community: 20_100, city: 12_450 },
  { label: 'Mar 26', community: 20_780, city: 12_700 },
  { label: 'May 26', community: 21_240, city: 12_900 },
  { label: 'Jul 26', community: 21_620, city: 13_050 },
  { label: 'Aug 26', community: 21_890, city: 13_120 },
];

const LAGOON_HISTORY: PricePoint[] = [
  { label: 'Sep 25', community: 17_400, city: 12_400 },
  { label: 'Nov 25', community: 17_900, city: 12_500 },
  { label: 'Jan 26', community: 18_050, city: 12_450 },
  { label: 'Mar 26', community: 18_400, city: 12_700 },
  { label: 'May 26', community: 18_760, city: 12_900 },
  { label: 'Jul 26', community: 18_980, city: 13_050 },
  { label: 'Aug 26', community: 19_100, city: 13_120 },
];

const LUSAIL_SALE_HISTORY: PricePoint[] = [
  { label: 'Sep 25', community: 14_100, city: 12_400 },
  { label: 'Nov 25', community: 14_450, city: 12_500 },
  { label: 'Jan 26', community: 14_900, city: 12_450 },
  { label: 'Mar 26', community: 15_380, city: 12_700 },
  { label: 'May 26', community: 15_720, city: 12_900 },
  { label: 'Jul 26', community: 16_050, city: 13_050 },
  { label: 'Aug 26', community: 16_400, city: 13_120 },
];

/** Rent series, in QAR per m² per YEAR — not comparable to the sale series above. */
const LUSAIL_RENT_HISTORY: PricePoint[] = [
  { label: 'Sep 25', community: 1_205, city: 1_040 },
  { label: 'Nov 25', community: 1_238, city: 1_052 },
  { label: 'Jan 26', community: 1_260, city: 1_047 },
  { label: 'Mar 26', community: 1_284, city: 1_068 },
  { label: 'May 26', community: 1_301, city: 1_085 },
  { label: 'Jul 26', community: 1_312, city: 1_096 },
  { label: 'Aug 26', community: 1_325, city: 1_104 },
];

export const properties: Property[] = [
  {
    _id: '1',
    reference_number: 'ELT-00123',
    title_en: 'Luxury 3BR Apartment in The Pearl',
    title_ar: 'شقة فاخرة 3 غرف في اللؤلؤة',
    description_en:
      'A rare corner residence on the upper floors of Porto Arabia, framing an uninterrupted marina view through floor-to-ceiling glass across the full length of the living space.\n\nThe layout separates the entertaining wing from the bedrooms, so guests never cross the private corridor. The kitchen is fully fitted with Gaggenau appliances and opens onto a breakfast terrace facing the water.\n\nAll three bedrooms are en-suite. The principal suite adds a walk-in dressing room and a marble bathroom with a freestanding tub positioned to the view. A separate maid\'s room with its own bathroom sits off the utility corridor.\n\nThe building offers concierge, valet parking, a temperature-controlled pool, and direct access to the Porto Arabia boardwalk with its restaurants and boutiques.',
    description_ar:
      'شقة زاوية نادرة في الطوابق العليا من بورتو أرابيا، تطل على مشهد بحري متصل عبر واجهة زجاجية ممتدة من الأرض حتى السقف على طول المساحة المعيشية بالكامل.\n\nيفصل التصميم جناح الاستقبال عن غرف النوم، بحيث لا يمر الضيوف عبر الممر الخاص. المطبخ مجهز بالكامل بأجهزة Gaggenau ويفتح على شرفة إفطار مطلة على الماء.\n\nجميع غرف النوم الثلاث بحمامات خاصة. يضيف الجناح الرئيسي غرفة ملابس واسعة وحماماً رخامياً مع حوض استحمام قائم بذاته موجه نحو الإطلالة. كما تتوفر غرفة خادمة منفصلة بحمام خاص.\n\nيوفر المبنى خدمة كونسيرج، وركن سيارات، ومسبحاً بدرجة حرارة متحكم بها، ووصولاً مباشراً إلى ممشى بورتو أرابيا بمطاعمه ومتاجره.',
    type: 'apartment',
    purpose: 'sale',
    price: 4_500_000,
    currency: 'QAR',
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 210,
    floor: 14,
    total_floors: 18,
    parking: 2,
    furnishing: 'furnished',
    completion: 'ready',
    ownership: 'freehold',
    available_from: '2026-09-15',
    year_built: 2019,
    service_charge_sqm: 78,
    developer_en: 'United Development Company',
    developer_ar: 'الشركة المتحدة للتنمية',
    location: {
      city_en: 'Doha',
      city_ar: 'الدوحة',
      area_en: 'The Pearl',
      area_ar: 'اللؤلؤة',
      community_en: 'Porto Arabia',
      community_ar: 'بورتو أرابيا',
      address_en: 'Tower 12, East Porto Drive, Porto Arabia, The Pearl Island, Doha',
      address_ar: 'برج 12، شارع بورتو الشرقي، بورتو أرابيا، جزيرة اللؤلؤة، الدوحة',
      lat: 25.3703,
      lng: 51.5453,
    },
    amenities: [
      'balcony',
      'built_in_wardrobes',
      'central_ac',
      'covered_parking',
      'shared_pool',
      'security',
      'concierge',
      'shared_gym',
      'walk_in_closet',
      'maid_room',
      'sea_view',
      'kitchen_appliances',
      'pets_allowed',
      'beach_access',
    ],
    highlights: ['corner_unit', 'marina_view', 'upper_floor', 'title_deed'],
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1600&auto=format&fit=crop',
    ],
    is_featured: true,
    is_verified: true,
    is_exclusive: true,
    listed_days_ago: 3,
    agent: {
      full_name_en: 'Layla Al-Mansouri',
      full_name_ar: 'ليلى المنصوري',
      title_en: 'Senior Property Consultant',
      title_ar: 'مستشارة عقارية أولى',
      phone: '+974 4444 8888',
      whatsapp: '97444448888',
      email: 'layla@elitere.qa',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
      languages: ['en', 'ar', 'fr'],
      response_minutes: 4,
      listings_count: 63,
      is_superagent: true,
      agency_name_en: 'ELITE Real Estate',
      agency_name_ar: 'إيليت العقارية',
      agency_listings: 412,
      verified_agents: 18,
    },
    market: {
      avg_price: 2_980_000,
      avg_size_sqm: 168,
      community_listings: 3_216,
      community_buildings: 135,
      price_history: PEARL_HISTORY,
    },
    nearby: [
      { category: 'beach', name_en: 'Porto Arabia Beach', name_ar: 'شاطئ بورتو أرابيا', minutes: 4, mode: 'walk' },
      { category: 'mall', name_en: 'Place Vendôme Mall', name_ar: 'مول بلاس فاندوم', minutes: 14, mode: 'drive' },
      { category: 'school', name_en: 'Doha British School', name_ar: 'مدرسة الدوحة البريطانية', minutes: 12, mode: 'drive' },
      { category: 'landmark', name_en: 'Katara Cultural Village', name_ar: 'قرية كتارا الثقافية', minutes: 12, mode: 'drive' },
      { category: 'hospital', name_en: 'Al Ahli Hospital', name_ar: 'مستشفى الأهلي', minutes: 16, mode: 'drive' },
      { category: 'airport', name_en: 'Hamad International Airport', name_ar: 'مطار حمد الدولي', minutes: 25, mode: 'drive' },
    ],
  },

  {
    _id: '2',
    reference_number: 'ELT-00124',
    title_en: 'Modern Villa with Private Pool',
    title_ar: 'فيلا حديثة مع مسبح خاص',
    description_en:
      'A newly completed villa on a corner plot in West Bay Lagoon, arranged around a private courtyard pool that the ground floor opens onto on three sides.\n\nThe ground level holds a double-height reception, a formal majlis with its own entrance, a family living room, and a kitchen with a separate preparation wing. Service quarters and a two-car garage are accessed independently of the main house.\n\nUpstairs, five en-suite bedrooms open onto a shared terrace. The principal suite occupies the full width of the rear elevation, with dual dressing rooms and a private balcony over the pool.\n\nThe plot is fully landscaped with mature planting, an irrigation system, and a shaded outdoor dining pavilion.',
    description_ar:
      'فيلا حديثة الإنجاز على قطعة أرض زاوية في لؤلؤة الخليج الغربي، مصممة حول مسبح داخلي خاص تنفتح عليه الطوابق الأرضية من ثلاث جهات.\n\nيضم الطابق الأرضي صالة استقبال مزدوجة الارتفاع، ومجلساً رسمياً بمدخل خاص، وغرفة معيشة عائلية، ومطبخاً بجناح تحضير منفصل. أما أماكن الخدمة والكراج المزدوج فلها مدخل مستقل عن المنزل الرئيسي.\n\nفي الطابق العلوي، تنفتح خمس غرف نوم بحمامات خاصة على شرفة مشتركة. ويشغل الجناح الرئيسي كامل عرض الواجهة الخلفية، مع غرفتي ملابس وشرفة خاصة تطل على المسبح.\n\nالأرض منسقة بالكامل بأشجار ناضجة ونظام ري ومظلة طعام خارجية.',
    type: 'villa',
    purpose: 'sale',
    price: 8_500_000,
    currency: 'QAR',
    bedrooms: 5,
    bathrooms: 6,
    area_sqm: 450,
    plot_sqm: 620,
    total_floors: 2,
    parking: 4,
    furnishing: 'unfurnished',
    completion: 'ready',
    ownership: 'freehold',
    available_from: '2026-09-01',
    year_built: 2025,
    service_charge_sqm: 42,
    location: {
      city_en: 'Doha',
      city_ar: 'الدوحة',
      area_en: 'West Bay Lagoon',
      area_ar: 'لؤلؤة الخليج الغربي',
      community_en: 'Lagoon Villas',
      community_ar: 'فلل اللاجون',
      address_en: 'Street 850, West Bay Lagoon, Doha',
      address_ar: 'شارع 850، لؤلؤة الخليج الغربي، الدوحة',
      lat: 25.3925,
      lng: 51.4903,
    },
    amenities: [
      'private_pool',
      'private_garden',
      'central_ac',
      'covered_parking',
      'security',
      'maid_room',
      'built_in_wardrobes',
      'walk_in_closet',
      'kitchen_appliances',
      'study',
      'barbecue_area',
      'pets_allowed',
    ],
    highlights: ['corner_plot', 'brand_new', 'private_pool_hl', 'title_deed'],
    images: [
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600210492493-0946911123ea?q=80&w=1600&auto=format&fit=crop',
    ],
    is_featured: false,
    is_verified: true,
    is_exclusive: false,
    listed_days_ago: 11,
    agent: {
      full_name_en: 'Omar Haddad',
      full_name_ar: 'عمر حداد',
      title_en: 'Villa Specialist',
      title_ar: 'أخصائي الفلل',
      phone: '+974 4444 7777',
      whatsapp: '97444447777',
      email: 'omar@elitere.qa',
      photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=400&auto=format&fit=crop',
      languages: ['en', 'ar'],
      response_minutes: 9,
      listings_count: 38,
      is_superagent: false,
      agency_name_en: 'ELITE Real Estate',
      agency_name_ar: 'إيليت العقارية',
      agency_listings: 412,
      verified_agents: 18,
    },
    market: {
      avg_price: 7_100_000,
      avg_size_sqm: 405,
      community_listings: 486,
      community_buildings: 62,
      price_history: LAGOON_HISTORY,
    },
    nearby: [
      { category: 'school', name_en: 'Qatar Academy', name_ar: 'أكاديمية قطر', minutes: 8, mode: 'drive' },
      { category: 'beach', name_en: 'West Bay Lagoon Beach', name_ar: 'شاطئ لؤلؤة الخليج', minutes: 6, mode: 'walk' },
      { category: 'mall', name_en: 'Lagoona Mall', name_ar: 'لاجونا مول', minutes: 7, mode: 'drive' },
      { category: 'hospital', name_en: 'Sidra Medicine', name_ar: 'سدرة للطب', minutes: 14, mode: 'drive' },
      { category: 'landmark', name_en: 'Katara Cultural Village', name_ar: 'قرية كتارا الثقافية', minutes: 10, mode: 'drive' },
      { category: 'airport', name_en: 'Hamad International Airport', name_ar: 'مطار حمد الدولي', minutes: 28, mode: 'drive' },
    ],
  },

  {
    _id: '3',
    reference_number: 'ELT-00125',
    title_en: 'Stunning Penthouse in Lusail',
    title_ar: 'بنتهاوس مذهل في لوسيل',
    description_en:
      'A full-floor penthouse in Marina District with 270-degree glazing over the marina, the Lusail skyline, and the Gulf beyond.\n\nThe residence is delivered as a single open volume on the entertaining side — living, dining, and kitchen flow into one another and out onto a 40 m² wraparound terrace. A separate cinema room and a private lift lobby serve the floor exclusively.\n\nFour bedroom suites sit behind an acoustic partition wall. The principal suite has its own terrace access, a dressing room, and a bathroom finished in book-matched stone.\n\nHanded over on a staged payment plan, with the balance spread over four years post-handover.',
    description_ar:
      'بنتهاوس بطابق كامل في حي المارينا بواجهات زجاجية تمتد 270 درجة تطل على المارينا وأفق لوسيل والخليج.\n\nيُسلَّم العقار كمساحة مفتوحة واحدة في جانب الاستقبال — تتصل المعيشة والطعام والمطبخ ببعضها وتنفتح على شرفة محيطة بمساحة 40 م². كما تخدم الطابقَ حصرياً صالةُ سينما منفصلة ومصعد خاص.\n\nتقع أربعة أجنحة نوم خلف جدار عازل للصوت. للجناح الرئيسي مدخل خاص إلى الشرفة وغرفة ملابس وحمام مكسو بحجر متطابق العروق.\n\nيُسلَّم وفق خطة دفع مرحلية، مع توزيع الرصيد على أربع سنوات بعد التسليم.',
    type: 'penthouse',
    purpose: 'rent',
    price: 35_000,
    currency: 'QAR',
    price_frequency: 'month',
    bedrooms: 4,
    bathrooms: 4,
    area_sqm: 320,
    floor: 32,
    total_floors: 32,
    parking: 3,
    furnishing: 'semi_furnished',
    completion: 'ready',
    ownership: 'freehold',
    available_from: '2026-12-01',
    year_built: 2024,
    developer_en: 'Qatari Diar',
    developer_ar: 'قطري ديار',
    service_charge_sqm: 95,
    location: {
      city_en: 'Lusail',
      city_ar: 'لوسيل',
      area_en: 'Marina District',
      area_ar: 'حي المارينا',
      community_en: 'Marina Heights',
      community_ar: 'مارينا هايتس',
      address_en: 'Marina Heights Tower, Marina District, Lusail',
      address_ar: 'برج مارينا هايتس، حي المارينا، لوسيل',
      lat: 25.4106,
      lng: 51.5299,
    },
    amenities: [
      'balcony',
      'central_ac',
      'covered_parking',
      'shared_pool',
      'security',
      'concierge',
      'shared_gym',
      'walk_in_closet',
      'sea_view',
      'kitchen_appliances',
      'study',
      'private_lift',
      'cinema_room',
      'beach_access',
      'maid_room',
    ],
    highlights: ['full_floor', 'marina_view', 'brand_new', 'private_lift_hl'],
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600121848594-d8644e57abab?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=1600&auto=format&fit=crop',
    ],
    is_featured: true,
    is_verified: true,
    is_exclusive: true,
    listed_days_ago: 1,
    agent: {
      full_name_en: 'Nadia Kassem',
      full_name_ar: 'نادية قاسم',
      title_en: 'Luxury Leasing Director',
      title_ar: 'مديرة التأجير الفاخر',
      phone: '+974 4444 6666',
      whatsapp: '97444446666',
      email: 'nadia@elitere.qa',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=400&auto=format&fit=crop',
      languages: ['en', 'ar', 'fr'],
      response_minutes: 2,
      listings_count: 51,
      is_superagent: true,
      agency_name_en: 'ELITE Real Estate',
      agency_name_ar: 'إيليت العقارية',
      agency_listings: 412,
      verified_agents: 18,
    },
    market: {
      avg_price: 28_500,
      avg_size_sqm: 245,
      community_listings: 1_874,
      community_buildings: 88,
      price_history: LUSAIL_RENT_HISTORY,
    },
    nearby: [
      { category: 'metro', name_en: 'Lusail QNB Metro Station', name_ar: 'محطة مترو لوسيل QNB', minutes: 7, mode: 'walk' },
      { category: 'mall', name_en: 'Place Vendôme Mall', name_ar: 'مول بلاس فاندوم', minutes: 6, mode: 'drive' },
      { category: 'beach', name_en: 'Al Maha Island', name_ar: 'جزيرة المها', minutes: 9, mode: 'drive' },
      { category: 'school', name_en: 'Newton International Academy', name_ar: 'أكاديمية نيوتن الدولية', minutes: 13, mode: 'drive' },
      { category: 'landmark', name_en: 'Lusail Boulevard', name_ar: 'لوسيل بوليفارد', minutes: 5, mode: 'walk' },
      { category: 'airport', name_en: 'Hamad International Airport', name_ar: 'مطار حمد الدولي', minutes: 32, mode: 'drive' },
    ],
  },
  {
    _id: '4',
    reference_number: 'ELT-00126',
    title_en: 'Off-Plan 2BR with Marina Frontage',
    title_ar: 'شقة على المخطط بغرفتين بواجهة على المارينا',
    description_en:
      'A second-release two-bedroom in the Marina District, positioned on the water-facing side of the tower with an unbroken outlook across the basin.\n\nThe layout puts both bedrooms on the quiet elevation and opens the living space onto a 12 m² terrace. Kitchens are delivered fitted; bathrooms are finished in large-format porcelain with concealed cisterns.\n\nResidents share a landscaped podium deck, a 25-metre lap pool, a gym, and two levels of covered parking.\n\nSold on a staged plan with 30% spread over four years after handover, which is scheduled for Q2 2027.',
    description_ar:
      'شقة بغرفتي نوم من الطرح الثاني في حي المارينا، تقع على الجهة المطلة على الماء من البرج بإطلالة متصلة على الحوض.\n\nيضع التصميم غرفتي النوم على الواجهة الهادئة ويفتح مساحة المعيشة على شرفة بمساحة 12 م². تُسلَّم المطابخ مجهزة، والحمامات مكسوة ببورسلين كبير الحجم بخزانات مخفية.\n\nيتشارك السكان في سطح مُنسَّق، ومسبح بطول 25 متراً، وصالة رياضية، وطابقين من المواقف المغطاة.\n\nيُباع وفق خطة مرحلية مع توزيع 30% على أربع سنوات بعد التسليم المقرر في الربع الثاني من 2027.',
    type: 'apartment',
    purpose: 'sale',
    price: 3_150_000,
    currency: 'QAR',
    bedrooms: 2,
    bathrooms: 3,
    area_sqm: 168,
    floor: 19,
    total_floors: 34,
    parking: 2,
    furnishing: 'unfurnished',
    completion: 'offplan',
    ownership: 'freehold',
    available_from: '2027-06-01',
    handover: 'Q2 2027',
    developer_en: 'Qatari Diar',
    developer_ar: 'قطري ديار',
    service_charge_sqm: 88,
    location: {
      city_en: 'Lusail',
      city_ar: 'لوسيل',
      area_en: 'Marina District',
      area_ar: 'حي المارينا',
      community_en: 'Marina Heights',
      community_ar: 'مارينا هايتس',
      address_en: 'Marina Heights Tower B, Marina District, Lusail',
      address_ar: 'برج مارينا هايتس ب، حي المارينا، لوسيل',
      lat: 25.4112,
      lng: 51.5287,
    },
    amenities: [
      'balcony',
      'central_ac',
      'covered_parking',
      'shared_pool',
      'security',
      'concierge',
      'shared_gym',
      'built_in_wardrobes',
      'sea_view',
      'kitchen_appliances',
      'beach_access',
    ],
    highlights: ['marina_view', 'payment_plan_hl', 'brand_new', 'title_deed'],
    images: [
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600121848594-d8644e57abab?q=80&w=1600&auto=format&fit=crop',
    ],
    is_featured: false,
    is_verified: true,
    is_exclusive: false,
    listed_days_ago: 6,
    agent: {
      full_name_en: 'Nadia Kassem',
      full_name_ar: 'نادية قاسم',
      title_en: 'Luxury Leasing Director',
      title_ar: 'مديرة التأجير الفاخر',
      phone: '+974 4444 6666',
      whatsapp: '97444446666',
      email: 'nadia@elitere.qa',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=400&auto=format&fit=crop',
      languages: ['en', 'ar', 'fr'],
      response_minutes: 2,
      listings_count: 51,
      is_superagent: true,
      agency_name_en: 'ELITE Real Estate',
      agency_name_ar: 'إيليت العقارية',
      agency_listings: 412,
      verified_agents: 18,
    },
    market: {
      avg_price: 2_650_000,
      avg_size_sqm: 145,
      community_listings: 1_874,
      community_buildings: 88,
      price_history: LUSAIL_SALE_HISTORY,
    },
    nearby: [
      { category: 'metro', name_en: 'Lusail QNB Metro Station', name_ar: 'محطة مترو لوسيل QNB', minutes: 8, mode: 'walk' },
      { category: 'mall', name_en: 'Place Vendôme Mall', name_ar: 'مول بلاس فاندوم', minutes: 6, mode: 'drive' },
      { category: 'beach', name_en: 'Al Maha Island', name_ar: 'جزيرة المها', minutes: 10, mode: 'drive' },
      { category: 'landmark', name_en: 'Lusail Boulevard', name_ar: 'لوسيل بوليفارد', minutes: 6, mode: 'walk' },
      { category: 'school', name_en: 'Newton International Academy', name_ar: 'أكاديمية نيوتن الدولية', minutes: 14, mode: 'drive' },
      { category: 'airport', name_en: 'Hamad International Airport', name_ar: 'مطار حمد الدولي', minutes: 33, mode: 'drive' },
    ],
    payment_plan: [
      { key: 'booking', percent: 10, timing_en: 'On booking', timing_ar: 'عند الحجز' },
      { key: 'construction', percent: 40, timing_en: 'During construction', timing_ar: 'أثناء الإنشاء' },
      { key: 'handover', percent: 20, timing_en: 'On handover', timing_ar: 'عند التسليم' },
      { key: 'post_handover', percent: 30, timing_en: 'Over 48 months', timing_ar: 'على مدى 48 شهراً' },
    ],
  },
];

export function getPropertyById(id: string): Property | undefined {
  return properties.find((p) => p._id === id);
}

/** Same purpose, different listing — used for the "similar properties" rail. */
export function getSimilarProperties(id: string, limit = 3): Property[] {
  const current = getPropertyById(id);
  if (!current) return [];
  return properties
    .filter((p) => p._id !== id)
    .sort((a, b) => {
      // Prefer same purpose, then closest price.
      const purposeDelta =
        Number(b.purpose === current.purpose) - Number(a.purpose === current.purpose);
      if (purposeDelta !== 0) return purposeDelta;
      return Math.abs(a.price - current.price) - Math.abs(b.price - current.price);
    })
    .slice(0, limit);
}

/**
 * Price per m². Rentals are annualised first — dividing a monthly rent by floor
 * area yields a number that can't be compared to anything.
 */
export function pricePerSqm(property: Property): number {
  const annual =
    property.price_frequency === 'month' ? property.price * 12 : property.price;
  return Math.round(annual / property.area_sqm);
}

/** Percentage difference vs the community average. Positive means above average. */
export function priceVsMarket(property: Property): number {
  return Math.round(((property.price - property.market.avg_price) / property.market.avg_price) * 100);
}

/** Percentage difference in size vs the community average. */
export function sizeVsMarket(property: Property): number {
  return Math.round(
    ((property.area_sqm - property.market.avg_size_sqm) / property.market.avg_size_sqm) * 100
  );
}
