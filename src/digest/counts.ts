import type { DigestRow } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

// Derived from rows, not re-read from lines: retry = sum(retries); fail = rows whose lastStatus is `fail`; ok = sum(runs) - retry - fail.
export function nightCounts(rows: DigestRow[]): NightCounts {
  const runs = rows.reduce((total, row) => total + row.runs, 0);
  const retry = rows.reduce((total, row) => total + row.retries, 0);
  const fail = rows.filter((row) => row.lastStatus === 'fail').length;
  return { ok: runs - retry - fail, retry, fail };
}
