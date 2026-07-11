import fs from 'fs/promises';
import path from 'path';

/**
 * Must resolve to the SAME directory the main app/workers use:
 * main uses path.join(process.cwd(), 'storage') with cwd = workspace root.
 * This app's cwd is apps/recapforge, hence the ../../ default.
 */
function storageDir(): string {
  return process.env.STORAGE_DIR ?? path.resolve(process.cwd(), '..', '..', 'storage');
}

export async function saveTrack(key: string, body: Buffer): Promise<string> {
  const root = path.resolve(storageDir());
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  return target;
}
