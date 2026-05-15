import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { notifApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notifApi.list({ limit: '50' }),
  });

  const readAllMut = useMutation({
    mutationFn: () => notifApi.readAll(),
    onSuccess:  () => { toast.success('ອ່ານທັງໝົດແລ້ວ'); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const readMut = useMutation({
    mutationFn: (id: number) => notifApi.read(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows: Notification[] = (data?.data as { data: Notification[] } | undefined)?.data ?? [];
  const unread = rows.filter((r) => !r.isRead).length;

  if (isLoading) return <div className="text-center py-12 text-gray-400">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{unread > 0 ? `${unread} ລາຍການຍັງບໍ່ໄດ້ອ່ານ` : 'ອ່ານທຸກລາຍການແລ້ວ'}</p>
        {unread > 0 && (
          <Button variant="secondary" loading={readAllMut.isPending} onClick={() => readAllMut.mutate()}>
            <CheckCheck className="w-4 h-4" />ອ່ານທັງໝົດ
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          ບໍ່ມີການແຈ້ງເຕືອນ
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id}
              onClick={() => !n.isRead && readMut.mutate(n.id)}
              className={`p-4 rounded-xl border transition-colors cursor-pointer
                ${n.isRead ? 'bg-white border-gray-200' : 'bg-primary-50 border-primary-200 hover:bg-primary-100'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.isRead ? 'bg-gray-300' : 'bg-primary-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('lo-LA')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
