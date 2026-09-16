#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4d40b5d3d9b22b7ac13c1c4c29c7df6977e59ce7516cb329e8e2a6a9b6b9d60a/contract';
import endContract from '../../snapshots/4d40b5d3d9b22b7ac13c1c4c29c7df6977e59ce7516cb329e8e2a6a9b6b9d60a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8999b3096fa48b272cb27a5b284aa347f8bd2e62aa2aa05a7e23fec8bdb5a618/contract';
import startContract from '../../snapshots/8999b3096fa48b272cb27a5b284aa347f8bd2e62aa2aa05a7e23fec8bdb5a618/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('pendingInterval', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('pendingPlan', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
