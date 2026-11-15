import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives 5 jobs sorted by job and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the times as written', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the last failure and its error', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('keeps a row whose owner is null', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when there is no file for the night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('ignores blank lines and counts invalid ones without throwing', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '   ',
      'not json',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"garbage","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok"}',
      '[1,2]',
      'null',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"retry","owner":"x"}',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), `${lines.join('\n')}\n`);
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(9);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 3,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'boom',
        first: '2026-01-01T01:00:00+01:00',
        last: '2026-01-01T03:00:00+01:00',
      },
    ]);
  });
});
