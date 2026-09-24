'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bot, 
  Settings, 
  Clock, 
  Play, 
  Pause, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  Globe,
  Loader2,
} from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import type { AiSequenceRow, CrmSettingsData } from '@/lib/shared/types';
import { useSettingsStore } from '@/store/crmStores';
import { ErrorBanner } from '@/components/dashboard/ui';

type AiConfig = CrmSettingsData['ai_config'];

/** Loads the saved configuration once, then hands it to the editor as initial state. */
const AIConfigPage = () => {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    void load(true);
  }, [load]);

  if (!settings) {
    return error ? <ErrorBanner message={error} /> : <Loader2 className="mx-auto mt-32 h-8 w-8 animate-spin text-[#b98f42]" />;
  }
  return <AIConfigEditor initial={settings.ai_config} />;
};

const AIConfigEditor = ({ initial }: { initial: AiConfig }) => {
  const save = useSettingsStore((s) => s.save);
  const [isAIActive, setIsAIActive] = useState(initial.is_active);
  const [toggles, setToggles] = useState({
    smart_replies: initial.smart_replies,
    lead_scoring: initial.lead_scoring,
    auto_escalation: initial.auto_escalation,
  });
  const [sequences, setSequences] = useState<AiSequenceRow[]>(initial.sequences);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const updateSequence = (index: number, patch: Partial<AiSequenceRow>) =>
    setSequences((list) => list.map((seq, i) => (i === index ? { ...seq, ...patch } : seq)));

  const persist = async (overrides: Partial<AiConfig> = {}) => {
    setSaving(true);
    setStatus(null);
    try {
      const result = await save({
        ai_config: { is_active: isAIActive, ...toggles, sequences, ...overrides },
      });
      setSequences(result.ai_config.sequences);
      setStatus({ ok: true, message: 'Saved.' });
    } catch (err) {
      setStatus({ ok: false, message: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Bot className="w-8 h-8 text-[#b98f42]" />
            AI Follow-Up Configuration
          </h1>
          <p className="text-gray-500 font-medium tracking-tight">Configure automated AI WhatsApp & SMS follow-up sequences.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${isAIActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            AI Status: {isAIActive ? 'Active' : 'Paused'}
          </span>
          <button 
            type="button"
            aria-label={isAIActive ? 'Pause AI' : 'Activate AI'}
            disabled={saving}
            onClick={() => {
              const next = !isAIActive;
              setIsAIActive(next);
              void persist({ is_active: next });
            }}
            className={`p-3 rounded-xl transition-all ${isAIActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
          >
            {isAIActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Sequence List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">Follow-Up Sequence</h2>
              <button
                type="button"
                onClick={() =>
                  setSequences((list) => [
                    ...list,
                    { title: 'New follow-up', delay: '7 days', message_en: '', message_ar: '', is_active: false },
                  ])
                }
                className="flex items-center gap-2 text-[#b98f42] font-bold text-sm hover:underline"
              >
                <Plus className="w-4 h-4" />
                Add Message to Sequence
              </button>
            </div>

            {status && (status.ok ? (
              <p className="text-sm font-bold text-green-600">{status.message}</p>
            ) : (
              <ErrorBanner message={status.message} onClose={() => setStatus(null)} />
            ))}

            {sequences.map((seq, index) => (
              <div key={seq._id ?? `new-${index}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#b98f42] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <input
                        aria-label="Sequence title"
                        value={seq.title}
                        maxLength={120}
                        onChange={(e) => updateSequence(index, { title: e.target.value })}
                        className="font-bold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-[#b98f42]"
                      />
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Triggered after{' '}
                        <input
                          aria-label="Delay"
                          value={seq.delay}
                          maxLength={40}
                          onChange={(e) => updateSequence(index, { delay: e.target.value })}
                          className="w-24 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#b98f42]"
                        />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Remove message"
                      onClick={() => setSequences((list) => list.filter((_, i) => i !== index))}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={seq.is_active}
                      aria-label="Message active"
                      onClick={() => updateSequence(index, { is_active: !seq.is_active })}
                      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${seq.is_active ? 'bg-[#b98f42]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${seq.is_active ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* English Version */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">English Template</span>
                    </div>
                    <textarea 
                      className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#b98f42]/20 resize-none leading-relaxed"
                      value={seq.message_en ?? ''}
                      maxLength={2000}
                      onChange={(e) => updateSequence(index, { message_en: e.target.value })}
                    />
                  </div>
                  {/* Arabic Version */}
                  <div dir="rtl">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">القالب العربي</span>
                    </div>
                    <textarea 
                      className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#b98f42]/20 resize-none leading-relaxed font-arabic"
                      value={seq.message_ar ?? ''}
                      maxLength={2000}
                      onChange={(e) => updateSequence(index, { message_ar: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => void persist()}
              disabled={saving}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#b98f42] transition-all shadow-lg disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save All Sequences
            </button>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#b98f42]" />
              AI Intelligence
            </h2>
            <div className="space-y-6">
              {([
                ['smart_replies', 'Smart Replies', 'AI answers common questions'],
                ['lead_scoring', 'Lead Scoring', 'Auto-rank lead quality'],
                ['auto_escalation', 'Auto-Escalation', 'Notify agent on intent'],
              ] as const).map(([key, title, subtitle]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={toggles[key]}
                    aria-label={title}
                    onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${toggles[key] ? 'bg-[#b98f42]' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${toggles[key] ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400">Saved with “Save All Sequences”.</p>
            </div>
          </div>

          <div className="bg-[#b98f42]/5 p-8 rounded-2xl border border-[#b98f42]/20">
            <div className="flex items-start gap-4 text-[#b98f42]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold mb-2">Pro Tip: Personalization</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Use variables like <code className="bg-white px-1.5 py-0.5 rounded border border-[#b98f42]/20 font-bold">{"{{name}}"}</code> and <code className="bg-white px-1.5 py-0.5 rounded border border-[#b98f42]/20 font-bold">{"{{property}}"}</code> to increase engagement rates by up to 40%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigPage;
