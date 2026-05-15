import { Router, Response } from 'express';
import path    from 'path';
import fs      from 'fs';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { ApiResponse }  from '../utils/ApiResponse';
import {
  createJsonBackup, createSqlBackup, createExcelBackup,
  listBackups, cleanOldBackups, BACKUP_DIR,
} from '../services/backupService';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// ─── 1. Download JSON Backup ──────────────────────────────────
router.get('/json', async (_req, res: Response) => {
  const now      = new Date();
  const filename = `backup-json-${now.toISOString().slice(0,10)}.json`;
  const { json } = await createJsonBackup(false);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
});

// ─── 2. Download SQL Backup ───────────────────────────────────
router.get('/sql', async (_req, res: Response) => {
  const now      = new Date();
  const filename = `backup-sql-${now.toISOString().slice(0,10)}.sql`;
  const { sql }  = await createSqlBackup(false);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(sql);
});

// ─── 3. Download Excel Backup ─────────────────────────────────
router.get('/excel', async (_req, res: Response) => {
  const now      = new Date();
  const filename = `backup-excel-${now.toISOString().slice(0,10)}.xlsx`;
  const { wb }   = await createExcelBackup(false);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── Manual Save All 3 to server ─────────────────────────────
router.post('/save-now', async (_req, res: Response) => {
  const [j, s, e] = await Promise.all([
    createJsonBackup(true),
    createSqlBackup(true),
    createExcelBackup(true),
  ]);
  cleanOldBackups(30);
  ApiResponse.success(res, {
    saved: [
      { type: 'json',  file: path.basename(j.file!) },
      { type: 'sql',   file: path.basename(s.file!) },
      { type: 'excel', file: path.basename(e.file!) },
    ],
  }, 'Backup ບັນທຶກລົງ server ສຳເລັດ');
});

// ─── List saved backups ───────────────────────────────────────
router.get('/list', (_req, res: Response) => {
  ApiResponse.success(res, listBackups());
});

// ─── Download a saved backup file ────────────────────────────
router.get('/download/:filename', (req, res: Response) => {
  const file = path.join(BACKUP_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) { res.status(404).json({ success: false, message: 'ບໍ່ພົບໄຟລ໌' }); return; }
  res.download(file);
});

// ─── Delete a saved backup ────────────────────────────────────
router.delete('/file/:filename', (req, res: Response) => {
  const file = path.join(BACKUP_DIR, path.basename(req.params.filename));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  ApiResponse.success(res, null, 'ລຶບໄຟລ໌ສຳເລັດ');
});

// ─── Summary stats ────────────────────────────────────────────
router.get('/summary', async (_req, res: Response) => {
  const files  = listBackups();
  const latest = files[0] ?? null;
  ApiResponse.success(res, { totalFiles: files.length, latest, files: files.slice(0, 10) });
});

export default router;
