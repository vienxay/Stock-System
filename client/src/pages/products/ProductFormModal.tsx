import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Barcode from 'react-barcode';
import toast from 'react-hot-toast';
import { ImagePlus, X, Barcode as BarcodeIcon, Loader2, ScanLine } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { BarcodeScanner } from '@/components/ui/BarcodeScanner';
import { productApi, categoryApi, unitApi, uploadApi } from '@/api/endpoints';
import type { Product, Category, Unit } from '@/types';

interface FormFields {
  code:          string;
  nameLo:        string;
  nameEn:        string;
  categoryId:    string;
  unitId:        string;
  standardPrice: string;
  minStock:      string;
  maxStock:      string;
  location:      string;
  description:   string;
  barcode:       string;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  product?: Product | null;
}

export function ProductFormModal({ open, onClose, product }: Props) {
  const qc     = useQueryClient();
  const isEdit = !!product;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormFields>();
  const barcodeValue = watch('barcode');

  // ─── Image state ──────────────────────────────────────────
  const [imageUrl,      setImageUrl]     = useState<string>('');
  const [imageUploading, setUploading]  = useState(false);
  const [imagePreview,  setImagePreview] = useState<string>('');
  const [scanOpen,      setScanOpen]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const img = product?.imageUrl ?? '';
    setImageUrl(img);
    setImagePreview(img ? img : '');
    reset(product ? {
      code:          product.code,
      nameLo:        product.nameLo,
      nameEn:        product.nameEn ?? '',
      categoryId:    String(product.category?.id ?? ''),
      unitId:        String(product.unit?.id ?? ''),
      standardPrice: String(Number(product.standardPrice) || 0),
      minStock:      String(product.minStock),
      maxStock:      String(product.maxStock),
      location:      product.location ?? '',
      description:   product.description ?? '',
      barcode:       product.barcode ?? '',
    } : {
      code: '', nameLo: '', nameEn: '', categoryId: '', unitId: '',
      standardPrice: '0', minStock: '0', maxStock: '0',
      location: '', description: '', barcode: '',
    });
  }, [open, product, reset]);

  const { data: catData }  = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list() });
  const { data: unitData } = useQuery({ queryKey: ['units'],      queryFn: () => unitApi.list() });

  // ─── Auto-fill ເມື່ອ barcode ປ່ຽນ ────────────────────────────
  useEffect(() => {
    const val = barcodeValue?.trim();
    if (!val || val.length < 4 || !/^[\x20-\x7E]+$/.test(val)) return;

    // ຊອກໃນ DB ວ່າ barcode ນີ້ມີຢູ່ແລ້ວບໍ່
    const timer = setTimeout(async () => {
      try {
        const res = await productApi.list({ search: val, limit: 5 });
        const rows = (res?.data as { data: Product[] } | undefined)?.data ?? [];
        const found = rows.find(
          (p) => p.barcode === val || p.code === val
        );

        if (found && !isEdit) {
          // ສິນຄ້ານີ້ມີໃນ DB ແລ້ວ — fill ທຸກ field
          setValue('code',          found.code);
          setValue('nameLo',        found.nameLo);
          setValue('nameEn',        found.nameEn ?? '');
          setValue('categoryId',    String(found.category?.id ?? ''));
          setValue('unitId',        String(found.unit?.id ?? ''));
          setValue('standardPrice', String(Number(found.standardPrice)));
          setValue('minStock',      String(found.minStock));
          setValue('maxStock',      String(found.maxStock));
          setValue('location',      found.location ?? '');
          setValue('description',   found.description ?? '');
          setImageUrl(found.imageUrl ?? '');
          setImagePreview(found.imageUrl ?? '');
          toast('ສິນຄ້ານີ້ມີໃນລະບົບແລ້ວ — ຂໍ້ມູນ auto-fill ໃຫ້ແລ້ວ', { icon: 'ℹ️' });
        }
      } catch { /* ຖ້າ search fail ບໍ່ block */ }
    }, 400); // debounce 400ms

    return () => clearTimeout(timer);
  }, [barcodeValue, isEdit, setValue, setImageUrl, setImagePreview]);
  const categories: Category[] = (catData?.data  as { data: Category[] } | undefined)?.data ?? [];
  const units:      Unit[]     = (unitData?.data  as { data: Unit[] }     | undefined)?.data ?? [];

  // ─── Handle image file select ─────────────────────────────
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadApi.productImage(file);
      setImageUrl(url);
      toast.success('Upload ຮູບສຳເລັດ');
    } catch (err) {
      toast.error((err as Error).message ?? 'Upload ລົ້ມເຫລວ');
      setImagePreview(imageUrl);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setImageUrl(''); setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Submit ───────────────────────────────────────────────
  const mut = useMutation({
    mutationFn: (fields: FormFields) => {
      const payload = {
        code:          fields.code.trim(),
        nameLo:        fields.nameLo.trim(),
        nameEn:        fields.nameEn.trim() || undefined,
        categoryId:    Number(fields.categoryId),
        unitId:        Number(fields.unitId),
        standardPrice: Number(fields.standardPrice) || 0,
        minStock:      Number(fields.minStock) || 0,
        maxStock:      Number(fields.maxStock) || 0,
        location:      fields.location.trim() || undefined,
        description:   fields.description.trim() || undefined,
        barcode:       fields.barcode.trim() || undefined,
        imageUrl:      imageUrl || undefined,
      };
      return isEdit ? productApi.update(product!.id, payload) : productApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'ແກ້ໄຂສິນຄ້າສຳເລັດ' : 'ເພີ່ມສິນຄ້າສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string; errors?: { msg: string }[] } } }) => {
      toast.error(e?.response?.data?.errors?.[0]?.msg ?? e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'} size="xl">
      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ─── Left: Image + Barcode ─── */}
          <div className="space-y-4">

            {/* Image Upload */}
            <div>
              <label className="label">ຮູບສິນຄ້າ</label>
              <div
                onClick={() => !imageUploading && fileRef.current?.click()}
                className={`relative w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden
                  ${imagePreview ? 'border-transparent' : 'border-gray-300 hover:border-primary-400 bg-gray-50'}`}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    {imageUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                    {!imageUploading && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearImage(); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4">
                    <ImagePlus className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">ກົດເພື່ອ Upload ຮູບ</p>
                    <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP ≤ 5MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Barcode Preview */}
            <div>
              <label className="label flex items-center gap-1.5">
                <BarcodeIcon className="w-4 h-4" />Barcode
              </label>
              <div className="flex gap-2">
                <input
                  {...register('barcode')}
                  className="input font-mono text-sm flex-1"
                  placeholder="ໃສ່ ຫຼື scan barcode..."
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                />
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="px-3 rounded-lg border border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                  title="ສະແກນ Barcode"
                >
                  <ScanLine className="w-5 h-5" />
                </button>
              </div>
              {barcodeValue && barcodeValue.length >= 4 && /^[\x20-\x7E]+$/.test(barcodeValue) && (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl flex flex-col items-center">
                  <Barcode
                    value={barcodeValue}
                    width={1.5}
                    height={60}
                    fontSize={12}
                    margin={4}
                    displayValue
                  />
                </div>
              )}
            </div>
          </div>

          {/* ─── Right: Form Fields ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Code + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ລະຫັດ <span className="text-red-500">*</span></label>
                <input {...register('code', { required: 'ກະລຸນາໃສ່ລະຫັດ' })}
                  className="input font-mono" placeholder="P001" disabled={isEdit} />
                {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
              </div>
              <div>
                <label className="label">ຊື່ (ລາວ) <span className="text-red-500">*</span></label>
                <input {...register('nameLo', { required: 'ກະລຸນາໃສ່ຊື່ສິນຄ້າ' })}
                  className="input" placeholder="ຊື່ສິນຄ້າ..." />
                {errors.nameLo && <p className="text-red-500 text-xs mt-1">{errors.nameLo.message}</p>}
              </div>
            </div>

            {/* Name EN */}
            <div>
              <label className="label">ຊື່ (ອັງກິດ)</label>
              <input {...register('nameEn')} className="input" placeholder="Product name..." />
            </div>

            {/* Category + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ໝວດໝູ່ <span className="text-red-500">*</span></label>
                <select {...register('categoryId', { required: 'ກະລຸນາເລືອກໝວດໝູ່', validate: (v) => v !== '' || 'ກະລຸນາເລືອກໝວດໝູ່' })} className="input">
                  <option value="">-- ເລືອກໝວດໝູ່ --</option>
                  {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.nameLo}</option>)}
                </select>
                {errors.categoryId && <p className="text-red-500 text-xs mt-1">{errors.categoryId.message}</p>}
              </div>
              <div>
                <label className="label">ຫົວໜ່ວຍ <span className="text-red-500">*</span></label>
                <select {...register('unitId', { required: 'ກະລຸນາເລືອກຫົວໜ່ວຍ', validate: (v) => v !== '' || 'ກະລຸນາເລືອກຫົວໜ່ວຍ' })} className="input">
                  <option value="">-- ເລືອກຫົວໜ່ວຍ --</option>
                  {units.map((u) => <option key={u.id} value={String(u.id)}>{u.nameLo}</option>)}
                </select>
                {errors.unitId && <p className="text-red-500 text-xs mt-1">{errors.unitId.message}</p>}
              </div>
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">ລາຄາ (₭)</label>
                <input {...register('standardPrice')} type="number" min="0" className="input" placeholder="0" />
              </div>
              <div>
                <label className="label">Stock ໜ້ອຍສຸດ</label>
                <input {...register('minStock')} type="number" min="0" className="input" placeholder="0" />
              </div>
              <div>
                <label className="label">Stock ສູງສຸດ</label>
                <input {...register('maxStock')} type="number" min="0" className="input" placeholder="0" />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="label">ທີ່ຕັ້ງໃນສາງ</label>
              <input {...register('location')} className="input" placeholder="A1, B2..." />
            </div>

            {/* Description */}
            <div>
              <label className="label">ລາຍລະອຽດ</label>
              <textarea {...register('description')} className="input h-20 resize-none" placeholder="ລາຍລະອຽດ..." />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>ຍົກເລີກ</Button>
          <Button type="submit" loading={mut.isPending} disabled={imageUploading}>
            {isEdit ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມສິນຄ້າ'}
          </Button>
        </div>
      </form>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(value) => {
          setValue('barcode', value, { shouldDirty: true });
          toast.success(`ສະແກນສຳເລັດ: ${value}`);
        }}
      />
    </Modal>
  );
}
