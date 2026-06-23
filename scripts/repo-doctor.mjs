#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import process from 'node:process';

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function short(sha) {
  return sha ? sha.slice(0, 7) : 'unknown';
}

const branch = git(['branch', '--show-current'], '(detached)');
const head = git(['rev-parse', 'HEAD']);
const main = git(['rev-parse', 'origin/main']);
const staging = git(['rev-parse', 'origin/staging']);
const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], '');
const status = git(['status', '--short']);
const aheadBehind = upstream ? git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], '') : '';
const mainStagingDiff = main && staging ? git(['diff', '--shortstat', 'origin/main..origin/staging'], '') : '';

console.log(`branch: ${branch}`);
console.log(`head: ${short(head)}`);
console.log(`upstream: ${upstream || 'none'}`);
if (aheadBehind) {
  const [behind, ahead] = aheadBehind.split(/\s+/);
  console.log(`upstream sync: ahead ${ahead}, behind ${behind}`);
}
console.log(`origin/main: ${short(main)}`);
console.log(`origin/staging: ${short(staging)}`);
console.log(main === staging ? 'main/staging: same tree ref' : `main/staging: drift${mainStagingDiff ? ` (${mainStagingDiff})` : ''}`);
console.log(status ? `worktree: dirty\n${status}` : 'worktree: clean');

if (branch === '(detached)' || !branch) process.exitCode = 1;
if (status) process.exitCode = 1;
