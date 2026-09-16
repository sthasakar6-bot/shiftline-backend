#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6cdd151ccc1f0b6965309d099be95f52c4949fb57c456583e9d8d0d42fe4d3b2/contract';
import endContract from '../../snapshots/6cdd151ccc1f0b6965309d099be95f52c4949fb57c456583e9d8d0d42fe4d3b2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f0bf9b81d4eb217e0e334ca09d8a06a75aaaadd052d98c8ddf60ddea2f85f4ba/contract';
import startContract from '../../snapshots/f0bf9b81d4eb217e0e334ca09d8a06a75aaaadd052d98c8ddf60ddea2f85f4ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'contract',
        column: col('endDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'contract',
        column: col('startDate', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
