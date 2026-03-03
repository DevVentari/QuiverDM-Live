import type { TestInfo } from '@playwright/test';

type CheckpointStatus = 'passed' | 'failed';

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function checkpoint<T>(
  testInfo: TestInfo,
  name: string,
  fn: () => Promise<T>,
  budgetMs?: number,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;

    await testInfo.attach(`checkpoint-${slug(name)}.json`, {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify(
          {
            name,
            status: 'passed' as CheckpointStatus,
            durationMs,
            budgetMs: budgetMs ?? null,
          },
          null,
          2,
        ),
      ),
    });

    if (typeof budgetMs === 'number' && durationMs > budgetMs) {
      throw new Error(`Checkpoint "${name}" exceeded budget (${durationMs}ms > ${budgetMs}ms).`);
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await testInfo.attach(`checkpoint-${slug(name)}.json`, {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify(
          {
            name,
            status: 'failed' as CheckpointStatus,
            durationMs,
            budgetMs: budgetMs ?? null,
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      ),
    });
    throw error;
  }
}
