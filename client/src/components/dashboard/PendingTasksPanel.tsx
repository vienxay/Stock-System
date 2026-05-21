import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints';
import type { PendingTask } from '@/types';

export function PendingTasksPanel() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn:  () => dashboardApi.tasks(),
    staleTime:  30_000,
    refetchInterval: 60_000,
  });

  const tasks: PendingTask[] = (data?.data as { data: PendingTask[] } | undefined)?.data ?? [];

  if (isLoading) {
    return (
      <div className="card animate-pulse h-24" />
    );
  }

  if (tasks.length === 0) return null;

  return (
    <div className="card border-l-4 border-l-primary-500">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">ງານຄ້າງ ({tasks.length})</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => navigate(t.href)}
            className={`text-left p-4 rounded-xl border transition-colors hover:shadow-md
              ${t.priority === 'high'
                ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{t.message}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`text-lg font-bold ${t.priority === 'high' ? 'text-orange-600' : 'text-primary-600'}`}>
                  {t.count}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
