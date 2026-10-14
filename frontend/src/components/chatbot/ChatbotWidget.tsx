'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Minimize2,
  MessageCircle
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { api, errorMessage } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /** Lead-capture flow: what they need → name + phone → lead created in the CRM. */
  const [stage, setStage] = useState<'need' | 'contact' | 'done'>('need');
  const [need, setNeed] = useState<string[]>([]);
  
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  const ar = locale === 'ar';

  const [openedAt] = useState(() => new Date());
  const welcome: Message = {
    role: 'assistant',
    content: ar
      ? 'مرحباً! أنا مساعد ELITE. أخبرنا عن العقار الذي تبحث عنه وسيتواصل معك أحد وكلائنا.'
      : "Hello! I'm the ELITE assistant. Tell us what you're looking for and one of our agents will get back to you.",
    timestamp: openedAt,
  };
  const conversation = [welcome, ...messages];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const reply = (content: string) => setMessages((prev) => [...prev, { role: 'assistant', content, timestamp: new Date() }]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim().slice(0, 1000);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);

    if (stage === 'need') {
      setNeed([userMsg]);
      setStage('contact');
      reply(ar ? 'شكراً! ما اسمك ورقم هاتفك؟ (مثال: سارة، ‎+974 5555 1234)' : 'Thanks! What is your name and mobile number? (e.g. Sara, +974 5555 1234)');
      return;
    }
    if (stage === 'done') {
      reply(ar ? 'تم إرسال طلبك وسيتواصل معك أحد الوكلاء قريباً. للمساعدة العاجلة استخدم واتساب.' : 'Your request is with our team — an agent will contact you shortly. For urgent help, use WhatsApp.');
      return;
    }

    const phone = userMsg.match(/\+?\d[\d ()-]{6,19}\d/)?.[0]?.trim();
    const name = userMsg.replace(phone ?? '', '').replace(/[,;:|-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!phone || name.length < 2) {
      reply(ar ? 'يرجى كتابة اسمك ورقم هاتفك معاً، مثال: سارة، ‎+974 5555 1234' : 'Please send both your name and phone number, e.g. Sara, +974 5555 1234');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/public/leads', { fullName: name.slice(0, 120), phone, message: `Website chat:\n${need.join('\n')}`.slice(0, 2000) });
      setStage('done');
      reply(ar ? `شكراً ${name}! تم تسجيل طلبك وسيتصل بك أحد وكلائنا قريباً.` : `Thank you, ${name}! Your request has been registered and one of our agents will call you shortly.`);
    } catch (err) {
      reply(errorMessage(err, ar ? 'تعذر إرسال طلبك. حاول مرة أخرى أو تواصل معنا عبر واتساب.' : "We couldn't send your request. Please try again or reach us on WhatsApp."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4">
        {/* WhatsApp Button */}
        <a 
          href="https://wa.me/97455551234" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-green-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center"
        >
          <MessageCircle className="w-8 h-8" />
        </a>
        
        {/* Chatbot Button */}
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-[#b98f42] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center relative group"
        >
          <Bot className="w-8 h-8" />
          <span className="absolute right-full mr-4 bg-black text-white px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Chat with ELITE
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] w-[380px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px]'}`}>
      {/* Header */}
      <div className="bg-[#1a1a1a] p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#b98f42] rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">ELITE Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-white/10 rounded transition-colors">
            <Minimize2 className="w-5 h-5" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Messages */}
          <div 
            ref={scrollRef}
            className="flex-grow p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4"
          >
            {conversation.map((msg, index) => (
              <div 
                key={index}
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-[#b98f42] text-white' : 'bg-[#1a1a1a] text-[#b98f42]'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#b98f42] text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-[#b98f42] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#b98f42] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#b98f42] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#b98f42] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex items-center gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] transition-all"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-[#1a1a1a] text-white p-3 rounded-xl hover:bg-[#b98f42] transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          {/* Footer Info */}
          <div className="px-4 py-2 bg-gray-50 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest border-t border-gray-100">
            Your details go straight to an ELITE agent
          </div>
        </>
      )}
    </div>
  );
};

export default ChatbotWidget;
