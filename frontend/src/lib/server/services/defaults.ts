/**
 * Default CRM settings. Plain module (no `server-only`) so the seed script can
 * import it outside Next.js.
 */
import {
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LEAD_STATUSES,
  DEFAULT_LOCATIONS,
  DEFAULT_PROPERTY_TYPES,
  type LeadStatusOption,
  type LocationOption,
  type PropertyTypeOption,
  type SimpleOption,
} from '@/lib/shared/constants';

export interface AiSequence {
  _id?: string;
  title: string;
  delay: string;
  message_en?: string;
  message_ar?: string;
  is_active: boolean;
}

export interface CrmSettings {
  lead_statuses: LeadStatusOption[];
  lead_sources: SimpleOption[];
  locations: LocationOption[];
  property_types: PropertyTypeOption[];
  ai_config: {
    is_active: boolean;
    smart_replies: boolean;
    lead_scoring: boolean;
    auto_escalation: boolean;
    sequences: AiSequence[];
  };
}

export const DEFAULT_AI_CONFIG: CrmSettings['ai_config'] = {
  is_active: true,
  smart_replies: true,
  lead_scoring: true,
  auto_escalation: false,
  sequences: [
    {
      title: 'Initial Inquiry Response',
      delay: '2 minutes',
      message_en:
        "Hello {{name}}! 👋 Thank you for your interest in {{property}} at {{location}}. I'm ELITE, your AI assistant from ELITE Real Estate. Would you like to schedule a viewing or get more details?",
      message_ar:
        'مرحباً {{name}}! 👋 شكراً لاهتمامك بـ {{property}} في {{location}}. أنا ELITE، مساعدك الذكي من إيليت العقارية. هل ترغب في تحديد موعد للمعاينة أو الحصول على مزيد من التفاصيل؟',
      is_active: true,
    },
    {
      title: '24h Follow-up',
      delay: '24 hours',
      message_en:
        "Hi {{name}}, just checking in to see if you're still interested in {{property}}. We have some new photos and a virtual tour available. Would you like to see them?",
      message_ar:
        'مرحباً {{name}}، أردت فقط التأكد مما إذا كنت لا تزال مهتماً بـ {{property}}. لدينا بعض الصور الجديدة وجولة افتراضية متاحة. هل ترغب في رؤيتها؟',
      is_active: true,
    },
    {
      title: '3-Day Re-engagement',
      delay: '3 days',
      message_en:
        "Hello again {{name}}, we haven't heard back from you. Based on your interest in {{property}}, we have 3 similar properties that might interest you. Should I send the links?",
      message_ar:
        'مرحباً مجدداً {{name}}، لم نسمع منك. بناءً على اهتمامك بـ {{property}}، لدينا 3 عقارات مماثلة قد تهمك. هل أرسل لك الروابط؟',
      is_active: false,
    },
  ],
};

export const DEFAULT_SETTINGS: CrmSettings = {
  lead_statuses: DEFAULT_LEAD_STATUSES,
  lead_sources: DEFAULT_LEAD_SOURCES,
  locations: DEFAULT_LOCATIONS,
  property_types: DEFAULT_PROPERTY_TYPES,
  ai_config: DEFAULT_AI_CONFIG,
};

