'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { LANGUAGES, ROLE_LABELS, ROLES, type Role, humanize } from '@/lib/shared/constants';
import { ACTIONS, RESOURCES, ROLE_PERMISSIONS, ROLE_RANK, type Permission } from '@/lib/shared/permissions';
import type { UserRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useUsersStore } from '@/store/crmStores';
import { useAgentsStore } from '@/components/dashboard/pickers';
import { CheckboxGroup, cleanPayload, NumberInput, SelectInput, TextInput, useCrmForm } from '@/components/dashboard/form';
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  formatDate,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  SectionTitle,
  Table,
  TableState,
  Toggle,
} from '@/components/dashboard/ui';

const ROLE_COLORS: Record<Role, string> = { admin: 'black', manager: 'purple', broker: 'gold', staff: 'blue', user: 'gray' };

/** Per-user overrides on top of the role: each cell is default / granted / revoked. */
function PermissionMatrix({
  role,
  granted,
  revoked,
  onChange,
}: {
  role: Role;
  granted: Permission[];
  revoked: Permission[];
  onChange: (granted: Permission[], revoked: Permission[]) => void;
}) {
  const defaults = new Set(ROLE_PERMISSIONS[role]);
  const effective = (p: Permission) => (defaults.has(p) ? !revoked.includes(p) : granted.includes(p));
  const toggle = (p: Permission) => {
    if (defaults.has(p)) {
      onChange(granted, revoked.includes(p) ? revoked.filter((x) => x !== p) : [...revoked, p]);
    } else {
      onChange(granted.includes(p) ? granted.filter((x) => x !== p) : [...granted, p], revoked);
    }
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Area</th>
            {ACTIONS.map((a) => (
              <th key={a} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">{humanize(a)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {RESOURCES.map((r) => (
            <tr key={r}>
              <td className="px-3 py-2 font-bold text-gray-700">{humanize(r)}</td>
              {ACTIONS.map((a) => {
                const p = `${r}.${a}` as Permission;
                const on = effective(p);
                const overridden = defaults.has(p) ? revoked.includes(p) : granted.includes(p);
                return (
                  <td key={a} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={p}
                      checked={on}
                      onChange={() => toggle(p)}
                      className={`h-4 w-4 accent-[#b98f42] ${overridden ? 'ring-2 ring-offset-1 ring-amber-400 rounded' : ''}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bg-gray-50 px-3 py-2 text-xs text-gray-500">Highlighted boxes differ from the role’s defaults.</p>
    </div>
  );
}

function UserFormModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const create = useUsersStore((s) => s.create);
  const update = useUsersStore((s) => s.update);
  const form = useCrmForm({
    full_name: user?.full_name ?? '',
    full_name_ar: user?.full_name_ar ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    whatsapp: user?.whatsapp ?? '',
    photo: user?.photo ?? '',
    role: (user?.role ?? 'broker') as Role,
    title_en: user?.title_en ?? '',
    title_ar: user?.title_ar ?? '',
    languages: user?.languages ?? ['en'],
    response_minutes: user?.response_minutes ?? '',
    is_superagent: user?.is_superagent ?? false,
    is_active: user?.is_active ?? true,
    password: '',
  });
  const [granted, setGranted] = useState<Permission[]>(user?.permissions ?? []);
  const [revoked, setRevoked] = useState<Permission[]>(user?.revoked_permissions ?? []);
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };
  const isAdmin = me?.role === 'admin';
  const assignableRoles = ROLES.filter((r) => isAdmin || ROLE_RANK[r] < ROLE_RANK[me?.role ?? 'user']);

  const save = async () => {
    const payload: Record<string, unknown> = cleanPayload(values, [
      'full_name', 'full_name_ar', 'email', 'phone', 'whatsapp', 'photo', 'role', 'title_en', 'title_ar',
      'languages', 'response_minutes', 'is_superagent', 'is_active',
    ]);
    if (values.password) payload.password = values.password;
    if (isAdmin) {
      payload.permissions = granted;
      payload.revoked_permissions = revoked;
    }
    const ok = await form.submit(() => (user ? update(user._id, payload) : create(payload)));
    if (ok) {
      useAgentsStore.setState({ loaded: false });
      onClose();
    }
  };

  return (
    <Modal
      open
      wide
      title={user ? `Edit ${user.full_name}` : 'Add User'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{user ? 'Save Changes' : 'Create User'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-8">
        <ErrorBanner message={form.formError} />
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput name="full_name" label="Full name" required {...common} />
          <TextInput name="full_name_ar" label="Name (Arabic)" {...common} />
          <TextInput name="email" label="Email" type="email" required {...common} />
          <TextInput name="phone" label="Phone" type="tel" {...common} />
          <TextInput name="whatsapp" label="WhatsApp" type="tel" {...common} />
          <SelectInput name="role" label="Role" options={assignableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} {...common} />
          <TextInput
            name="password"
            label={user ? 'New password' : 'Password'}
            type="password"
            required={!user}
            hint={user ? 'Leave blank to keep the current password' : 'At least 8 characters, with a number'}
            {...common}
          />
          <div className="flex items-end gap-6 pb-3 md:col-span-2">
            <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
              <Toggle checked={Boolean(values.is_active)} onChange={(v) => set('is_active', v)} label="Active" /> Active
            </label>
          </div>
        </div>

        <div>
          <SectionTitle>Public broker profile (shown on listings)</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput name="title_en" label="Job title" placeholder="Senior Property Consultant" {...common} />
            <TextInput name="title_ar" label="Job title (Arabic)" {...common} />
            <NumberInput name="response_minutes" label="Typical response (minutes)" {...common} />
            <TextInput name="photo" label="Photo URL" className="md:col-span-2" hint="Unsplash or Cloudinary URL" {...common} />
            <label className="flex items-center gap-3 self-end pb-3 text-sm font-bold text-gray-700">
              <Toggle checked={Boolean(values.is_superagent)} onChange={(v) => set('is_superagent', v)} label="Superagent" /> Superagent badge
            </label>
          </div>
          <CheckboxGroup name="languages" label="Languages" className="mt-4" options={LANGUAGES.map((l) => ({ value: l, label: l.toUpperCase() }))} {...common} />
        </div>

        {isAdmin && values.role !== 'admin' && (
          <div>
            <SectionTitle>Permissions</SectionTitle>
            <PermissionMatrix
              role={values.role as Role}
              granted={granted}
              revoked={revoked}
              onChange={(g, r) => {
                setGranted(g);
                setRevoked(r);
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove } = useUsersStore();
  const can = useAuthStore((s) => s.can);
  const me = useAuthStore((s) => s.user);
  const [form, setForm] = useState<{ user: UserRow | null } | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const canManage = (u: UserRow) => me?.role === 'admin' || ROLE_RANK[u.role] < ROLE_RANK[me?.role ?? 'user'];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users & Agents"
        subtitle="Team accounts, roles and permissions, plus website customers."
        actions={
          can('users.create') && (
            <PrimaryButton onClick={() => setForm({ user: null })}>
              <Plus className="h-5 w-5" /> Add User
            </PrimaryButton>
          )
        }
      />
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <FilterBar>
        <SearchInput value={String(filters.q ?? '')} onChange={(q) => setFilters({ q })} placeholder="Search by name or email..." />
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Role" value={String(filters.role ?? '')} onChange={(role) => setFilters({ role })}>
            <option value="">Role: All</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Status"
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={(v) => setFilters({ is_active: v === '' ? undefined : v === 'true' })}
          >
            <option value="">Status: All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </FilterSelect>
        </div>
      </FilterBar>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Table headers={[{ label: 'User' }, { label: 'Role' }, { label: 'Status' }, { label: 'Last login' }, { label: 'Actions', align: 'right' }]}>
          <TableState colSpan={5} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="No users found." />
          {items.map((u) => (
            <tr key={u._id} className="transition-all hover:bg-gray-50/50">
              <td className="px-6 py-5">
                <p className="font-bold text-gray-900">{u.full_name}{u._id === me?.id && <span className="ms-2 text-xs text-gray-400">(you)</span>}</p>
                <p className="text-xs text-gray-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
              </td>
              <td className="px-6 py-5">
                <Badge color={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                {(u.permissions?.length > 0 || u.revoked_permissions?.length > 0) && (
                  <span className="ms-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">custom</span>
                )}
              </td>
              <td className="px-6 py-5"><Badge color={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
              <td className="px-6 py-5 text-sm text-gray-500">{u.last_login_at ? formatDate(u.last_login_at, true) : 'Never'}</td>
              <td className="px-6 py-5 text-right">
                <div className="flex items-center justify-end gap-2">
                  {can('users.update_all') && canManage(u) && (
                    <IconButton title="Edit" onClick={() => setForm({ user: u })}><Edit2 className="h-5 w-5" /></IconButton>
                  )}
                  {can('users.delete') && canManage(u) && u._id !== me?.id && (
                    <IconButton title="Delete" tone="danger" onClick={() => setDeleting(u)}><Trash2 className="h-5 w-5" /></IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination meta={meta} noun="users" onPage={setPage} />
      </div>

      {form && <UserFormModal key={form.user?._id ?? 'new'} user={form.user} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete user"
        message={`Delete ${deleting?.full_name}? Users with assigned records cannot be deleted — deactivate them instead.`}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await remove(deleting._id);
          } catch (err) {
            setActionError(apiErrorMessage(err));
          } finally {
            setDeleting(null);
            setBusy(false);
          }
        }}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </div>
  );
}
