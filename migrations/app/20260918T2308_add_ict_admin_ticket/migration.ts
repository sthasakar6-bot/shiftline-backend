#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3de7ca0de2810b9d02c3aaeab37d9075803c95577bc99538ba2cd5bc238ba64e/contract';
import startContract from '../../snapshots/3de7ca0de2810b9d02c3aaeab37d9075803c95577bc99538ba2cd5bc238ba64e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c8ac2789b8e32cf7ed1af94f8944769504e489de874eb71096c055d5ade1c943/contract';
import endContract from '../../snapshots/c8ac2789b8e32cf7ed1af94f8944769504e489de874eb71096c055d5ade1c943/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ictAdminTicket',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('normal'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
