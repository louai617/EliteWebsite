/**
 * Canonical company facts, transcribed from the official ELITE Real Estate
 * company profile (Canva PDF, authored 2025-08-30).
 *
 * This is the single source of truth for anything that states a fact about the
 * business — About, Contact, Footer, metadata, structured data. Do not restate
 * these figures inline elsewhere, and do not invent new ones: if a number or a
 * contact detail is not in here, it is not in the profile.
 *
 * Free text carries both languages, matching the convention in `properties.ts`.
 */

export interface BilingualText {
  en: string;
  ar: string;
}

export interface Goal {
  /** Stable key, used for React keys and any future i18n extraction. */
  key: string;
  text: BilingualText;
}

export interface Sector {
  key: 'residential' | 'commercial' | 'land' | 'hotels' | 'malls' | 'schools';
  label: BilingualText;
}

export interface ServiceLine {
  key: 'brokerage' | 'sales' | 'resales' | 'property_management';
  label: BilingualText;
}

export const company = {
  name: {
    en: 'ELITE Real Estate',
    ar: 'إيليت العقارية',
  } as BilingualText,

  /** Used on the site hero; not from the profile, kept from the existing brand line. */
  tagline: {
    en: 'Elevating the Way You Live',
    ar: 'نرتقي بطريقة عيشك',
  } as BilingualText,

  /** Years of expertise claimed in the profile. */
  yearsOfExperience: 17,

  /** The four About Us paragraphs, verbatim from the profile. */
  about: [
    {
      en: "At Elite Real Estate, we don't just deal with properties — we create investment opportunities and lasting value. With over 17 years of expertise in real estate brokerage, sales, resales, and property management, we have built a strong reputation through multiple successful ventures.",
      ar: 'في إيليت العقارية، لا نتعامل مع العقارات فحسب — بل نصنع فرصاً استثمارية وقيمة مستدامة. وبخبرة تتجاوز 17 عاماً في الوساطة العقارية والبيع وإعادة البيع وإدارة الأملاك، بنينا سمعة قوية عبر مشاريع ناجحة متعددة.',
    },
    {
      en: 'Building on this experience, Elite Real Estate was our latest project to provide real estate services at an exceptional standard, introducing a modern vision and a client-focused approach that redefines the real estate experience.',
      ar: 'وانطلاقاً من هذه الخبرة، جاءت إيليت العقارية كأحدث مشاريعنا لتقديم خدمات عقارية بمستوى استثنائي، برؤية عصرية ونهج يضع العميل في المقام الأول ويعيد تعريف التجربة العقارية.',
    },
    {
      en: 'We cover a wide spectrum of properties — residential, commercial, lands, hotels, malls, and schools — giving us the capacity to serve all segments, from investors and buyers to tenants, with tailored real estate solutions that meet every client’s unique needs.',
      ar: 'نغطي طيفاً واسعاً من العقارات — السكنية والتجارية والأراضي والفنادق والمولات والمدارس — ما يمنحنا القدرة على خدمة جميع الشرائح، من المستثمرين والمشترين إلى المستأجرين، بحلول عقارية مصمَّمة لتلبية احتياجات كل عميل.',
    },
    {
      en: 'What sets us apart is our unwavering commitment to trust, transparency, and quality. Our mission is to reimagine the real estate journey and make it smoother, smarter, and more rewarding for everyone we serve.',
      ar: 'وما يميّزنا هو التزامنا الراسخ بالثقة والشفافية والجودة. مهمتنا أن نعيد تصوّر الرحلة العقارية ونجعلها أكثر سلاسة وذكاءً وفائدة لكل من نخدمهم.',
    },
  ] as BilingualText[],

  vision: {
    en: 'To become the leading real estate choice in Qatar and the region by delivering innovative services that elevate the client experience and create genuine investment value.',
    ar: 'أن نصبح الخيار العقاري الأول في قطر والمنطقة من خلال تقديم خدمات مبتكرة ترتقي بتجربة العميل وتخلق قيمة استثمارية حقيقية.',
  } as BilingualText,

  mission: {
    en: 'At Elite Real Estate, we are dedicated to providing comprehensive real estate solutions across all residential and commercial sectors, with a strong focus on quality, transparency, and professionalism. Our goal is to make every real estate transaction — whether buying, selling, or property management — a seamless, secure, and successful experience.',
    ar: 'في إيليت العقارية، نلتزم بتقديم حلول عقارية متكاملة في جميع القطاعات السكنية والتجارية، مع تركيز قوي على الجودة والشفافية والاحترافية. هدفنا أن نجعل كل صفقة عقارية — سواء كانت شراءً أو بيعاً أو إدارة أملاك — تجربة سلسة وآمنة وناجحة.',
  } as BilingualText,

  goals: [
    {
      key: 'world_class',
      text: {
        en: 'Deliver world-class real estate services that exceed client expectations.',
        ar: 'تقديم خدمات عقارية بمستوى عالمي تفوق توقعات العملاء.',
      },
    },
    {
      key: 'network',
      text: {
        en: 'Build a wide and trusted network of investors, owners, and tenants.',
        ar: 'بناء شبكة واسعة وموثوقة من المستثمرين والملاك والمستأجرين.',
      },
    },
    {
      key: 'expand',
      text: {
        en: 'Expand across diverse real estate sectors (residential, commercial, lands, hotels, schools, shopping malls).',
        ar: 'التوسع في قطاعات عقارية متنوعة (السكنية، التجارية، الأراضي، الفنادق، المدارس، المراكز التجارية).',
      },
    },
    {
      key: 'confidence',
      text: {
        en: 'Strengthen client confidence through integrity, transparency, and credibility.',
        ar: 'تعزيز ثقة العملاء من خلال النزاهة والشفافية والمصداقية.',
      },
    },
    {
      key: 'market',
      text: {
        en: 'Contribute to the development of the local real estate market and elevate it to a globally competitive level.',
        ar: 'الإسهام في تطوير السوق العقاري المحلي والارتقاء به إلى مستوى تنافسي عالمي.',
      },
    },
  ] as Goal[],

  /** Property segments the company covers, per the profile. */
  sectors: [
    { key: 'residential', label: { en: 'Residential', ar: 'سكني' } },
    { key: 'commercial', label: { en: 'Commercial', ar: 'تجاري' } },
    { key: 'land', label: { en: 'Land', ar: 'أراضٍ' } },
    { key: 'hotels', label: { en: 'Hotels', ar: 'فنادق' } },
    { key: 'malls', label: { en: 'Shopping Malls', ar: 'مراكز تجارية' } },
    { key: 'schools', label: { en: 'Schools', ar: 'مدارس' } },
  ] as Sector[],

  /** Core service lines named in the profile's experience claim. */
  services: [
    { key: 'brokerage', label: { en: 'Brokerage', ar: 'الوساطة العقارية' } },
    { key: 'sales', label: { en: 'Sales', ar: 'البيع' } },
    { key: 'resales', label: { en: 'Resales', ar: 'إعادة البيع' } },
    { key: 'property_management', label: { en: 'Property Management', ar: 'إدارة الأملاك' } },
  ] as ServiceLine[],

  /** The three values the profile repeats across About, Mission and Goals. */
  values: [
    {
      key: 'trust',
      label: { en: 'Trust', ar: 'الثقة' },
      text: {
        en: 'Integrity and credibility in every dealing, so clients can commit with confidence.',
        ar: 'النزاهة والمصداقية في كل تعامل، ليتمكن العملاء من المضي بثقة.',
      },
    },
    {
      key: 'transparency',
      label: { en: 'Transparency', ar: 'الشفافية' },
      text: {
        en: 'Clear, honest information at every stage of the transaction — nothing withheld.',
        ar: 'معلومات واضحة وصادقة في كل مرحلة من مراحل الصفقة، دون أي إخفاء.',
      },
    },
    {
      key: 'quality',
      label: { en: 'Quality', ar: 'الجودة' },
      text: {
        en: 'An exceptional standard of service, delivered with professionalism throughout.',
        ar: 'مستوى استثنائي من الخدمة يُقدَّم باحترافية في كل خطوة.',
      },
    },
  ],

  contact: {
    /** All three lines are published in the profile. The first is the primary. */
    phones: ['+974 3000 4996', '+974 7007 9906', '+974 4004 4510'],
    /** Digits only, for tel: and wa.me links. */
    phonesRaw: ['97430004996', '97470079906', '97440044510'],
    address: {
      en: 'Office 305, 3rd Floor, Block D, Al Mirqab Mall, Doha – Qatar',
      ar: 'مكتب 305، الطابق الثالث، بلوك D، مول المرقاب، الدوحة – قطر',
    } as BilingualText,
    city: { en: 'Doha', ar: 'الدوحة' } as BilingualText,
    country: { en: 'Qatar', ar: 'قطر' } as BilingualText,
    website: 'www.eliterealestate.qa',
    websiteUrl: 'https://www.eliterealestate.qa',
    /**
     * NOTE: the company profile publishes no email address. Add one here once
     * confirmed rather than inventing a placeholder.
     */
    email: null as string | null,
  },
} as const;

/** Pick the right language off any bilingual field. */
export function pick(text: BilingualText, locale: string): string {
  return locale === 'ar' ? text.ar : text.en;
}
