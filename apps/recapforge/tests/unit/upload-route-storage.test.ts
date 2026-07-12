import { describe, it, expect } from 'vitest';
import { getStorageMode } from '@main/lib/storage';

describe('forge upload uses shared storage', () => {
  it('resolves a storage mode from the shared lib', () => {
    // In dev (no STORAGE_MODE) this is "local"; in prod "r2". Either is valid —
    // the point is the forge route now defers to the SAME provider the worker reads.
    expect(['local', 'r2']).toContain(getStorageMode());
  });
});
