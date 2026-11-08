import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { Pool } from 'pg';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function docker(...args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 180000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout.trim();
}
export async function startStack() {
  if (!process.env.BACKEND_DIR) throw new Error('Set BACKEND_DIR to an explicit Backend checkout with npm ci and npm run build completed. Or use npm run dev with API_PROXY_TARGET for an existing API.');
  const backendDir = resolve(process.env.BACKEND_DIR);
  if (!existsSync(join(backendDir, 'dist/server.js')) || !existsSync(join(backendDir, 'database/migrations'))) throw new Error('BACKEND_DIR must contain dist/server.js and database/migrations. Build the Backend checkout first.');
  const name = `booking-frontend-${Date.now()}`;
  const baseURL = `http://127.0.0.1:${process.env.PREVIEW_PORT ?? 3000}`;
  let started = false, pool; const processes = [];
  function child(script, args, cwd, env = {}) {
    const processHandle = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; let failure;
    processHandle.stdout.on('data', value => { logs += value; }); processHandle.stderr.on('data', value => { logs += value; });
    processHandle.on('error', error => { failure = error; }); processes.push(processHandle);
    return { processHandle, logs: () => logs, error: () => failure };
  }
  async function wait(check, description) { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await check()) return; await delay(100); } throw new Error(`Timeout: ${description}`); }
  async function stop() {
    for (const processHandle of processes.reverse()) if (processHandle.exitCode === null) { const closed = new Promise(resolve => processHandle.once('close', resolve)); processHandle.kill(); await closed; }
    await pool?.end(); if (started) { docker('rm', '-f', '-v', name); started = false; }
  }
  try {
    docker('run', '-d', '--name', name, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=booking_frontend', 'postgres:17.6-bookworm'); started = true;
    const port = docker('inspect', '-f', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', name);
    const databaseURL = `postgresql://postgres@127.0.0.1:${port}/booking_frontend`;
    pool = new Pool({ connectionString: databaseURL });
    await wait(async () => { try { await pool.query('SELECT 1'); return true; } catch { return false; } }, 'PostgreSQL');
    const migrations = join(backendDir, 'database/migrations');
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) await pool.query(`BEGIN;\n${readFileSync(join(migrations, file), 'utf8')}\nCOMMIT;`);
    await pool.query(readFileSync(join(backendDir, 'database/seeds/001_room.sql'), 'utf8'));
    const backend = child('dist/server.js', [], backendDir, { DATABASE_URL: databaseURL, FRONTEND_ORIGIN: baseURL, PORT: '0', NODE_ENV: 'development', TRUSTED_PROXY_CIDRS: '', MAX_BOOKING_NIGHTS: '30', MAX_ADVANCE_DAYS: '365' });
    await wait(() => { if (backend.error() || backend.processHandle.exitCode !== null) throw new Error('Backend failed: ' + backend.logs()); return /http:\/\/127\.0\.0\.1:\d+/.test(backend.logs()); }, 'Backend startup');
    const backendURL = backend.logs().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    const frontend = child('node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', new URL(baseURL).port, '--strictPort'], new URL('../', import.meta.url), { API_PROXY_TARGET: backendURL });
    await wait(async () => {
      if (frontend.error() || frontend.processHandle.exitCode !== null) throw new Error('Frontend failed: ' + frontend.logs());
      try { return (await fetch(baseURL)).ok; } catch { return false; }
    }, 'Frontend startup');
    return { baseURL, databaseURL, stop };
  } catch (error) { await stop(); throw error; }
}
