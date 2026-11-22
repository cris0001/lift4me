// Stop hook: before Claude ends its turn, typecheck the whole workspace — but only
// when the working tree has uncommitted TS/TSX changes, so plain conversation turns
// cost nothing. Type errors go to stderr with exit code 2, which keeps Claude working
// until they're fixed. `stop_hook_active` is set when Claude is already continuing
// because of this hook; we let it stop then, so a stubborn error can't loop forever.
import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const run = (bin, args) =>
  spawnSync(bin, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });

const status = run('git', ['status', '--porcelain', '--', 'apps', 'packages']);
const changedTs = status.stdout.split('\n').some((line) => /\.(ts|tsx)"?$/.test(line.trim()));
if (!changedTs) process.exit(0);

const typecheck = run('pnpm', ['-r', 'typecheck']);
if (typecheck.status !== 0) {
  process.stderr.write(`Typecheck failed:\n${typecheck.stdout}${typecheck.stderr}`.trim() + '\n');
  process.exit(2);
}
