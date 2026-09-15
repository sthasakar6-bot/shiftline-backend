#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/83a658a37cd91e98c1b085d758ecfcabb9023abed8590baa5c3b40111e3f1b6a/contract';
import endContract from '../../snapshots/83a658a37cd91e98c1b085d758ecfcabb9023abed8590baa5c3b40111e3f1b6a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c6d682495283e6895ce23c866355825a022302cc426efc691447113ccceb4bf5/contract';
import startContract from '../../snapshots/c6d682495283e6895ce23c866355825a022302cc426efc691447113ccceb4bf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('billingCustomerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('billingInterval', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('billingProvider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('billingSubscriptionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('subscriptionStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
