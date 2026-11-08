import { spawn } from 'node:child_process';
import { startStack } from './stack.mjs';
const stack = await startStack();
try {
  console.log(`System test: ${stack.baseURL}`);
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { cwd: new URL('../', import.meta.url), env: { ...process.env, BASE_URL: stack.baseURL, TEST_DATABASE_URL: stack.databaseURL }, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (code !== 0) process.exitCode = 1;
} finally { await stack.stop(); }
