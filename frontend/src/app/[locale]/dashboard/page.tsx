'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  TrendingUp,
  Home,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  Handshake,
  ListChecks,
  Loader2,
  Trophy,
} from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import type { DashboardStats } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/crmStores';
import { BarList, ColumnChart } from '@/components/dashboard/charts';
import {
  Badge,
  ErrorBanner,
  formatCompactMoney,
  formatDate,
  formatTime,
  PRIORITY_COLORS,
  timeAgo,
} from '@/components/dashboard/ui';

interface KPIStatProps {
  title: string;
  value: React.ReactNode;
  /** Percent change vs the previous 30 days; omitted when there is no baseline. */
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
}

const KPIStat = ({ title, value, change, icon: Icon }: KPIStatProps) => {
  const hasChange = change !== undefined && change !== null;
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-gray-50 rounded-xl text-[#b98f42]">
          <Icon className="w-6 h-6" />
        </div>
        {hasChange && (
          <div
            title="vs previous 30 days"
            className={`flex items-center text-sm font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change!)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new: Clock,
  contacted: UserCheck,
  qualified: CheckCircle2,
  viewing_scheduled: Calendar,
};

const STATUS_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-50 text-gray-600',
};

const RANGE_LABELS = { '7d': 'Last 7 Days', '30d': 'Last 30 Days', '12m': 'Last Year' } as const;

function formatPeriod(label: string, range: DashboardStats['range']) {
  const [y, m, d] = label.split('-').map(Number);
  const date = new Date(y, m - 1, d || 1);
  return range === '12m'
    ? date.toLocaleDateString('en-GB', { month: 'short' })
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const AdminDashboardOverview = () => {
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const statusLabel = useSettingsStore((s) => s.statusLabel);
  const statusColor = useSettingsStore((s) => s.statusColor);
  useSettingsStore((s) => s.settings);

  const [range, setRange] = useState<DashboardStats['range']>('30d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: DashboardStats }>('/dashboard/stats', { params: { range } })
      .then(({ data }) => {
        if (cancelled) return;
        setStats(data.data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const base = `/${locale}/dashboard`;
  const firstName = user?.full_name.split(' ')[0] ?? '';

  if (!stats && !error) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#b98f42]" />
      </div>
    );
  }

  const leads = stats?.leads;
  const properties = stats?.properties;
  const areaRows = (stats?.demand_by_area.length ? stats.demand_by_area : properties?.by_area ?? []).map((a) => ({
    label: a.area,
    value: a.count,
  }));
  const areaIsDemand = Boolean(stats?.demand_by_area.length);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, {firstName}</h1>
          <p className="text-gray-500 font-medium tracking-tight">
            {stats?.scope === 'mine'
              ? 'Here is your pipeline at ELITE Real Estate today.'
              : "Here's what's happening with ELITE Real Estate today."}
          </p>
        </div>
        <Link
          href={`${base}/leads`}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b98f42] transition-all flex items-center gap-2"
        >
          <MessageSquare className="w-5 h-5" />
          View All Leads
        </Link>
      </div>

      <ErrorBanner message={error} />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {properties && <KPIStat title="Total Properties" value={properties.total} change={properties.change_30d} icon={Home} />}
        {properties && <KPIStat title="Active Listings" value={properties.active_listings} icon={Eye} />}
        {leads && <KPIStat title="Total Leads" value={leads.total} change={leads.change_30d} icon={MessageSquare} />}
        {leads && <KPIStat title="New Leads" value={leads.new} icon={Clock} />}
      </div>

      {/* Secondary figures */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {([
          leads && { label: 'Active Leads', value: leads.active },
          leads && { label: 'Converted', value: leads.converted },
          properties && { label: 'Available', value: properties.available },
          properties && { label: 'Rented', value: properties.rented },
          properties && { label: 'Sold', value: properties.sold },
          stats?.deals && { label: 'Commission Earned', value: formatCompactMoney(stats.deals.commission, stats.currency) },
        ] as ({ label: string; value: string | number } | null | undefined)[])
          .filter((x): x is { label: string; value: string | number } => Boolean(x))
          .map((item) => (
            <div key={item.label} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-2">{item.label}</p>
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
            </div>
          ))}
      </div>

      {/* Main Grid: Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {leads && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#b98f42]" />
                  Leads Growth
                </h2>
                <select
                  aria-label="Date range"
                  value={range}
                  onChange={(event) => setRange(event.target.value as DashboardStats['range'])}
                  className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg text-sm outline-none"
                >
                  {Object.entries(RANGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {stats!.lead_growth.some((p) => p.count > 0) ? (
                <ColumnChart
                  points={stats!.lead_growth}
                  formatLabel={(label) => formatPeriod(label, stats!.range)}
                  caption={`New leads per ${stats!.range === '12m' ? 'month' : 'day'}, ${RANGE_LABELS[stats!.range].toLowerCase()}`}
                />
              ) : (
                <p className="py-20 text-center text-gray-400 font-medium">No leads in this period yet.</p>
              )}
            </div>
          )}

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Home className="w-5 h-5 text-[#b98f42]" />
              Popular Areas
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              {areaIsDemand ? 'Leads by preferred location' : 'Listings by area'}
            </p>
            {areaRows.length ? (
              <BarList rows={areaRows} unit={areaIsDemand ? 'leads' : 'listings'} caption="Popular areas" />
            ) : (
              <p className="py-12 text-center text-gray-400 font-medium">No location data yet.</p>
            )}
          </div>
        </div>

        {/* Sidebar: Recent Leads */}
        {leads && (
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-8">Recent Leads</h2>
              <div className="space-y-6">
                {leads.recent.length === 0 && <p className="text-sm text-gray-400">No leads yet.</p>}
                {leads.recent.map((lead) => {
                  const Icon = STATUS_ICONS[lead.status] ?? MessageSquare;
                  const color = statusColor(lead.status);
                  return (
                    <div key={lead._id} className="flex items-start gap-4 pb-6 border-b border-gray-50 last:border-0 last:pb-0">
                      <div className={`p-3 rounded-xl ${STATUS_TONES[color] ?? STATUS_TONES.gray}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-bold text-gray-900 truncate">{lead.full_name}</p>
                          <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">{timeAgo(lead.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2 truncate max-w-[180px]">
                          {lead.interested_properties[0]?.title_en ?? 'General enquiry'}
                        </p>
                        <Badge color={color}>{statusLabel(lead.status)}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                href={`${base}/leads`}
                className="block text-center w-full mt-8 py-4 text-sm font-bold text-[#b98f42] hover:bg-gray-50 rounded-xl transition-all border-2 border-dashed border-[#b98f42]/20"
              >
                View All Leads
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline: viewings, follow-ups, deals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {stats?.viewings && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#b98f42]" /> Upcoming Viewings
              </h2>
              <span className="text-2xl font-bold text-gray-900">{stats.viewings.upcoming}</span>
            </div>
            <ul className="space-y-4">
              {stats.viewings.next.length === 0 && <li className="text-sm text-gray-400">Nothing scheduled.</li>}
              {stats.viewings.next.map((v) => (
                <li key={v._id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{v.property?.title_en}</p>
                    <p className="text-gray-500 truncate">{v.lead?.full_name ?? v.client?.full_name} · {v.assigned_agent?.full_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{formatDate(v.scheduled_at)}</p>
                    <p className="text-xs text-gray-400">{formatTime(v.scheduled_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href={`${base}/viewings`} className="mt-6 inline-block text-sm font-bold text-[#b98f42] hover:underline">
              All viewings →
            </Link>
          </div>
        )}

        {stats?.tasks && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-[#b98f42]" /> Pending Follow-ups
              </h2>
              <span className="text-2xl font-bold text-gray-900">{stats.tasks.pending}</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-6">
              <span className={stats.tasks.overdue ? 'text-red-600' : 'text-gray-400'}>{stats.tasks.overdue} overdue</span>
              <span className="text-gray-300"> · </span>
              <span className="text-gray-400">{stats.tasks.lead_follow_ups_due} lead follow-ups due</span>
            </p>
            <ul className="space-y-4">
              {stats.tasks.next.length === 0 && <li className="text-sm text-gray-400">All caught up.</li>}
              {stats.tasks.next.map((task) => {
                const overdue = task.due_at && new Date(task.due_at) < new Date();
                return (
                  <li key={task._id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{task.title}</p>
                      <p className="text-gray-500 truncate">{task.lead?.full_name ?? task.client?.full_name ?? task.assigned_agent?.full_name}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className={`text-xs font-bold ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {task.due_at ? formatDate(task.due_at) : 'No due date'}
                      </p>
                      <Badge color={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href={`${base}/tasks`} className="mt-6 inline-block text-sm font-bold text-[#b98f42] hover:underline">
              All tasks →
            </Link>
          </div>
        )}

        {stats?.deals && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
              <Handshake className="w-5 h-5 text-[#b98f42]" /> Deals & Revenue
            </h2>
            <dl className="grid grid-cols-2 gap-6">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Open Deals</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{stats.deals.open}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Pipeline Value</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{formatCompactMoney(stats.deals.pipeline_value, stats.currency)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Completed</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{stats.deals.completed}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Revenue</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{formatCompactMoney(stats.deals.revenue, stats.currency)}</dd>
              </div>
            </dl>
            <div className="mt-6 rounded-xl bg-[#b98f42]/5 border border-[#b98f42]/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#b98f42]">Commission this month</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCompactMoney(stats.deals.this_month.commission, stats.currency)}</p>
              <p className="text-xs text-gray-500">{stats.deals.this_month.count} deal{stats.deals.this_month.count === 1 ? '' : 's'} closed</p>
            </div>
            <Link href={`${base}/deals`} className="mt-6 inline-block text-sm font-bold text-[#b98f42] hover:underline">
              All deals →
            </Link>
          </div>
        )}
      </div>

      {/* Agent performance (managers & admins) */}
      {stats?.agents && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#b98f42]" /> Agent Performance
            </h2>
            <p className="text-sm text-gray-500 mt-1">All-time, ranked by commission earned.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  {['Agent', 'Listings', 'Leads', 'Won', 'Conversion', 'Viewings Done', 'Deals Closed', 'Revenue', 'Commission'].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.agents.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-10 text-center text-sm text-gray-400">No agent activity yet.</td></tr>
                )}
                {stats.agents.map((agent) => (
                  <tr key={agent._id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">{agent.full_name}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.listings}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.leads}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.won_leads}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.conversion_rate === null ? '—' : `${agent.conversion_rate}%`}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.viewings_completed}</td>
                    <td className="px-6 py-4 tabular-nums">{agent.deals_completed}</td>
                    <td className="px-6 py-4 tabular-nums">{formatCompactMoney(agent.revenue, stats.currency)}</td>
                    <td className="px-6 py-4 tabular-nums font-bold text-gray-900">{formatCompactMoney(agent.commission, stats.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardOverview;
