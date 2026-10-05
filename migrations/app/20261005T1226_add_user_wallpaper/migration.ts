#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ba539faae377f33b2e0175c6bd366de2775bfdaccae17bd120d095762de4886e/contract';
import startContract from '../../snapshots/ba539faae377f33b2e0175c6bd366de2775bfdaccae17bd120d095762de4886e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c6ffd7228c6d5baafae284b484bf1b422004ae2adf740ca193ee5546a9c87a58/contract';
import endContract from '../../snapshots/c6ffd7228c6d5baafae284b484bf1b422004ae2adf740ca193ee5546a9c87a58/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('wallpaperUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
