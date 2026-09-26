import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { Search, Bell, User } from 'lucide-react';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-grow lg:ml-64 flex flex-col">
        {/* Top Navigation */}
        <header className="bg-white h-16 border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-96">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search leads, properties..." 
              className="bg-transparent border-none outline-none text-sm text-gray-700 w-full"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-400 hover:text-gray-900 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900 leading-none mb-1">Admin User</p>
                <p className="text-xs text-gray-500 font-medium leading-none">Super Admin</p>
              </div>
              <div className="w-10 h-10 bg-[#b98f42] rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
