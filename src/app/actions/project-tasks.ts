'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath }    from 'next/cache';

const PATH = '/chef-projet';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectTask {
  id:              string;
  project_id:      string;
  name:            string;
  done:            boolean;
  due:             string | null;
  priority:        'high' | 'mid' | 'low';
  sort_order:      number;
  reminder_time:   string | null;
  reminder_date:   string | null;
  reminder_email:  string | null;
  reminder_active: boolean;
  created_at:      string;
}

// ── getProjectTasks ───────────────────────────────────────────────────────────

export async function getProjectTasks(
  projectId: string,
  tenantId:  string,
): Promise<ProjectTask[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('created_at');
  return (data ?? []) as ProjectTask[];
}

// ── addProjectTask ────────────────────────────────────────────────────────────

export async function addProjectTask(
  projectId: string,
  tenantId:  string,
  name:      string,
  due?:      string,
): Promise<{ id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('project_tasks')
    .insert({
      project_id: projectId,
      tenant_id:  tenantId,
      name:       name.trim(),
      due:        due || null,
    })
    .select('id')
    .single();
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { id: data?.id };
}

// ── toggleProjectTask ─────────────────────────────────────────────────────────

export async function toggleProjectTask(
  taskId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from('project_tasks')
    .select('done')
    .eq('id', taskId)
    .single();
  const { error } = await admin
    .from('project_tasks')
    .update({ done: !current?.done, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

// ── deleteProjectTask ─────────────────────────────────────────────────────────

export async function deleteProjectTask(
  taskId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('project_tasks')
    .delete()
    .eq('id', taskId);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

// ── updateTaskReminder ────────────────────────────────────────────────────────

export async function updateTaskReminder(
  taskId:        string,
  reminderDate:  string,
  reminderTime:  string,
  reminderEmail: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('project_tasks')
    .update({
      reminder_date:   reminderDate,
      reminder_time:   reminderTime,
      reminder_email:  reminderEmail,
      reminder_active: true,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

// ── clearTaskReminder ─────────────────────────────────────────────────────────

export async function clearTaskReminder(
  taskId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('project_tasks')
    .update({
      reminder_date:   null,
      reminder_time:   null,
      reminder_email:  null,
      reminder_active: false,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}
