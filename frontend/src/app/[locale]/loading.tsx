import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-[#b98f42]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-[#b98f42] rounded-full"></div>
        </div>
      </div>
      <p className="mt-4 text-[#b98f42] font-bold tracking-widest uppercase text-xs animate-pulse">
        ELITE Real Estate
      </p>
    </div>
  );
}
