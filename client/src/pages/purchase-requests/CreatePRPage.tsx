import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { prApi, productApi, supplierApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import type { Product, Supplier } from '@/types';

interface ItemField {
  product_id:  string;
  quantity:    string;
  unit_price:  string;
  supplier_id: string;
  note:        string;
}

interface FormFields {
  department:    string;
  purpose:       string;
  priority:      'low' | 'normal' | 'high' | 'urgent';
  required_date: string;
  note:          string;
  items:         ItemField[];
}

export default function CreatePRPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormFields>({
    defaultValues: {
      priority: 'normal',
      items: [{ product_id: '', quantity: '1', unit_price: '', supplier_id: '', note: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: prodData } = useQuery({
    queryKey: ['products-all'],
    queryFn:  () => productApi.list({ limit: 500 }),
  });
  const { data: supData } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  () => supplierApi.list(),
  });

  const products:  Product[]  = (prodData?.data as { data: Product[] }  | undefined)?.data ?? [];
  const suppliers: Supplier[] = (supData?.data  as { data: Supplier[] } | undefined)?.data ?? [];

  // ຄຳນວນ total ສຳລັບ preview
  const watchItems = watch('items');
  const total = watchItems.reduce((sum, item) => {
    const prod = products.find((p) => String(p.id) === item.product_id);
    const price = Number(item.unit_price) || Number(prod?.standardPrice) || 0;
    return sum + (Number(item.quantity) || 0) * price;
  }, 0);

  const mut = useMutation({
    mutationFn: (data: FormFields) => {
      const validItems = data.items.filter((i) => i.product_id && Number(i.quantity) > 0);
      if (validItems.length === 0) throw new Error('ຕ້ອງມີສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ');
      return prApi.create({
        department:    data.department.trim() || undefined,
        purpose:       data.purpose.trim()    || undefined,
        priority:      data.priority,
        required_date: data.required_date     || undefined,
        note:          data.note.trim()       || undefined,
        items: validItems.map((i) => ({
          product_id:  Number(i.product_id),
          quantity:    Number(i.quantity),
          unit_price:  i.unit_price ? Number(i.unit_price) : undefined,
          supplier_id: i.supplier_id ? Number(i.supplier_id) : undefined,
          note:        i.note.trim() || undefined,
        })),
      });
    },
    onSuccess: (res) => {
      const pr = (res.data as { data: { id: number; prNumber: string } }).data;
      toast.success(`ສ້າງ ${pr.prNumber} ສຳເລັດ`);
      qc.invalidateQueries({ queryKey: ['pr'] });
      navigate('/purchase-requests');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error
        ? e.message
        : (e as { response?: { data?: { message?: string; errors?: { msg: string }[] } } })
            ?.response?.data?.errors?.[0]?.msg
          ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'ເກີດຂໍ້ຜິດພາດ';
      toast.error(msg);
    },
  });

  const priorityOpts = [
    { value: 'low',    label: 'ນ້ອຍ' },
    { value: 'normal', label: 'ປົກກະຕິ' },
    { value: 'high',   label: 'ສູງ' },
    { value: 'urgent', label: 'ດ່ວນ' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/purchase-requests')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">ສ້າງໃບຂໍຊື້ (PR) ໃໝ່</h2>
          <p className="text-sm text-gray-500">ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບຖ້ວນ</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-5">

        {/* ─── General Info ─── */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">ຂໍ້ມູນທົ່ວໄປ</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">ພະແນກ</label>
              <input {...register('department')} className="input" placeholder="ພະແນກ IT, ການຕະຫຼາດ..." />
            </div>
            <div>
              <label className="label">ຄວາມຮີບດ່ວນ</label>
              <select {...register('priority')} className="input">
                {priorityOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">ຈຸດປະສົງ / ເຫດຜົນການຂໍຊື້</label>
            <textarea {...register('purpose')} className="input h-20 resize-none"
              placeholder="ຈຸດປະສົງການຂໍຊື້ສິນຄ້ານີ້..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">ວັນທີຕ້ອງການ</label>
              <input {...register('required_date')} type="date" className="input" />
            </div>
            <div>
              <label className="label">ໝາຍເຫດ</label>
              <input {...register('note')} className="input" placeholder="ໝາຍເຫດເພີ່ມເຕີມ..." />
            </div>
          </div>
        </div>

        {/* ─── Items ─── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-semibold text-gray-900">ລາຍການສິນຄ້າ</h3>
            <Button type="button" variant="secondary"
              onClick={() => append({ product_id: '', quantity: '1', unit_price: '', supplier_id: '', note: '' })}>
              <Plus className="w-4 h-4" />ເພີ່ມລາຍການ
            </Button>
          </div>

          {errors.items && (
            <p className="text-red-500 text-xs">ກະລຸນາໃສ່ສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ</p>
          )}

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const selectedProd = products.find((p) => String(p.id) === watchItems[idx]?.product_id);
              const unitPrice    = watchItems[idx]?.unit_price
                ? Number(watchItems[idx].unit_price)
                : Number(selectedProd?.standardPrice ?? 0);
              const lineTotal    = (Number(watchItems[idx]?.quantity) || 0) * unitPrice;

              return (
                <div key={field.id}
                  className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      ລາຍການທີ {idx + 1}
                    </span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Product select */}
                  <div>
                    <label className="label">ສິນຄ້າ <span className="text-red-500">*</span></label>
                    <select
                      {...register(`items.${idx}.product_id`, {
                        required: 'ກະລຸນາເລືອກສິນຄ້າ',
                        validate: (v) => v !== '' || 'ກະລຸນາເລືອກສິນຄ້າ',
                      })}
                      className="input"
                    >
                      <option value="">-- ເລືອກສິນຄ້າ --</option>
                      {products.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          [{p.code}] {p.nameLo} (Stock: {p.currentStock})
                        </option>
                      ))}
                    </select>
                    {errors.items?.[idx]?.product_id && (
                      <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.product_id?.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Quantity */}
                    <div>
                      <label className="label">ຈຳນວນ <span className="text-red-500">*</span></label>
                      <input
                        {...register(`items.${idx}.quantity`, {
                          required: true,
                          min: { value: 1, message: 'ຕ້ອງ >= 1' },
                        })}
                        type="number" min="1" className="input" placeholder="1"
                      />
                    </div>

                    {/* Unit Price */}
                    <div>
                      <label className="label">
                        ລາຄາ/ໜ່ວຍ
                        {selectedProd && (
                          <span className="text-gray-400 font-normal ml-1 text-xs">
                            (default: {Number(selectedProd.standardPrice).toLocaleString()})
                          </span>
                        )}
                      </label>
                      <input
                        {...register(`items.${idx}.unit_price`)}
                        type="number" min="0" className="input"
                        placeholder={String(Number(selectedProd?.standardPrice ?? 0))}
                      />
                    </div>

                    {/* Supplier */}
                    <div>
                      <label className="label">Supplier</label>
                      <select {...register(`items.${idx}.supplier_id`)} className="input">
                        <option value="">-- ເລືອກ --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Line total */}
                    <div>
                      <label className="label">ລວມ (₭)</label>
                      <div className="input bg-gray-100 text-gray-700 font-semibold cursor-not-allowed">
                        {lineTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="label">ໝາຍເຫດລາຍການ</label>
                    <input {...register(`items.${idx}.note`)} className="input" placeholder="ໝາຍເຫດ..." />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Summary + Submit ─── */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ລວມທັງໝົດ ({fields.length} ລາຍການ)</p>
              <p className="text-2xl font-bold text-primary-700">{total.toLocaleString()} ₭</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => navigate('/purchase-requests')}>
                ຍົກເລີກ
              </Button>
              <Button type="submit" loading={mut.isPending}>
                <Save className="w-4 h-4" />ສ້າງ PR (Draft)
              </Button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
