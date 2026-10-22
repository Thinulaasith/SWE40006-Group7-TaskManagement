import { randomBytes } from 'node:crypto';
import { writeFile, access, readFile, chmod } from 'node:fs/promises';
const file = new URL('./compose.env', import.meta.url);
try {
  await access(file);
  // Restore the monitoring token file without changing an existing database password.
  const contents = await readFile(file, 'utf8');
  const token = contents.match(/^METRICS_TOKEN=([a-f0-9]+)$/m)?.[1];
  if (token) {
    await writeFile(new URL('./metrics-token', import.meta.url), token, { mode: 0o644 });
    await chmod(new URL('./metrics-token', import.meta.url), 0o644);
  }
  console.log('Existing deploy/compose.env preserved.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const password = randomBytes(24).toString('hex');
  const token = randomBytes(32).toString('hex');
  await writeFile(file, `POSTGRES_PASSWORD=${password}\nMETRICS_TOKEN=${token}\nFRONTEND_ORIGIN=http://localhost:8080\nSECURE_COOKIES=false\nTRUST_PROXY=false\nAPP_PORT=8080\n`, { flag: 'wx', mode: 0o600 });
  // Prometheus runs as an unprivileged container user and needs to read this bind mount.
  await writeFile(new URL('./metrics-token', import.meta.url), token, { mode: 0o644 });
  console.log('Created local Docker credentials in deploy/compose.env.');
}
