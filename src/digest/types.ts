// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // error of the latest line that had one
  first: string; // `at` of the first line, offset kept as in the log
  last: string; // `at` of the last line, offset kept as in the log
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// Reads `<runsDir>/<night>.jsonl`. Returns null when there is no file for that night.
// An empty file gives `rows: []`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
