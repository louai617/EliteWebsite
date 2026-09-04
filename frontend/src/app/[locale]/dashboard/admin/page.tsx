'use client';

import React from 'react';
import { 
  TrendingUp, 
  Home, 
  Users, 
  MessageSquare, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye, 
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck
} from 'lucide-react';

const KPIStat = ({ title, value, change, isPositive, icon: Icon }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
    <div className="flex items-center justify-between mb-4">
      <div className="p-3 bg-gray-50 rounded-xl text-[#b98f42]">
        <Icon className="w-6 h-6" />
      </div>
      <div className={`flex items-center text-sm font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        {change}%
      </div>
    </div>
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const AdminDashboardOverview = () => {
  const kpis = [
    { title: 'Total Properties', value: '154', change: '12', isPositive: true, icon: Home },
    { title: 'Active Listings', value: '128', change: '5', isPositive: true, icon: Eye },
    { title: 'Total Leads Today', value: '24', change: '8', isPositive: true, icon: MessageSquare },
    { title: 'New Users', value: '45', change: '3', isPositive: false, icon: Users },
  ];

  const recentLeads = [
    { id: '1', name: 'Khalid Al-Thani', property: 'Luxury 3BR Apartment', status: 'new', date: '2 mins ago', icon: Clock },
    { id: '2', name: 'John Smith', property: 'Modern Villa West Bay', status: 'contacted', date: '45 mins ago', icon: UserCheck },
    { id: '3', name: 'Sara Miller', property: 'Lusail Penthouse', status: 'qualified', date: '2 hours ago', icon: CheckCircle2 },
    { id: '4', name: 'Mohammed Ahmed', property: 'The Pearl Studio', status: 'viewing_scheduled', date: '5 hours ago', icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, Admin</h1>
          <p className="text-gray-500 font-medium tracking-tight">Here's what's happening with ELITE Real Estate today.</p>
        </div>
        <button className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          View Reports
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <KPIStat key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Main Grid: Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts Area (Placeholder) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#b98f42]" />
                Leads Growth
              </h2>
              <select className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg text-sm outline-none">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>Last Year</option>
              </select>
            </div>
            <div className="flex items-center justify-center h-full text-gray-400 font-medium italic pt-20">
              [ Interactive Leads Growth Chart ]
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
            <h2 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
              <Home className="w-5 h-5 text-[#b98f42]" />
              Popular Areas
            </h2>
            <div className="flex items-center justify-center h-full text-gray-400 font-medium italic pt-20">
              [ Interactive Area Distribution Chart ]
            </div>
          </div>
        </div>

        {/* Sidebar: Recent Leads */}
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-8">Recent Leads</h2>
            <div className="space-y-6">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-start gap-4 pb-6 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className={`p-3 rounded-xl ${
                    lead.status === 'new' ? 'bg-blue-50 text-blue-600' :
                    lead.status === 'contacted' ? 'bg-orange-50 text-orange-600' :
                    lead.status === 'qualified' ? 'bg-green-50 text-green-600' :
                    'bg-purple-50 text-purple-600'
                  }`}>
                    <lead.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-900">{lead.name}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400">{lead.date}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2 truncate max-w-[150px]">{lead.property}</p>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                      lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                      lead.status === 'contacted' ? 'bg-orange-100 text-orange-700' :
                      lead.status === 'qualified' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-4 text-sm font-bold text-[#b98f42] hover:bg-gray-50 rounded-xl transition-all border-2 border-dashed border-[#b98f42]/20">
              View All Leads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardOverview;
