'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Edit2, Plus, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';
import { PRIORITIES, TASK_TYPES, humanize } from '@/lib/shared/constants';
import type { TaskRow } from '@/lib/shared/types';
import { useAuthStore } from '@/store/authStore';
import { useTasksStore } from '@/store/crmStores';
import { AgentSelect, EntityPicker } from '@/components/dashboard/pickers';
import { cleanPayload, SelectInput, TextArea, TextInput, toIso, useCrmForm } from '@/components/dashboard/form';
import {
  Badge,
  ConfirmDialog,
  ErrorBanner,
  Field,
  FilterBar,
  FilterSelect,
  formatDate,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  PRIORITY_COLORS,
  SecondaryButton,
  Table,
  TableState,
  toLocalInput,
} from '@/components/dashboard/ui';

function TaskFormModal({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const can = useAuthStore((s) => s.can);
  const create = useTasksStore((s) => s.create);
  const update = useTasksStore((s) => s.update);
  const form = useCrmForm({
    title: task?.title ?? '',
    description: task?.description ?? '',
    type: task?.type ?? 'follow_up',
    priority: task?.priority ?? 'medium',
    lead: task?.lead?._id ?? '',
    client: task?.client?._id ?? '',
    assigned_agent: task?.assigned_agent?._id ?? '',
    due_at: toLocalInput(task?.due_at),
  });
  const { values, errors } = form;
  const set = form.set as (key: string, value: unknown) => void;
  const common = { values, set, errors };

  const save = async () => {
    const payload: Record<string, unknown> = {
      ...cleanPayload(values, ['title', 'description', 'type', 'priority', 'lead', 'client']),
      due_at: toIso(values.due_at),
    };
    if (can('tasks.update_all') && values.assigned_agent) payload.assigned_agent = values.assigned_agent;
    const ok = await form.submit(() => (task ? update(task._id, payload) : create(payload)));
    if (ok) onClose();
  };

  return (
    <Modal
      open
      title={task ? 'Edit Task' : 'New Task'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} loading={form.saving}>{task ? 'Save Changes' : 'Create Task'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={form.formError} />
        <TextInput name="title" label="Title" required placeholder="Call back about The Pearl 2BR" {...common} />
        <div className="grid gap-4 md:grid-cols-3">
          <SelectInput name="type" label="Type" options={TASK_TYPES.map((t) => ({ value: t, label: humanize(t) }))} {...common} />
          <SelectInput name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))} {...common} />
          <TextInput name="due_at" label="Due" type="datetime-local" {...common} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Lead" error={errors.lead}>
            <EntityPicker
              resource="leads"
              value={values.lead || null}
              initial={task?.lead ? { _id: task.lead._id, label: task.lead.full_name } : null}
              placeholder="Search leads…"
              onChange={(id) => set('lead', id ?? '')}
            />
          </Field>
          <Field label="Client" error={errors.client}>
            <EntityPicker
              resource="clients"
              value={values.client || null}
              initial={task?.client ? { _id: task.client._id, label: task.client.full_name } : null}
              placeholder="Search clients…"
              onChange={(id) => set('client', id ?? '')}
            />
          </Field>
        </div>
        {can('tasks.update_all') && (
          <Field label="Assign to">
            <AgentSelect value={values.assigned_agent} emptyLabel="Me" onChange={(id) => set('assigned_agent', id ?? '')} />
          </Field>
        )}
        <TextArea name="description" label="Description" {...common} />
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const { items, meta, filters, loading, error, setFilters, setPage, fetch, remove, update } = useTasksStore();
  const can = useAuthStore((s) => s.can);
  const [form, setForm] = useState<{ task: TaskRow | null } | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const view = filters.overdue ? 'overdue' : filters.completed === false ? 'open' : filters.completed === true ? 'done' : 'all';
  const now = new Date();

  const toggleDone = async (task: TaskRow) => {
    try {
      await update(task._id, { completed: !task.completed });
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tasks & Follow-ups"
        subtitle="Calls, WhatsApps, meetings and follow-ups for your leads and clients."
        actions={
          can('tasks.create') && (
            <PrimaryButton onClick={() => setForm({ task: null })}>
              <Plus className="h-5 w-5" /> New Task
            </PrimaryButton>
          )
        }
      />
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <FilterBar>
        <div className="flex gap-2">
          {(['open', 'overdue', 'done', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                setFilters({
                  completed: v === 'open' ? false : v === 'done' ? true : undefined,
                  overdue: v === 'overdue' ? true : undefined,
                  sort: v === 'done' ? '-created_at' : 'due_at',
                })
              }
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === v ? 'bg-[#b98f42] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {humanize(v)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Type" value={String(filters.type ?? '')} onChange={(type) => setFilters({ type })}>
            <option value="">Type: All</option>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </FilterSelect>
          <FilterSelect label="Priority" value={String(filters.priority ?? '')} onChange={(priority) => setFilters({ priority })}>
            <option value="">Priority: All</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </FilterSelect>
          {can('tasks.read_all') && (
            <div className="w-48">
              <AgentSelect
                value={String(filters.assigned_agent ?? '')}
                onChange={(id) => setFilters({ assigned_agent: id ?? '' })}
                emptyLabel="Agent: All"
                className="py-2 rounded-lg bg-white font-bold text-gray-600"
              />
            </div>
          )}
        </div>
      </FilterBar>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Table headers={[{ label: '' }, { label: 'Task' }, { label: 'Related to' }, { label: 'Due' }, { label: 'Priority' }, { label: 'Assigned' }, { label: 'Actions', align: 'right' }]}>
          <TableState colSpan={7} loading={loading && items.length === 0} error={error} empty={!loading && items.length === 0} emptyText="Nothing to do here." />
          {items.map((task) => {
            const overdue = !task.completed && task.due_at && new Date(task.due_at) < now;
            return (
              <tr key={task._id} className="transition-all hover:bg-gray-50/50">
                <td className="w-12 py-6 pl-6">
                  <button
                    type="button"
                    aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
                    disabled={!can('tasks.update')}
                    onClick={() => toggleDone(task)}
                    className="text-gray-300 hover:text-[#b98f42]"
                  >
                    {task.completed ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6" />}
                  </button>
                </td>
                <td className="px-6 py-6">
                  <p className={`font-bold ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{humanize(task.type)}</p>
                </td>
                <td className="px-6 py-6 text-sm text-gray-700">{task.lead?.full_name ?? task.client?.full_name ?? '—'}</td>
                <td className={`px-6 py-6 text-sm font-bold ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
                  {task.due_at ? formatDate(task.due_at, true) : '—'}
                  {overdue && <span className="block text-[10px] uppercase tracking-wider">Overdue</span>}
                </td>
                <td className="px-6 py-6"><Badge color={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge></td>
                <td className="px-6 py-6 text-sm font-medium text-gray-700">{task.assigned_agent?.full_name}</td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {can('tasks.update') && <IconButton title="Edit" onClick={() => setForm({ task })}><Edit2 className="h-5 w-5" /></IconButton>}
                    {can('tasks.delete') && <IconButton title="Delete" tone="danger" onClick={() => setDeleting(task)}><Trash2 className="h-5 w-5" /></IconButton>}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
        <Pagination meta={meta} noun="tasks" onPage={setPage} />
      </div>

      {form && <TaskFormModal key={form.task?._id ?? 'new'} task={form.task} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete task"
        message={`Delete “${deleting?.title}”?`}
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
