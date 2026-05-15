import { Router, Request, Response }  from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { authenticate } from '../middlewares/authMiddleware';
import { ApiResponse }  from '../utils/ApiResponse';

const router = Router();
router.use(authenticate);

// ─── Storage config ───────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('ອະນຸຍາດສະເພາະໄຟລ໌ JPG, PNG, WEBP, GIF ເທົ່ານັ້ນ'));
  },
});

// ─── POST /api/v1/upload/product-image ────────────────────────
router.post('/product-image', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'ບໍ່ພົບໄຟລ໌ທີ່ upload' });
    return;
  }
  const url = `/uploads/products/${req.file.filename}`;
  ApiResponse.success(res, { url }, 'Upload ສຳເລັດ');
});

// ─── DELETE /api/v1/upload/product-image ──────────────────────
router.delete('/product-image', (req: Request, res: Response) => {
  const { filename } = req.body as { filename?: string };
  if (!filename) { res.status(400).json({ success: false, message: 'ຕ້ອງລະບຸ filename' }); return; }
  const filePath = path.join(uploadDir, path.basename(filename));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  ApiResponse.success(res, null, 'ລົບໄຟລ໌ສຳເລັດ');
});

export default router;
