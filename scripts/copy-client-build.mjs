import { cp, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'taft-client', 'dist');
const target = path.join(root, 'taft-server', 'public');
const staging = path.join(root, 'taft-server', '.public-next');
const backup = path.join(root, 'taft-server', '.public-previous');

await rm(staging, { recursive: true, force: true });
await rm(backup, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(source, staging, { recursive: true });

let hadPreviousBuild = false;
try {
  await rename(target, backup);
  hadPreviousBuild = true;
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

try {
  await rename(staging, target);
  await rm(backup, { recursive: true, force: true });
} catch (error) {
  if (hadPreviousBuild) await rename(backup, target);
  throw error;
}
