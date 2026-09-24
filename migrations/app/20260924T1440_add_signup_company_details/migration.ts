#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b4d29cb4ae06636d67be699d6bc77f8670896a4af93f53427b5876d79c70c545/contract';
import startContract from '../../snapshots/b4d29cb4ae06636d67be699d6bc77f8670896a4af93f53427b5876d79c70c545/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ba539faae377f33b2e0175c6bd366de2775bfdaccae17bd120d095762de4886e/contract';
import endContract from '../../snapshots/ba539faae377f33b2e0175c6bd366de2775bfdaccae17bd120d095762de4886e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('addressCity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('addressNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('addressPostcode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('addressStreet', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('companyEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('companyPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('estimatedEmployeeCount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('termsAcceptedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
