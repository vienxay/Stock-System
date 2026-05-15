import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database, Download, FileJson, FileCode2, Sheet,
  Clock, Trash2, HardDrive, CheckCircle, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { backupApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';

interface BackupFile {
  filename: string; size: number; createdAt: string; type: string;
}
interface BackupSummary {
  totalFiles: number;
  latest: BackupFile | null;
  files: BackupFile[];
}

const fmtSize = (b: number) => b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1_000).toFixed(0)} KB`;

const TYPE_CFG = {
  json:  { icon: FileJson,   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   label: 'JSON',  desc: 'ໂຄງສ້າງ + ຂໍ້ມູນ',        ext: '.json', tips: ['ໃຊ້ for developer', 'ທຸກ table ໃນ file ດຽວ'] },
  sql:   { icon: FileCode2,  color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'SQL',   desc: 'INSERT statements',         ext: '.sql',  tips: ['Restore ດ້ວຍ psql', 'Industry standard'] },
  excel: { icon: Sheet,      color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'Excel', desc: 'Sheet ຕໍ່ table',           ext: '.xlsx', tips: ['ເປີດໄດ້ Microsoft Excel', 'ເຫມາະ non-technical user'] },
};

export default function BackupPage() {
  const qc = useQueryClient();
  const [dlLoading, setDlLoading] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backup-summary'],
    queryFn:  () => backupApi.summary(),
    staleTime: 30_000,
  });
  const bSum = (data?.data as { data: BackupSummary } | undefined)?.data;

  const saveNowMut = useMutation({
    mutationFn: () => backupApi.saveNow(),
    onSuccess: () => {
      toast.success('Backup ທັງ 3 ຮູບແບບ ບັນທຶກລົງ server ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['backup-summary'] });
    },
    onError: () => toast.error('Backup ລົ້ມເຫລວ'),
  });

  const deleteMut = useMutation({
    mutationFn: (f: string) => backupApi.deleteFile(f),
    onSuccess: () => {
      toast.success('ລຶບໄຟລ໌ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['backup-summary'] });
    },
  });

  const dl = async (key: string, fn: () => Promise<void>) => {
    setDlLoading(key);
    try { await fn(); toast.success('ດາວໂຫລດສຳເລັດ'); }
    catch { toast.error('ດາວໂຫລດລົ້ມເຫລວ'); }
    finally { setDlLoading(null); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />Backup ຂໍ້ມູນ
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Export ຂໍ້ມູນທຸກຕາຕະລາງ — 3 ຮູບແບບ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />Refresh
          </Button>
          <Button loading={saveNowMut.isPending} onClick={() => saveNowMut.mutate()}>
            <Database className="w-4 h-4" />Backup ດຽວນີ້ (ທັງ 3)
          </Button>
        </div>
      </div>

      {/* Stats */}
      {bSum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card py-3 flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xl font-bold text-gray-900">{bSum.totalFiles}</p>
              <p className="text-xs text-gray-400">ໄຟລ໌ໃນ server</p>
            </div>
          </div>
          {bSum.latest && (
            <div className="card py-3 sm:col-span-2 flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">Backup ຫຼ້າສຸດ</p>
                <p className="text-xs text-gray-500 truncate">
                  {new Date(bSum.latest.createdAt).toLocaleString('lo-LA')} · {fmtSize(bSum.latest.size)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3 Download Types */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.entries(TYPE_CFG) as [string, typeof TYPE_CFG.json][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const dlFn = key === 'json' ? backupApi.downloadJson : key === 'sql' ? backupApi.downloadSql : backupApi.downloadExcel;
          return (
            <div key={key} className={`card border-2 ${cfg.border} space-y-3`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`w-6 h-6 ${cfg.color}`} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{cfg.label}</p>
                  <p className="text-xs text-gray-400">{cfg.desc}</p>
                </div>
              </div>
              <ul className="text-xs text-gray-500 space-y-1">
                {cfg.tips.map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" loading={dlLoading === key}
                onClick={() => dl(key, dlFn)} className="w-full">
                <Download className="w-4 h-4" />ດາວໂຫລດ {cfg.ext}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Auto backup info */}
      <div className="card bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800">Auto Backup — ທຸກ ວັນ 01:00 AM</p>
            <p className="text-sm text-gray-600 mt-1">
              ລະບົບ backup ອັດຕະໂນມັດທຸກວັນ ໂດຍສ້າງທັງ 3 format (JSON + SQL + Excel) ແລ້ວເກັບໄວ້ server.
              ໄຟລ໌ທີ່ເກີນ <strong>30 ວັນ</strong> ຈະຖືກລຶບ auto.
            </p>
          </div>
        </div>
      </div>

      {/* Saved files list */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="font-semibold text-gray-700">ໄຟລ໌ Backup ທີ່ເກັບໃນ Server</p>
          <span className="text-xs text-gray-400">{bSum?.totalFiles ?? 0} ໄຟລ໌</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">ກຳລັງໂຫຼດ...</div>
        ) : !bSum?.files.length ? (
          <div className="p-10 text-center">
            <Database className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">ຍັງບໍ່ມີ backup file ໃນ server</p>
            <p className="text-gray-400 text-xs mt-1">ກົດ "Backup ດຽວນີ້" ເພື່ອສ້າງ</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bSum.files.map((file) => {
              const cfg  = TYPE_CFG[file.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.json;
              const Icon = cfg.icon;
              return (
                <div key={file.filename} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-gray-700 truncate">{file.filename}</p>
                      <p className="text-xs text-gray-400">
                        {fmtSize(file.size)} · {new Date(file.createdAt).toLocaleString('lo-LA')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => dl(file.filename, () => backupApi.downloadFile(file.filename))}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="ດາວໂຫລດ"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(file.filename)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="ລຶບ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-amber-600 pb-4 flex items-start gap-1.5">
        <span className="shrink-0">⚠</span>
        ເກັບ backup ໄວ້ໃນທີ່ປອດໄພຕ່າງຫາກ (ບໍ່ໃຊ່ server ດຽວກັນ) — ມີຂໍ້ມູນລູກຄ້າ ແລະ ຂໍ້ມູນທາງການເງິນ
      </p>

    </div>
  );
}
