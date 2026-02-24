/**
 * Generate a URL-friendly slug from a string.
 * Falls back to a safe default when input has no slug-safe characters.
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return slug || 'campaign';
}

/**
 * Generate a unique slug by appending a number if needed.
 */
export async function generateUniqueSlug(
  baseText: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = slugify(baseText);
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    const suffix = `-${counter}`;
    const maxBaseLength = Math.max(1, 50 - suffix.length);
    slug = `${baseSlug.slice(0, maxBaseLength)}${suffix}`;
    counter++;
  }

  return slug;
}
