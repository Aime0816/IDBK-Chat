import 'dotenv/config';
import knex from 'knex';
import path from 'node:path';
import fs from 'node:fs';
import { up } from '../../../../database/migrations/001_initial.js';
export const sqlite = process.env.DB_CLIENT === 'sqlite';
if (sqlite)
  fs.mkdirSync(path.dirname(process.env.SQLITE_FILE || './data/idbk.sqlite'), { recursive: true });
export const db = knex(
  sqlite
    ? {
        client: 'better-sqlite3',
        connection: { filename: process.env.SQLITE_FILE || './data/idbk.sqlite' },
        useNullAsDefault: true,
        pool: {
          min: 1,
          max: 1,
          afterCreate(c: any, done: any) {
            c.pragma('foreign_keys = ON');
            c.pragma('journal_mode = WAL');
            done(null, c);
          },
        },
      }
    : {
        client: 'mysql2',
        connection: {
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER || 'idbk',
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME || 'idbk_chat',
          supportBigNumbers: true,
          bigNumberStrings: false,
        },
        pool: { min: 0, max: 10 },
      },
);
export async function migrate() {
  await db.migrate.latest({
    migrationSource: {
      getMigrations: async () => ['001_initial'],
      getMigrationName: (m: string) => m,
      getMigration: async () => ({
        up,
        down: async () => {
          throw new Error('No destructive rollback');
        },
      }),
    },
  });
}
