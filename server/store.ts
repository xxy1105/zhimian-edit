import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createSeedDatabase } from './seed.ts';
import type { CollectionName, Database, Entity } from './types.ts';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const defaultFile = path.join(serverDir, 'data', 'db.json');

export class Store {
  private readonly file: string;
  private readonly pool?: Pool;
  private writeQueue = Promise.resolve();

  constructor(file = process.env.DB_FILE || defaultFile) {
    this.file = file;
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'false'
          ? false
          : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
      });
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须配置 DATABASE_URL，禁止使用本地 JSON 数据库');
    }
  }

  async read(): Promise<Database> {
    if (this.pool) {
      await this.ensureDatabaseTable();
      const result = await this.pool.query<{ data: Database }>('SELECT data FROM app_state WHERE id = 1');
      if (result.rows[0]?.data) return result.rows[0].data;
      return this.reset();
    }
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as Database;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return this.reset();
    }
  }

  async reset(): Promise<Database> {
    const database = createSeedDatabase();
    await this.write(database);
    return database;
  }

  async list(collection: CollectionName): Promise<Entity[]> {
    return (await this.read())[collection];
  }

  async get(collection: CollectionName, key: string): Promise<Entity | undefined> {
    return (await this.list(collection)).find((item) => item.key === key);
  }

  async create(collection: CollectionName, input: Omit<Entity, 'key'> & Partial<Pick<Entity, 'key'>>): Promise<Entity> {
    let created!: Entity;
    await this.update((database) => {
      const records = database[collection];
      created = {
        ...input,
        key: input.key || this.nextKey(records),
        updated: this.displayTime(),
      } as Entity;
      records.unshift(created);
    });
    return created;
  }

  async patch(collection: CollectionName, key: string, input: Partial<Entity>): Promise<Entity | undefined> {
    let updated: Entity | undefined;
    await this.update((database) => {
      const index = database[collection].findIndex((item) => item.key === key);
      if (index < 0) return;
      updated = {
        ...database[collection][index],
        ...input,
        key,
        updated: this.displayTime(),
      };
      database[collection][index] = updated;
    });
    return updated;
  }

  async remove(collection: CollectionName, key: string): Promise<boolean> {
    let removed = false;
    await this.update((database) => {
      const before = database[collection].length;
      database[collection] = database[collection].filter((item) => item.key !== key) as Database[typeof collection];
      removed = database[collection].length < before;
    });
    return removed;
  }

  async update(mutator: (database: Database) => void | Promise<void>): Promise<Database> {
    let result!: Database;
    this.writeQueue = this.writeQueue.then(async () => {
      const database = await this.read();
      await mutator(database);
      database.metadata.updatedAt = new Date().toISOString();
      await this.write(database);
      result = database;
    });
    await this.writeQueue;
    return result;
  }

  private async write(database: Database): Promise<void> {
    if (this.pool) {
      await this.ensureDatabaseTable();
      await this.pool.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(database)],
      );
      return;
    }
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
    await rename(temporaryFile, this.file);
  }

  private async ensureDatabaseTable() {
    await this.pool!.query(
      `CREATE TABLE IF NOT EXISTS app_state (
        id integer PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )`,
    );
  }

  private nextKey(records: Entity[]): string {
    return String(Math.max(0, ...records.map((item) => Number(item.key) || 0)) + 1);
  }

  private displayTime(): string {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    }).format(new Date()).replaceAll('/', '-');
  }
}
