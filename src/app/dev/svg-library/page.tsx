import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LibraryGallery, type IconManifest } from './library-gallery';

export const dynamic = 'force-static';

async function buildManifest(): Promise<IconManifest> {
  const iconsRoot = path.join(process.cwd(), 'public', 'icons', 'dnd');
  const categories = await fs.readdir(iconsRoot, { withFileTypes: true });

  const manifest: IconManifest = [];
  for (const cat of categories) {
    if (!cat.isDirectory()) continue;
    const dir = path.join(iconsRoot, cat.name);
    const files = await fs.readdir(dir);
    const svgs = files.filter((f) => f.endsWith('.svg')).sort();
    if (svgs.length === 0) continue;
    manifest.push({
      category: cat.name,
      icons: svgs.map((file) => ({
        name: file.replace(/\.svg$/, ''),
        path: `/icons/dnd/${cat.name}/${file}`,
        token: `${cat.name}/${file.replace(/\.svg$/, '')}`,
      })),
    });
  }
  manifest.sort((a, b) => a.category.localeCompare(b.category));
  return manifest;
}

export default async function SvgLibraryPage() {
  const manifest = await buildManifest();
  const totalCount = manifest.reduce((sum, c) => sum + c.icons.length, 0);

  return <LibraryGallery manifest={manifest} totalCount={totalCount} />;
}
