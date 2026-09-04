'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Minimize2,
  Phone,
  MessageCircle
} from 'lucide-react';
import { useLocale } from 'next-intl';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

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
  const [sessionId, setSessionId] = useState('');
  
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate or get session ID
    let id = localStorage.getItem('elite_chat_session');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('elite_chat_session', id);
    }
    setSessionId(id);

    // Initial welcome message
    const welcomeMsg = locale === 'ar' 
      ? 'مرحباً! أنا ELITE، مساعدك العقاري الذكي. كيف يمكنني مساعدتك اليوم؟'
      : 'Hello! I am ELITE, your AI real estate assistant. How can I help you today?';
    
    setMessages([{ role: 'assistant', content: welcomeMsg, timestamp: new Date() }]);
  }, [locale]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/chatbot/message`, {
        sessionId,
        message: userMsg,
        locale
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.response, 
        timestamp: new Date() 
      }]);
    } catch (error) {
      console.error('Chat error:', error);
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
            Chat with ELITE AI
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
            <h3 className="font-bold text-sm">ELITE AI Assistant</h3>
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
            {messages.map((msg, index) => (
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
            Powered by ELITE Real Estate AI
          </div>
        </>
      )}
    </div>
  );
};

export default ChatbotWidget;
