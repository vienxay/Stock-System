import 'express-async-errors';
import express    from 'express';
import helmet     from 'helmet';
import cors       from 'cors';
import morgan     from 'morgan';
import rateLimit  from 'express-rate-limit';
import path       from 'path';
import { env }    from './config/env';
import { logger } from './config/logger';
import routes     from './routes';
import { errorHandler } from './middlewares/errorMiddleware';

const app = express();

app.use(helmet());
app.use(cors({
  origin:      env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
const isDev = env.NODE_ENV === 'development';

// ─── Global rate limit (ທຸກ route) ──────────────────────────
app.use(rateLimit({
  windowMs:        env.RATE_LIMIT_WINDOW_MS,
  max:             env.RATE_LIMIT_MAX,
  message:         { success: false, message: 'ຮ້ອງຂໍຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isDev,   // ໃນ dev ຂ້າມ global limit
}));

// ─── Auth login — ຈຳກັດເຄັ່ງ (production ເທົ່ານັ້ນ) ──────────
app.use('/api/v1/auth/login', rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             env.AUTH_RATE_LIMIT_MAX,
  message:         { success: false, message: 'ພະຍາຍາມ Login ຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີ' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isDev,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (m) => logger.http(m.trim()) } }));

app.get('/health', (_req, res) =>
  res.json({ success: true, message: 'PR-PO API running', env: env.NODE_ENV, ts: new Date().toISOString() })
);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/v1', routes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

export default app;
