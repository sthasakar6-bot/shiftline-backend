#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3d78f108eed6fdbe21ac67df9dab5236b2ae5ade67197ba84c7b34e26194b597/contract';
import endContract from '../../snapshots/3d78f108eed6fdbe21ac67df9dab5236b2ae5ade67197ba84c7b34e26194b597/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/54b8d0713d4a6a2d065be88df71f3da60cfa7b86a32ec77d30739b497264aa58/contract';
import startContract from '../../snapshots/54b8d0713d4a6a2d065be88df71f3da60cfa7b86a32ec77d30739b497264aa58/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('plan', 'text', {
          notNull: true,
          default: lit('trial'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('trialEndsAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
