import { Menu, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { notifApi } from '@/api/endpoints';

interface Props { onMenuClick: () => void; title: string; }

export function Header({ onMenuClick, title }: Props) {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn:  () => notifApi.list({ limit: '1' }),
    refetchInterval: 30000,
  });

  const unread = (data?.data as { pagination?: { total: number } } | undefined)?.pagination?.total ?? 0;

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
      <button onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:hidden">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      <h1 className="font-semibold text-gray-900 flex-1 text-base truncate">{title}</h1>

      <button onClick={() => navigate('/notifications')}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </header>
  );
}
