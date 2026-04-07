'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath }    from 'next/cache';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TaskPriority = 'urgente' | 'haute' | 'normale' | 'basse';

export interface PersonalTask {
  id:             string;
  name:           string;
  note:           string | null;
  done:           boolean;
  due:            string | null;
  priority:       TaskPriority;
  user_id:        string;
  tenant_id:      string;
  created_at:     string;
  reminder_date:  string | null;
  reminder_time:  string | null;
  reminder_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PATHS = [
  '/pilotage/dashboard',
  '/commerce',
  '/chef-projet',
  '/technicien',
  '/rh',
];

function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

// ── getPersonalTasks ───────────────────────────────────────────────────────────

export async function getPersonalTasks(
  tenantId: string,
  userId:   string,
): Promise<PersonalTask[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_tasks')
    .select('id, name, note, done, due, priority, user_id, tenant_id, created_at, reminder_date, reminder_time, reminder_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_personal', true)
    .order('done',     { ascending: true })
    .order('priority', { ascending: false })  // re-sorted client-side
    .order('due',      { ascending: true, nullsFirst: false });

  return (data ?? []).map((t) => ({
    id:              t.id,
    name:            t.name,
    note:            (t.note as string | null) ?? null,
    done:            t.done ?? false,
    due:             (t.due as string | null) ?? null,
    priority:        ((t.priority as string) ?? 'normale') as TaskPriority,
    user_id:         t.user_id as string,
    tenant_id:       t.tenant_id as string,
    created_at:      t.created_at as string,
    reminder_date:   (t.reminder_date as string | null) ?? null,
    reminder_time:   (t.reminder_time as string | null) ?? null,
    reminder_active: (t.reminder_active as boolean) ?? false,
  }));
}

// ── createPersonalTask ─────────────────────────────────────────────────────────

export async function createPersonalTask(
  tenantId: string,
  userId:   string,
  task: {
    name:      string;
    note?:     string;
    due?:      string;
    priority?: TaskPriority;
    reminder_date?: string;
    reminder_time?: string;
  },
): Promise<{ id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('project_tasks')
    .insert({
      tenant_id:      tenantId,
      user_id:        userId,
      name:           task.name.trim(),
      note:           task.note?.trim() || null,
      due:            task.due || null,
      priority:       task.priority ?? 'normale',
      is_personal:    true,
      done:           false,
      reminder_date:  task.reminder_date || null,
      reminder_time:  task.reminder_time || null,
      reminder_active: !!(task.reminder_date && task.reminder_time),
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidateAll();
  return { id: data?.id };
}

// ── updatePersonalTask ─────────────────────────────────────────────────────────

export async function updatePersonalTask(
  taskId: string,
  userId: string,
  patch: {
    name?:          string;
    note?:          string | null;
    due?:           string | null;
    priority?:      TaskPriority;
    reminder_date?: string | null;
    reminder_time?: string | null;
  },
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name      !== undefined) updates.name          = patch.name.trim();
  if (patch.note      !== undefined) updates.note          = patch.note?.trim() || null;
  if (patch.due       !== undefined) updates.due           = patch.due || null;
  if (patch.priority  !== undefined) updates.priority      = patch.priority;
  if (patch.reminder_date !== undefined) {
    updates.reminder_date   = patch.reminder_date || null;
    updates.reminder_time   = patch.reminder_time || null;
    updates.reminder_active = !!(patch.reminder_date && patch.reminder_time);
  }

  const { error } = await admin
    .from('project_tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', userId);   // sécurité : seul le propriétaire peut modifier

  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

// ── togglePersonalTask ─────────────────────────────────────────────────────────

export async function togglePersonalTask(
  taskId: string,
  done:   boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('project_tasks')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}

// ── deletePersonalTask ─────────────────────────────────────────────────────────

export async function deletePersonalTask(
  taskId: string,
  userId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('project_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);   // sécurité : seul le propriétaire peut supprimer
  if (error) return { error: error.message };
  revalidateAll();
  return {};
}
