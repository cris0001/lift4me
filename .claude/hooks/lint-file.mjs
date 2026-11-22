// PostToolUse hook: after Claude edits or writes a TS/TSX file, run ESLint and a
// Prettier check on that one file. Problems are printed to stderr with exit code 2,
// which Claude Code feeds back to the agent so it fixes them before moving on.
// Pure Node (no jq / bash specifics) so it runs the same on Windows and Linux.
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const LINTED = /\.(ts|tsx)$/;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || '{}');
const filePath = input.tool_response?.filePath ?? input.tool_input?.file_path;
if (!filePath || !LINTED.test(filePath)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = relative(root, resolve(root, filePath));
// Only files inside the workspace packages; skip anything outside the repo.
if (file.startsWith('..') || !/^(apps|packages)[\\/]/.test(file)) process.exit(0);

function run(bin, args) {
  return spawnSync(bin, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
}

const problems = [];

const eslint = run('pnpm', ['exec', 'eslint', '--no-warn-ignored', file]);
if (eslint.status !== 0) problems.push(`ESLint:\n${eslint.stdout}${eslint.stderr}`.trim());

const prettier = run('pnpm', ['exec', 'prettier', '--check', file]);
if (prettier.status !== 0) {
  problems.push(`Prettier: ${file} is not formatted. Run: pnpm exec prettier --write ${file}`);
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n\n')}\n`);
  process.exit(2);
}
