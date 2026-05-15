import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { userApi } from '@/api/endpoints';
import type { AppUser, RoleCode } from '@/types';

interface FormFields {
  username:   string;
  password:   string;
  fullName:   string;
  roleCode:   RoleCode;
  email:      string;
  phone:      string;
  department: string;
  employeeId: string;
  isActive:   string;
}

const roles: { code: RoleCode; label: string; desc: string }[] = [
  { code: 'admin',      label: 'Admin',             desc: 'ຄວບຄຸມລະບົບທຸກຢ່າງ' },
  { code: 'user',       label: 'User ທົ່ວໄປ',        desc: 'ສ້າງ PR ໄດ້' },
  { code: 'finance',    label: 'Finance',           desc: 'ອະນຸມັດ PR ຂັ້ນ 1' },
  { code: 'md',         label: 'MD',                desc: 'ອະນຸມັດ PR ຂັ້ນ 2' },
  { code: 'purchasing', label: 'Purchasing',        desc: 'ສ້າງ/ສົ່ງ PO, ຈັດການ Supplier' },
  { code: 'stock',      label: 'Stock',             desc: 'ຮັບສິນຄ້າ GR, ເບີກ Stock' },
  { code: 'ap',         label: 'AP (ບັນຊີຈ່າຍ)',    desc: 'ສ້າງ Invoice, ຈ່າຍເງິນ' },
];

interface Props { open: boolean; onClose: () => void; user?: AppUser | null; }

export function UserFormModal({ open, onClose, user }: Props) {
  const qc     = useQueryClient();
  const isEdit = !!user;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormFields>();

  useEffect(() => {
    if (!open) return;
    reset(user ? {
      username:   user.username,
      password:   '',
      fullName:   user.fullName,
      roleCode:   user.role.code,
      email:      user.email      ?? '',
      phone:      user.phone      ?? '',
      department: user.department ?? '',
      employeeId: user.employeeId ?? '',
      isActive:   String(user.isActive),
    } : {
      username: '', password: '', fullName: '',
      roleCode: 'user', email: '', phone: '',
      department: '', employeeId: '', isActive: 'true',
    });
  }, [open, user, reset]);

  const mut = useMutation({
    mutationFn: (f: FormFields) => {
      const payload = {
        username:   f.username.trim(),
        fullName:   f.fullName.trim(),
        roleCode:   f.roleCode,
        email:      f.email.trim()      || undefined,
        phone:      f.phone.trim()      || undefined,
        department: f.department.trim() || undefined,
        employeeId: f.employeeId.trim() || undefined,
        ...(isEdit ? { isActive: f.isActive === 'true' } : { password: f.password }),
      };
      return isEdit ? userApi.update(user!.id, payload) : userApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'ອັບເດດ User ສຳເລັດ' : 'ສ້າງ User ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string; errors?: { msg: string }[] } } }) => {
      const msg = e?.response?.data?.errors?.[0]?.msg
               ?? e?.response?.data?.message
               ?? 'ເກີດຂໍ້ຜິດພາດ';
      toast.error(msg);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `ແກ້ໄຂ User: ${user?.username}` : 'ສ້າງ User ໃໝ່'} size="lg">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">

        {/* Username + Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Username <span className="text-red-500">*</span></label>
            <input {...register('username', { required: 'ກະລຸນາໃສ່ username' })}
              className="input" placeholder="username" disabled={isEdit} />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>
          {!isEdit && (
            <div>
              <label className="label">Password <span className="text-red-500">*</span></label>
              <input {...register('password', { required: 'ກະລຸນາໃສ່ password', minLength: { value: 8, message: 'ຕ້ອງ 8 ຕົວຂຶ້ນໄປ' } })}
                type="password" className="input" placeholder="ຢ່າງໜ້ອຍ 8 ຕົວ" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
          )}
        </div>

        {/* Full name */}
        <div>
          <label className="label">ຊື່ເຕັມ <span className="text-red-500">*</span></label>
          <input {...register('fullName', { required: 'ກະລຸນາໃສ່ຊື່ເຕັມ' })}
            className="input" placeholder="ຊື່ ແລະ ນາມສະກຸນ" />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="label">ສິດທິ (Role) <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roles.map((r) => (
              <label key={r.code}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 transition-colors">
                <input type="radio" {...register('roleCode', { required: true })}
                  value={r.code} className="mt-0.5 accent-primary-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">ເບີໂທ</label>
            <input {...register('phone')} className="input" placeholder="020 XXXX XXXX" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">ພະແນກ</label>
            <input {...register('department')} className="input" placeholder="ພະແນກ..." />
          </div>
          <div>
            <label className="label">ລະຫັດພະນັກງານ</label>
            <input {...register('employeeId')} className="input" placeholder="EMP-001" />
          </div>
        </div>

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            <label className="label">ສະຖານະ</label>
            <select {...register('isActive')} className="input">
              <option value="true">ໃຊ້ງານ</option>
              <option value="false">ປິດໃຊ້ງານ</option>
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>ຍົກເລີກ</Button>
          <Button type="submit" loading={mut.isPending}>
            {isEdit ? 'ບັນທຶກ' : 'ສ້າງ User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
