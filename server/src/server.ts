import 'dotenv/config';
import app          from './app';
import { prisma }   from './config/prisma';
import { logger }   from './config/logger';
import { env }      from './config/env';
import cron         from 'node-cron';
import { createJsonBackup, createSqlBackup, createExcelBackup, cleanOldBackups } from './services/backupService';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected via Prisma');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running → http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });

    const graceful = async (signal: string) => {
      logger.info(`${signal} received — shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('✅ Graceful shutdown complete');
        process.exit(0);
      });
    };

    // ─── Auto Backup ທຸກ ວັນ 01:00 AM ──────────────────────────
    cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('⏰ Auto backup starting...');
        await Promise.all([
          createJsonBackup(true),
          createSqlBackup(true),
          createExcelBackup(true),
        ]);
        cleanOldBackups(30);
        logger.info('✅ Auto backup completed (JSON + SQL + Excel)');
      } catch (err) {
        logger.error('❌ Auto backup failed:', err);
      }
    }, { timezone: 'Asia/Vientiane' });

    logger.info('📅 Auto backup scheduled: daily 01:00 AM (Vientiane)');

    process.on('SIGTERM', () => graceful('SIGTERM'));
    process.on('SIGINT',  () => graceful('SIGINT'));
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection:', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
