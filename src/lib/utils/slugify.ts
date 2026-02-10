/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50); // Limit length
}

/**
 * Generate a unique slug by appending a number if needed
 */
export async function generateUniqueSlug(
  baseText: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = slugify(baseText);
  let counter = 1;

  while (await checkExists(slug)) {
    slug = `${slugify(baseText)}-${counter}`;
    counter++;
  }

  return slug;
}
