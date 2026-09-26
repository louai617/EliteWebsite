'use client';

import React from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Phone,
  Mail,
  MessageSquare,
  Clock,
  UserCheck,
  CheckCircle2,
  Calendar,
  XCircle,
  Download
} from 'lucide-react';

const AdminLeadsPage = () => {
  // Mock leads data
  const leads = [
    {
      _id: '1',
      full_name: 'Khalid Al-Thani',
      email: 'khalid@example.com',
      phone: '+974 5555 1234',
      property: 'Luxury 3BR Apartment in The Pearl',
      source: 'website_form',
      status: 'new',
      date: '2026-04-06 14:30',
      icon: Clock
    },
    {
      _id: '2',
      full_name: 'John Smith',
      email: 'john@example.com',
      phone: '+974 6666 7777',
      property: 'Modern Villa with Private Pool',
      source: 'chatbot',
      status: 'contacted',
      date: '2026-04-06 12:15',
      icon: UserCheck
    },
    {
      _id: '3',
      full_name: 'Sara Miller',
      email: 'sara@example.com',
      phone: '+974 3333 4444',
      property: 'Stunning Penthouse in Lusail',
      source: 'whatsapp',
      status: 'qualified',
      date: '2026-04-06 10:00',
      icon: CheckCircle2
    },
    {
      _id: '4',
      full_name: 'Mohammed Ahmed',
      email: 'mohammed@example.com',
      phone: '+974 7777 8888',
      property: 'The Pearl Studio',
      source: 'call',
      status: 'viewing_scheduled',
      date: '2026-04-05 18:45',
      icon: Calendar
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'contacted': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'qualified': return 'bg-green-100 text-green-700 border-green-200';
      case 'viewing_scheduled': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'closed_won': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'closed_lost': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leads Management</h1>
          <p className="text-gray-500 font-medium tracking-tight">Track and manage all your property inquiries and leads.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2 shadow-lg">
            Add Manual Lead
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">New Leads</p>
          <h3 className="text-3xl font-bold text-gray-900">24</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Contacted</p>
          <h3 className="text-3xl font-bold text-orange-600">45</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Qualified</p>
          <h3 className="text-3xl font-bold text-green-600">12</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Viewing Scheduled</p>
          <h3 className="text-3xl font-bold text-purple-600">8</h3>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-full md:w-96">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search leads by name, email, property..." 
            className="bg-transparent border-none outline-none text-sm text-gray-700 w-full"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <select className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 outline-none hover:bg-gray-50 transition-all">
            <option>Status: All</option>
            <option>Status: New</option>
            <option>Status: Contacted</option>
            <option>Status: Qualified</option>
            <option>Status: Closed</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Client Details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Property Inquired</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Source & Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map((lead) => (
              <tr key={lead._id} className="hover:bg-gray-50/50 transition-all">
                <td className="px-6 py-6">
                  <div>
                    <p className="font-bold text-gray-900 mb-1">{lead.full_name}</p>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </p>
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <p className="font-bold text-gray-700 mb-1 truncate max-w-[250px]">{lead.property}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Inquiry regarding property</p>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                      {lead.source === 'website_form' && <Mail className="w-3 h-3" />}
                      {lead.source === 'chatbot' && <MessageSquare className="w-3 h-3" />}
                      {lead.source === 'whatsapp' && <MessageSquare className="w-3 h-3 text-green-500" />}
                      {lead.source === 'call' && <Phone className="w-3 h-3" />}
                      {lead.source.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <p className="text-sm font-bold text-gray-900 mb-1">{lead.date.split(' ')[0]}</p>
                  <p className="text-xs text-gray-400 font-medium">{lead.date.split(' ')[1]}</p>
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-[#b98f42] transition-colors" title="Contact">
                      <MessageSquare className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors" title="Edit Status">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="bg-gray-50 px-8 py-6 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">Showing <span className="text-gray-900 font-bold">1-10</span> of <span className="text-gray-900 font-bold">45</span> leads</p>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-400 cursor-not-allowed">Previous</button>
            <button className="px-4 py-2 border border-[#b98f42] bg-[#b98f42] rounded-lg text-sm font-bold text-white shadow-sm">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLeadsPage;
