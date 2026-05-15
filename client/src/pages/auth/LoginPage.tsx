import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import type { LoginResponse } from '@/types';

interface Form { username: string; password: string; }

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>();
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.username, data.password);
      const d = (res.data as { data: LoginResponse }).data;
      setAuth(d.user, d.accessToken, d.refreshToken);
      toast.success(`ຍິນດີຕ້ອນຮັບ ${d.user.fullName} (${d.user.role.nameLo})`);
      const homeMap: Record<string, string> = {
        admin: '/', finance: '/', md: '/',
        user: '/purchase-requests', purchasing: '/purchase-requests',
        stock: '/purchase-orders', ap: '/invoices',
      };
      navigate(homeMap[d.user.role.code] ?? '/');
    } catch {
      toast.error('Username ຫຼື Password ບໍ່ຖືກຕ້ອງ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ເຂົ້າສູ່ລະບົບ</h1>
          <p className="text-gray-500 text-sm mt-1">ລະບົບສາງ PR-PO</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('username', { required: 'ກະລຸນາປ້ອນ username' })}
                className="input pl-9" placeholder="username" autoComplete="username" />
            </div>
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('password', { required: 'ກະລຸນາປ້ອນ password' })}
                type="password" className="input pl-9" placeholder="••••••••" autoComplete="current-password" />
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <Button type="submit" loading={loading} className="w-full justify-center py-2.5 mt-2">
            ເຂົ້າສູ່ລະບົບ
          </Button>
        </form>
      </div>
    </div>
  );
}
