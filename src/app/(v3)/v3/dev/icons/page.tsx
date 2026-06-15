import { Surface } from '@/components/primitives/Surface';

/**
 * /v3/dev/icons — gallery for the 92-icon D&D set (Track A3). The icon set is
 * generated from the design SVGs once they are pushed to the branch
 * (docs/assets/designs/v3/.../assets/dnd/); until then this is a placeholder
 * that the gallery will iterate over the icon barrel export.
 */
export default function V3IconGalleryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-2xl font-bold text-[var(--q-text)]">
        Icon gallery
      </h1>
      <Surface variant="utility" className="p-5">
        <p className="text-sm text-[var(--q-text-dim)]">
          The typed D&D icon set (<code>src/components/icons/dnd/</code>) is generated from the v3
          design SVGs in Track A3. This gallery will render the barrel export once the assets land
          in the branch.
        </p>
      </Surface>
    </div>
  );
}
