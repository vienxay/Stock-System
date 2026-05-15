import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supplierApi } from '@/api/endpoints';
import type { Supplier } from '@/types';

interface FormFields {
  code:        string;
  name:        string;
  taxId:       string;
  contactName: string;
  phone:       string;
  email:       string;
  address:     string;
  bankName:    string;
  bankAccount: string;
  paymentTerm: string;
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  supplier?: Supplier | null;
}

export function SupplierFormModal({ open, onClose, supplier }: Props) {
  const qc     = useQueryClient();
  const isEdit = !!supplier;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormFields>();

  useEffect(() => {
    if (!open) return;
    reset(supplier ? {
      code:        supplier.code,
      name:        supplier.name,
      taxId:       supplier.taxId       ?? '',
      contactName: supplier.contactName ?? '',
      phone:       supplier.phone       ?? '',
      email:       supplier.email       ?? '',
      address:     supplier.address     ?? '',
      bankName:    supplier.bankName    ?? '',
      bankAccount: supplier.bankAccount ?? '',
      paymentTerm: String(supplier.paymentTerm ?? 30),
    } : {
      code: '', name: '', taxId: '', contactName: '', phone: '',
      email: '', address: '', bankName: '', bankAccount: '', paymentTerm: '30',
    });
  }, [open, supplier, reset]);

  const mut = useMutation({
    mutationFn: (fields: FormFields) => {
      const payload = {
        code:        fields.code.trim(),
        name:        fields.name.trim(),
        taxId:       fields.taxId.trim()       || undefined,
        contactName: fields.contactName.trim() || undefined,
        phone:       fields.phone.trim()       || undefined,
        email:       fields.email.trim()       || undefined,
        address:     fields.address.trim()     || undefined,
        bankName:    fields.bankName.trim()    || undefined,
        bankAccount: fields.bankAccount.trim() || undefined,
        paymentTerm: Number(fields.paymentTerm) || 30,
      };
      return isEdit
        ? supplierApi.update(supplier!.id, payload)
        : supplierApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'ແກ້ໄຂ Supplier ສຳເລັດ' : 'ເພີ່ມ Supplier ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['suppliers'] });
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'ແກ້ໄຂ Supplier' : 'ເພີ່ມ Supplier ໃໝ່'} size="lg">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">

        {/* Code + Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">ລະຫັດ <span className="text-red-500">*</span></label>
            <input {...register('code', { required: 'ກະລຸນາໃສ່ລະຫັດ' })}
              className="input" placeholder="SUP-001" disabled={isEdit} />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="label">ເລກທີ່ພາສີ (Tax ID)</label>
            <input {...register('taxId')} className="input" placeholder="LAO-XXX-XXXX" />
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="label">ຊື່ Supplier <span className="text-red-500">*</span></label>
          <input {...register('name', { required: 'ກະລຸນາໃສ່ຊື່' })}
            className="input" placeholder="ຊື່ບໍລິສັດ / ຮ້ານ..." />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Contact + Phone + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">ຜູ້ຕິດຕໍ່</label>
            <input {...register('contactName')} className="input" placeholder="ຊື່ຜູ້ຕິດຕໍ່..." />
          </div>
          <div>
            <label className="label">ເບີໂທ</label>
            <input {...register('phone')} className="input" placeholder="021 XXX XXX" />
          </div>
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" placeholder="email@example.com" />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="label">ທີ່ຢູ່</label>
          <textarea {...register('address')} className="input h-16 resize-none" placeholder="ທີ່ຢູ່..." />
        </div>

        {/* Bank + Payment term */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">ຊື່ທະນາຄານ</label>
            <input {...register('bankName')} className="input" placeholder="BCEL, LDB..." />
          </div>
          <div>
            <label className="label">ເລກບັນຊີ</label>
            <input {...register('bankAccount')} className="input" placeholder="XXX-XXX-XXX" />
          </div>
          <div>
            <label className="label">ເງື່ອນໄຂຊຳລະ (ວັນ)</label>
            <input {...register('paymentTerm')} type="number" min="0" className="input" placeholder="30" />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>ຍົກເລີກ</Button>
          <Button type="submit" loading={mut.isPending}>
            {isEdit ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມ Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
