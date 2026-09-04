'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  Clock, 
  Play, 
  Pause, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Globe
} from 'lucide-react';

const AIConfigPage = () => {
  const [isAIActive, setIsAIActive] = useState(true);
  
  const [sequences, setSequences] = useState([
    {
      id: '1',
      title: 'Initial Inquiry Response',
      delay: '2 minutes',
      message_en: "Hello {{name}}! 👋 Thank you for your interest in {{property}} at {{location}}. I'm ELITE, your AI assistant from ELITE Real Estate. Would you like to schedule a viewing or get more details?",
      message_ar: "مرحباً {{name}}! 👋 شكراً لاهتمامك بـ {{property}} في {{location}}. أنا ELITE، مساعدك الذكي من إيليت العقارية. هل ترغب في تحديد موعد للمعاينة أو الحصول على مزيد من التفاصيل؟",
      isActive: true
    },
    {
      id: '2',
      title: '24h Follow-up',
      delay: '24 hours',
      message_en: "Hi {{name}}, just checking in to see if you're still interested in {{property}}. We have some new photos and a virtual tour available. Would you like to see them?",
      message_ar: "مرحباً {{name}}، أردت فقط التأكد مما إذا كنت لا تزال مهتماً بـ {{property}}. لدينا بعض الصور الجديدة وجولة افتراضية متاحة. هل ترغب في رؤيتها؟",
      isActive: true
    },
    {
      id: '3',
      title: '3-Day Re-engagement',
      delay: '3 days',
      message_en: "Hello again {{name}}, we haven't heard back from you. Based on your interest in {{property}}, we have 3 similar properties that might interest you. Should I send the links?",
      message_ar: "مرحباً مجدداً {{name}}، لم نسمع منك. بناءً على اهتمامك بـ {{property}}، لدينا 3 عقارات مماثلة قد تهمك. هل أرسل لك الروابط؟",
      isActive: false
    }
  ]);

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
            onClick={() => setIsAIActive(!isAIActive)}
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
              <button className="flex items-center gap-2 text-[#b98f42] font-bold text-sm hover:underline">
                <Plus className="w-4 h-4" />
                Add Message to Sequence
              </button>
            </div>

            {sequences.map((seq, index) => (
              <div key={seq.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#b98f42] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{seq.title}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Triggered after {seq.delay}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${seq.isActive ? 'bg-[#b98f42]' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${seq.isActive ? 'right-1' : 'left-1'}`}></div>
                    </div>
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
                      defaultValue={seq.message_en}
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
                      defaultValue={seq.message_ar}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#b98f42] transition-all shadow-lg">
              <Save className="w-5 h-5" />
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">Smart Replies</p>
                  <p className="text-xs text-gray-500">AI answers common questions</p>
                </div>
                <div className="w-12 h-6 bg-[#b98f42] rounded-full relative cursor-pointer">
                  <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">Lead Scoring</p>
                  <p className="text-xs text-gray-500">Auto-rank lead quality</p>
                </div>
                <div className="w-12 h-6 bg-[#b98f42] rounded-full relative cursor-pointer">
                  <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">Auto-Escalation</p>
                  <p className="text-xs text-gray-500">Notify agent on intent</p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
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
