#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6501a756e3e8bc3b6844fb7f10c9fd58bc5110924a627b32dcd34424ee9be1b5/contract';
import endContract from '../../snapshots/6501a756e3e8bc3b6844fb7f10c9fd58bc5110924a627b32dcd34424ee9be1b5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6cdd151ccc1f0b6965309d099be95f52c4949fb57c456583e9d8d0d42fe4d3b2/contract';
import startContract from '../../snapshots/6cdd151ccc1f0b6965309d099be95f52c4949fb57c456583e9d8d0d42fe4d3b2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('aiAssistantStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('aiAssistantSubscriptionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
