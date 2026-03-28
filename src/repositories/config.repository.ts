/**
 * Config Repository
 *
 * All SQL for APP_CONFIG table (key-value app settings).
 *
 * Required SQL (run once):
 *
 * CREATE TABLE IF NOT EXISTS "APP_CONFIG" (
 *   "key"          VARCHAR(100) PRIMARY KEY,
 *   "value"        TEXT         NOT NULL,
 *   "color"        VARCHAR(20)  NOT NULL DEFAULT '#ffffff',
 *   "updatedBy"    TEXT,
 *   "_updatedDate" TIMESTAMP    NOT NULL DEFAULT NOW()
 * );
 *
 * INSERT INTO "APP_CONFIG" ("key", "value", "color", "updatedBy", "_updatedDate")
 * VALUES (
 *   'ticker_message',
 *   '🎉  Este es tu nuevo panel de usuario!  •  Recuerda que para avanzar de step debes participar cada semana en dos sesiones y en tu Training Session  •  Además, cuentas con dos Clubs opcionales para reforzar tu aprendizaje  🌟',
 *   '#ffffff',
 *   'system',
 *   NOW()
 * ) ON CONFLICT ("key") DO NOTHING;
 */

import 'server-only';
import { queryOne } from '@/lib/postgres';

interface AppConfigRow {
  key: string;
  value: string;
  color: string;
  updatedBy: string | null;
  _updatedDate: Date;
}

class AppConfigRepositoryClass {
  async get(key: string): Promise<AppConfigRow | null> {
    return queryOne<AppConfigRow>(
      `SELECT "key", "value", "color", "updatedBy", "_updatedDate"
       FROM "APP_CONFIG"
       WHERE "key" = $1`,
      [key]
    );
  }

  async set(key: string, value: string, color: string, updatedBy: string): Promise<AppConfigRow | null> {
    return queryOne<AppConfigRow>(
      `INSERT INTO "APP_CONFIG" ("key", "value", "color", "updatedBy", "_updatedDate")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("key") DO UPDATE SET
         "value"        = EXCLUDED."value",
         "color"        = EXCLUDED."color",
         "updatedBy"    = EXCLUDED."updatedBy",
         "_updatedDate" = NOW()
       RETURNING *`,
      [key, value, color, updatedBy]
    );
  }
}

export const AppConfigRepository = new AppConfigRepositoryClass();
