#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3de7ca0de2810b9d02c3aaeab37d9075803c95577bc99538ba2cd5bc238ba64e/contract';
import endContract from '../../snapshots/3de7ca0de2810b9d02c3aaeab37d9075803c95577bc99538ba2cd5bc238ba64e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6501a756e3e8bc3b6844fb7f10c9fd58bc5110924a627b32dcd34424ee9be1b5/contract';
import startContract from '../../snapshots/6501a756e3e8bc3b6844fb7f10c9fd58bc5110924a627b32dcd34424ee9be1b5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'pendingSignup',
        columns: [
          col('billingCustomerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('billingSubscriptionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('interval', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paid', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('plan', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'pendingSignup',
        constraint: 'pendingSignup_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
