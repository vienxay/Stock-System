import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Phone, Mail, MapPin, FileText, ImagePlus, X, Save, Loader2, Download, Database, CheckCircle, FileJson, FileCode2, Sheet, Clock, Trash2, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { settingsApi, uploadApi, backupApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';

interface Settings {
  id:            number;
  companyName:   string;
  companyNameEn: string | null;
  logoUrl:       string | null;
  phone:         string | null;
  email:         string | null;
  address:       string | null;
  taxId:         string | null;
}

interface FormState {
  companyName:   string;
  companyNameEn: string;
  phone:         string;
  email:         string;
  address:       string;
  taxId:         string;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [backupLoading, setBackupLoading] = useState<string | null>(null);

  const { data: backupSummary, refetch: refetchBackup } = useQuery({
    queryKey: ['backup-summary'],
    queryFn:  () => backupApi.summary(),
    staleTime: 30_000,
  });
  const bSum = (backupSummary?.data as { data: { totalFiles: number; latest: { filename: string; size: number; createdAt: string; type: string } | null; files: { filename: string; size: number; createdAt: string; type: string }[] } } | undefined)?.data;

  const saveNowMut = useMutation({
    mutationFn: () => backupApi.saveNow(),
    onSuccess:  () => { toast.success('Backup ທັງ 3 ຮູບແບບ ບັນທຶກລົງ server ສຳເລັດ'); refetchBackup(); },
    onError:    () => toast.error('Backup ລົ້ມເຫລວ'),
  });

  const deleteMut = useMutation({
    mutationFn: (f: string) => backupApi.deleteFile(f),
    onSuccess:  () => { toast.success('ລຶບໄຟລ໌ສຳເລັດ'); refetchBackup(); },
  });

  const dl = async (type: string, fn: () => Promise<void>) => {
    setBackupLoading(type);
    try { await fn(); toast.success(`ດາວໂຫລດ ${type.toUpperCase()} ສຳເລັດ`); }
    catch { toast.error('ດາວໂຫລດລົ້ມເຫລວ'); }
    finally { setBackupLoading(null); }
  };

  const fmtSize = (b: number) => b > 1_000_000 ? `${(b/1_000_000).toFixed(1)} MB` : `${(b/1_000).toFixed(0)} KB`;
  const typeIcon = (t: string) => t === 'sql' ? FileCode2 : t === 'excel' ? Sheet : FileJson;
  const typeColor = (t: string) => t === 'sql' ? 'text-orange-600 bg-orange-50' : t === 'excel' ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50';

  const [form,         setForm]         = useState<FormState>({
    companyName: '', companyNameEn: '', phone: '', email: '', address: '', taxId: '',
  });
  const [logoUrl,      setLogoUrl]      = useState('');
  const [logoPreview,  setLogoPreview]  = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
  });

  const settings: Settings | undefined = (data?.data as { data: Settings } | undefined)?.data;

  // ─── Populate form when data loads ────────────────────────
  useEffect(() => {
    if (!settings) return;
    setForm({
      companyName:   settings.companyName   ?? '',
      companyNameEn: settings.companyNameEn ?? '',
      phone:         settings.phone         ?? '',
      email:         settings.email         ?? '',
      address:       settings.address       ?? '',
      taxId:         settings.taxId         ?? '',
    });
    setLogoUrl(settings.logoUrl ?? '');
    setLogoPreview(settings.logoUrl ?? '');
  }, [settings]);

  const f = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // ─── Logo upload ──────────────────────────────────────────
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    try {
      const url = await uploadApi.productImage(file);
      setLogoUrl(url);
      toast.success('Upload Logo ສຳເລັດ');
    } catch (err) {
      toast.error((err as Error).message ?? 'Upload ລົ້ມເຫລວ');
      setLogoPreview(logoUrl);
    } finally {
      setLogoUploading(false);
    }
  };

  const clearLogo = () => {
    setLogoUrl(''); setLogoPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Save mutation ────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => settingsApi.update({
      companyName:   form.companyName,
      companyNameEn: form.companyNameEn  || undefined,
      logoUrl:       logoUrl             || undefined,
      phone:         form.phone          || undefined,
      email:         form.email          || undefined,
      address:       form.address        || undefined,
      taxId:         form.taxId          || undefined,
    }),
    onSuccess: () => {
      toast.success('ບັນທຶກການຕັ້ງຄ່າສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ຕັ້ງຄ່າລະບົບ</h2>
          <p className="text-sm text-gray-500 mt-0.5">ຂໍ້ມູນບໍລິສັດ ແລະ ການຕັ້ງຄ່າທົ່ວໄປ</p>
        </div>
        <Button
          loading={saveMut.isPending}
          disabled={logoUploading || !form.companyName}
          onClick={() => saveMut.mutate()}
        >
          <Save className="w-4 h-4" />ບັນທຶກການຕັ້ງຄ່າ
        </Button>
      </div>

      {/* ─── Logo Section ─── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-primary-600" />
          ໂລໂກ້ / ຮູບບໍລິສັດ
        </h3>
        <div className="flex items-start gap-6">
          {/* Preview box */}
          <div
            onClick={() => !logoUploading && fileRef.current?.click()}
            className={`relative w-36 h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden shrink-0
              ${logoPreview ? 'border-transparent' : 'border-gray-300 hover:border-primary-400 bg-gray-50'}`}
          >
            {logoPreview ? (
              <>
                <img src={logoPreview} alt="logo" className="w-full h-full object-contain p-2" />
                {logoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  </div>
                )}
                {!logoUploading && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearLogo(); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </>
            ) : (
              <div className="text-center p-3">
                <ImagePlus className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Upload Logo</p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />

          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium mb-1">ຮູບແບບທີ່ຮອງຮັບ</p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• JPG, PNG, WEBP, SVG</li>
              <li>• ຂະໜາດສູງສຸດ 5MB</li>
              <li>• ແນະນຳ: ພື້ນຫຼັງໂປ່ງໃສ (PNG/SVG)</li>
              <li>• ຂະໜາດທີ່ດີ: 200×200 px ຂຶ້ນໄປ</li>
            </ul>
            {logoUrl && (
              <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Upload ສຳເລັດ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Company Info ─── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary-600" />
          ຂໍ້ມູນບໍລິສັດ
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">ຊື່ບໍລິສັດ (ລາວ) <span className="text-red-500">*</span></label>
            <input
              className="input"
              placeholder="ຊື່ບໍລິສັດ..."
              value={form.companyName}
              onChange={(e) => f('companyName', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">ຊື່ບໍລິສັດ (ອັງກິດ)</label>
            <input
              className="input"
              placeholder="Company name in English..."
              value={form.companyNameEn}
              onChange={(e) => f('companyNameEn', e.target.value)}
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />ເລກທະບຽນພາສີ
            </label>
            <input
              className="input font-mono"
              placeholder="0000000000"
              value={form.taxId}
              onChange={(e) => f('taxId', e.target.value)}
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />ເບີໂທ
            </label>
            <input
              className="input"
              placeholder="020 XXXX XXXX"
              value={form.phone}
              onChange={(e) => f('phone', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="info@company.com"
              value={form.email}
              onChange={(e) => f('email', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />ທີ່ຢູ່
            </label>
            <textarea
              className="input h-20 resize-none"
              placeholder="ທີ່ຢູ່ຂອງບໍລິສັດ..."
              value={form.address}
              onChange={(e) => f('address', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── Preview Card ─── */}
      <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm">Preview ໂລໂກ້ + ຊື່</h3>
        <div className="flex items-center gap-4">
          {logoPreview
            ? <img src={logoPreview} alt="logo" className="w-14 h-14 rounded-xl object-contain bg-white border border-gray-200 p-1" />
            : <div className="w-14 h-14 rounded-xl bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gray-300" />
              </div>
          }
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">
              {form.companyName || 'ຊື່ບໍລິສັດ'}
            </p>
            {form.companyNameEn && (
              <p className="text-sm text-gray-500">{form.companyNameEn}</p>
            )}
            {form.phone && <p className="text-xs text-gray-400 mt-1">📞 {form.phone}</p>}
          </div>
        </div>
      </div>

      {/* ─── Save button ─── */}
      <div className="flex justify-end pb-2">
        <Button
          loading={saveMut.isPending}
          disabled={logoUploading || !form.companyName}
          onClick={() => saveMut.mutate()}
        >
          <Save className="w-4 h-4" />ບັນທຶກການຕັ້ງຄ່າ
        </Button>
      </div>

      {/* ─── Backup Section ─── */}
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
            <Database className="w-5 h-5 text-blue-600" />Backup ຂໍ້ມູນ
          </h3>
          {bSum && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              {bSum.totalFiles} ໄຟລ໌ໃນ server
            </span>
          )}
        </div>

        {/* ─ 3 Download Types ─ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* JSON */}
          <div className="card border border-blue-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">JSON</p>
                <p className="text-xs text-gray-400">ໂຄງສ້າງ + ຂໍ້ມູນ</p>
              </div>
            </div>
            <ul className="text-xs text-gray-500 space-y-0.5">
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />ໃຊ້ for developer</li>
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />ທຸກ table ໃນ file ດຽວ</li>
            </ul>
            <Button variant="secondary" loading={backupLoading === 'json'}
              onClick={() => dl('json', backupApi.downloadJson)} className="w-full">
              <Download className="w-4 h-4" />.json
            </Button>
          </div>

          {/* SQL */}
          <div className="card border border-orange-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <FileCode2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">SQL</p>
                <p className="text-xs text-gray-400">INSERT statements</p>
              </div>
            </div>
            <ul className="text-xs text-gray-500 space-y-0.5">
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />Restore ດ້ວຍ psql</li>
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />Industry standard</li>
            </ul>
            <Button variant="secondary" loading={backupLoading === 'sql'}
              onClick={() => dl('sql', backupApi.downloadSql)} className="w-full">
              <Download className="w-4 h-4" />.sql
            </Button>
          </div>

          {/* Excel */}
          <div className="card border border-green-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Sheet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Excel</p>
                <p className="text-xs text-gray-400">Sheet ຕໍ່ table</p>
              </div>
            </div>
            <ul className="text-xs text-gray-500 space-y-0.5">
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />ເປີດໄດ້ Microsoft Excel</li>
              <li className="flex gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />ເຫມາະ non-technical user</li>
            </ul>
            <Button variant="secondary" loading={backupLoading === 'excel'}
              onClick={() => dl('excel', backupApi.downloadExcel)} className="w-full">
              <Download className="w-4 h-4" />.xlsx
            </Button>
          </div>
        </div>

        {/* ─ Auto Backup info + Save Now ─ */}
        <div className="card bg-slate-50 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Auto Backup</p>
                <p className="text-xs text-gray-500">ທຸກ ວັນ 01:00 AM ອັດຕະໂນມັດ (JSON + SQL + Excel) ເກັບ 30 ວັນ</p>
                {bSum?.latest && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Backup ຫຼ້າສຸດ: {new Date(bSum.latest.createdAt).toLocaleString('lo-LA')}
                  </p>
                )}
              </div>
            </div>
            <Button variant="secondary" loading={saveNowMut.isPending}
              onClick={() => saveNowMut.mutate()}>
              <Database className="w-4 h-4" />Backup ດຽວນີ້
            </Button>
          </div>
        </div>

        {/* ─ Saved Backups List ─ */}
        {bSum && bSum.files.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="font-semibold text-gray-700 text-sm">ໄຟລ໌ Backup ໃນ Server</p>
            </div>
            <div className="divide-y divide-gray-50">
              {bSum.files.map((f) => {
                const Icon = typeIcon(f.type);
                const cls  = typeColor(f.type);
                return (
                  <div key={f.filename} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-gray-700 truncate">{f.filename}</p>
                        <p className="text-xs text-gray-400">{fmtSize(f.size)} · {new Date(f.createdAt).toLocaleString('lo-LA')}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => dl(f.type, () => backupApi.downloadFile(f.filename))}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMut.mutate(f.filename)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-amber-600 flex items-start gap-1.5">
          <span className="shrink-0">⚠</span>
          ເກັບໄຟລ໌ backup ໄວ້ໃນທີ່ປອດໄພ — ມີຂໍ້ມູນລູກຄ້າ ແລະ ຂໍ້ມູນທາງການເງິນ
        </p>
      </div>

    </div>
  );
}
