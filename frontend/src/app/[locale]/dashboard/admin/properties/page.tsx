'use client';

import React from 'react';
import Image from 'next/image';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const AdminPropertiesPage = () => {
  // Mock properties data
  const properties = [
    {
      _id: '1',
      reference_number: 'ELT-00123',
      title_en: 'Luxury 3BR Apartment in The Pearl',
      price: 4500000,
      type: 'apartment',
      purpose: 'sale',
      is_active: true,
      is_featured: true,
      views: 1240,
      inquiries: 45,
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=100&auto=format&fit=crop'
    },
    {
      _id: '2',
      reference_number: 'ELT-00124',
      title_en: 'Modern Villa with Private Pool',
      price: 8500000,
      type: 'villa',
      purpose: 'sale',
      is_active: true,
      is_featured: false,
      views: 890,
      inquiries: 12,
      image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=100&auto=format&fit=crop'
    },
    {
      _id: '3',
      reference_number: 'ELT-00125',
      title_en: 'Stunning Penthouse in Lusail',
      price: 35000,
      type: 'penthouse',
      purpose: 'rent',
      is_active: false,
      is_featured: true,
      views: 2100,
      inquiries: 89,
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=100&auto=format&fit=crop'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Properties Management</h1>
          <p className="text-gray-500 font-medium tracking-tight">Manage all your property listings from one place.</p>
        </div>
        <button className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2 shadow-lg">
          <Plus className="w-5 h-5" />
          Add New Property
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-full md:w-96">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by title, ref, location..." 
            className="bg-transparent border-none outline-none text-sm text-gray-700 w-full"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <select className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 outline-none hover:bg-gray-50 transition-all">
            <option>Sort by: Newest</option>
            <option>Sort by: Price High</option>
            <option>Sort by: Price Low</option>
            <option>Sort by: Most Viewed</option>
          </select>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Property</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Price & Type</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stats</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {properties.map((property) => (
              <tr key={property._id} className="hover:bg-gray-50/50 transition-all">
                <td className="px-6 py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100">
                      <Image src={property.image} alt={property.title_en} fill sizes="64px" className="object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 mb-1 truncate max-w-[200px]">{property.title_en}</p>
                      <p className="text-xs text-gray-400 font-bold tracking-wider">REF: {property.reference_number}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <p className="font-bold text-[#b98f42] mb-1">{property.price.toLocaleString()} QAR</p>
                  <p className="text-xs text-gray-500 font-medium capitalize">{property.type} • For {property.purpose}</p>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      property.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {property.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {property.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {property.is_featured && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 w-fit">
                        Featured
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center gap-4 text-gray-500">
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-900">{property.views}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-900">{property.inquiries}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Leads</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-[#b98f42] transition-colors">
                      <ExternalLink className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
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
          <p className="text-sm text-gray-500 font-medium">Showing <span className="text-gray-900 font-bold">1-10</span> of <span className="text-gray-900 font-bold">154</span> properties</p>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-400 cursor-not-allowed">Previous</button>
            <button className="px-4 py-2 border border-[#b98f42] bg-[#b98f42] rounded-lg text-sm font-bold text-white shadow-sm">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPropertiesPage;
