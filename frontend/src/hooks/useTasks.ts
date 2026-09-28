import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';
import type { Task, TaskStatus, CreateTaskForm, UpdateTaskForm, ApiResponse } from '@/types';
import { triggerTaskCompletionEffect } from '@/utils/celebration';
import { isTaskArchived } from '@/utils/dateUtils';
import toast from 'react-hot-toast';

const TASKS_KEY = ['tasks'];

export interface ReorderTaskItem {
  id: string;
  order: number;
  status?: TaskStatus;
}

async function fetchTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<ApiResponse<Task[]>>('/tasks');
  return data.data;
}

async function createTask(form: CreateTaskForm): Promise<Task> {
  const { data } = await apiClient.post<ApiResponse<Task>>('/tasks', form);
  return data.data;
}

async function updateTask({ id, form }: { id: string; form: UpdateTaskForm }): Promise<Task> {
  const { data } = await apiClient.put<ApiResponse<Task>>(`/tasks/${id}`, form);
  return data.data;
}

async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`);
}

async function completeTask(id: string): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/complete`);
  return data.data;
}

async function skipTask(id: string): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/skip`);
  return data.data;
}

async function archiveTask({
  id,
  isArchived = true,
  reopen = false,
}: {
  id: string;
  isArchived?: boolean;
  reopen?: boolean;
}): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/archive`, {
    isArchived,
    reopen,
  });
  return data.data;
}

async function reorderTasks(items: ReorderTaskItem[]): Promise<Task[]> {
  const { data } = await apiClient.patch<ApiResponse<Task[]>>('/tasks/reorder', { items });
  return data.data;
}

export function useTasks() {
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: TASKS_KEY });
    qc.invalidateQueries({ queryKey: ['analytics'] });
    qc.invalidateQueries({ queryKey: ['recommendation'] });
    qc.invalidateQueries({ queryKey: ['schedule'] });
  };

  const tasksQuery = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => { invalidateAll(); toast.success('Task created'); },
    onError: () => toast.error('Failed to create task'),
  });

  const updateMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => { invalidateAll(); toast.success('Task updated'); },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { invalidateAll(); toast.success('Task deleted'); },
    onError: () => toast.error('Failed to delete task'),
  });

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onMutate: () => {
      triggerTaskCompletionEffect();
    },
    onSuccess: () => { invalidateAll(); toast.success('Task marked complete'); },
    onError: () => toast.error('Failed to complete task'),
  });

  const skipMutation = useMutation({
    mutationFn: skipTask,
    onSuccess: () => { invalidateAll(); toast.success('Task marked as skipped'); },
    onError: () => toast.error('Failed to skip task'),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveTask,
    onSuccess: (_data, vars) => {
      invalidateAll();
      toast.success(
        vars.isArchived === false
          ? vars.reopen
            ? 'Task reopened and restored'
            : 'Task restored from archive'
          : 'Task moved to archive'
      );
    },
    onError: () => toast.error('Failed to update archive status'),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTasks,
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previous = qc.getQueryData<Task[]>(TASKS_KEY);
      if (previous) {
        const orderMap = new Map(items.map((item) => [item.id, item]));
        const next = previous
          .map((t) => {
            const update = orderMap.get(t._id);
            if (!update) return t;
            return {
              ...t,
              order: update.order,
              status: update.status ?? t.status,
            };
          })
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        qc.setQueryData(TASKS_KEY, next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(TASKS_KEY, context.previous);
      }
      toast.error('Failed to save task order');
    },
    onSuccess: (updatedTasks) => {
      qc.setQueryData(TASKS_KEY, updatedTasks);
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['recommendation'] });
    },
  });

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const archivedTasks = useMemo(
    () => allTasks.filter((t) => isTaskArchived(t)),
    [allTasks]
  );
  const activeViewTasks = useMemo(
    () => allTasks.filter((t) => !isTaskArchived(t)),
    [allTasks]
  );

  return {
    tasks:         allTasks,
    activeTasks:   activeViewTasks,
    archivedTasks,
    isLoading:     tasksQuery.isLoading,
    error:         tasksQuery.error,
    refetch:       tasksQuery.refetch,
    createTask:    createMutation.mutateAsync,
    updateTask:    (id: string, form: UpdateTaskForm) => updateMutation.mutateAsync({ id, form }),
    deleteTask:    deleteMutation.mutateAsync,
    completeTask:  completeMutation.mutateAsync,
    skipTask:      skipMutation.mutateAsync,
    archiveTask:   (id: string, isArchived = true, reopen = false) =>
      archiveMutation.mutateAsync({ id, isArchived, reopen }),
    reorderTasks:  reorderMutation.mutateAsync,
  };
}
