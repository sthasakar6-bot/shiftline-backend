#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c44a66cfe22fcfdc93d907195f301c58759da18be422ece7370b4bc17188bbac/contract';
import startContract from '../../snapshots/c44a66cfe22fcfdc93d907195f301c58759da18be422ece7370b4bc17188bbac/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c6d682495283e6895ce23c866355825a022302cc426efc691447113ccceb4bf5/contract';
import endContract from '../../snapshots/c6d682495283e6895ce23c866355825a022302cc426efc691447113ccceb4bf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'openShiftRequest',
        columns: [
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('openShiftId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'openShiftRequest',
        index: 'openShiftRequest_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'openShiftRequest',
        index: 'openShiftRequest_openShiftId_idx_6d8d40d0',
        columns: ['openShiftId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'openShiftRequest',
        index: 'openShiftRequest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'openShiftRequest',
        foreignKey: {
          name: 'openShiftRequest_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'openShiftRequest',
        foreignKey: {
          name: 'openShiftRequest_openShiftId_fkey',
          columns: ['openShiftId'],
          references: { schema: 'public', table: 'openShift', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'openShiftRequest',
        foreignKey: {
          name: 'openShiftRequest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
