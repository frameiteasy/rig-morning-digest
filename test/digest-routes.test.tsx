import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

describe('digest routes', () => {
  let tempDir: string;
  let config: {
    adapter: string;
    installed: string;
    beatEverySeconds: number;
    runsDir: string;
  };

  beforeAll(() => {
    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'rig-digest-test-'));

    // Copy good night (2026-10-28.jsonl with 1 bad line at the end)
    copyFileSync('runs/2026-10-28.jsonl', join(tempDir, '2026-10-28.jsonl'));

    // Create empty night file
    writeFileSync(join(tempDir, '2026-01-01.jsonl'), '');

    // Create night with a bad line (one valid line + one invalid line)
    writeFileSync(
      join(tempDir, '2026-01-02.jsonl'),
      '{"at":"2026-01-02T01:00:00+01:00","job":"test/job","status":"ok","owner":"test"}\n{not json',
    );

    // Configure app with temp directory
    config = {
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir: tempDir,
    };
  });

  afterAll(() => {
    // Cleanup will happen when OS cleans up tmpdir
  });

  describe('GET /digest/:night', () => {
    it('returns 200 with job names for good night', async () => {
      const res = await createApp(config).request('/digest/2026-10-28');
      expect(res.status).toBe(200);
      const html = await res.text();

      // Check that all 5 job names are present
      expect(html).toContain('rig/rotate-logs');
      expect(html).toContain('lane/sync');
      expect(html).toContain('fixtures/refresh');
      expect(html).toContain('notes/backup');
      expect(html).toContain('digest/render');
    });

    it('returns 404 for night with no file', async () => {
      const res = await createApp(config).request('/digest/2099-01-01');
      expect(res.status).toBe(404);
    });

    it('contains "nothing ran" for empty night', async () => {
      const res = await createApp(config).request('/digest/2026-01-01');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('nothing ran');
    });

    it('returns 200 for night with bad line', async () => {
      const res = await createApp(config).request('/digest/2026-01-02');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/digest/:night', () => {
    it('returns 200 with rows sorted by job for good night', async () => {
      const res = await createApp(config).request('/api/digest/2026-10-28');
      expect(res.status).toBe(200);
      const data = (await res.json()) as Night;

      // Check that all 5 jobs are present and sorted by job
      expect(data.rows).toHaveLength(5);
      expect(data.rows[0].job).toBe('digest/render');
      expect(data.rows[1].job).toBe('fixtures/refresh');
      expect(data.rows[2].job).toBe('lane/sync');
      expect(data.rows[3].job).toBe('notes/backup');
      expect(data.rows[4].job).toBe('rig/rotate-logs');

      // Check badLines count
      expect(data.badLines).toBe(1);
    });

    it('returns 404 with error message for night with no file', async () => {
      const res = await createApp(config).request('/api/digest/2099-01-01');
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('no such night');
    });

    it('returns 200 with empty rows for empty night', async () => {
      const res = await createApp(config).request('/api/digest/2026-01-01');
      expect(res.status).toBe(200);
      const data = (await res.json()) as Night;
      expect(data.rows).toHaveLength(0);
    });

    it('returns 200 with 1 row and 1 bad line for night with bad line', async () => {
      const res = await createApp(config).request('/api/digest/2026-01-02');
      expect(res.status).toBe(200);
      const data = (await res.json()) as Night;
      expect(data.rows).toHaveLength(1);
      expect(data.badLines).toBe(1);
    });
  });
});
