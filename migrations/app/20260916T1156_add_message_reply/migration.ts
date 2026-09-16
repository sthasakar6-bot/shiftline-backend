#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4d40b5d3d9b22b7ac13c1c4c29c7df6977e59ce7516cb329e8e2a6a9b6b9d60a/contract';
import startContract from '../../snapshots/4d40b5d3d9b22b7ac13c1c4c29c7df6977e59ce7516cb329e8e2a6a9b6b9d60a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f0bf9b81d4eb217e0e334ca09d8a06a75aaaadd052d98c8ddf60ddea2f85f4ba/contract';
import endContract from '../../snapshots/f0bf9b81d4eb217e0e334ca09d8a06a75aaaadd052d98c8ddf60ddea2f85f4ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'message',
        column: col('replyToId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_replyToId_idx_f2e7fcdc',
        columns: ['replyToId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_replyToId_fkey',
          columns: ['replyToId'],
          references: { schema: 'public', table: 'message', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
