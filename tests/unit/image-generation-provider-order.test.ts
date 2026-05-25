import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  storageUpload: vi.fn(),
  isComfyUIAvailable: vi.fn(),
  isRunPodConfigured: vi.fn(),
  queueComfyUIPrompt: vi.fn(),
  waitForComfyUIResult: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawnSync: mocks.spawnSync,
}));

vi.mock('@/lib/storage', () => ({
  storage: { upload: mocks.storageUpload },
}));

vi.mock('@/lib/ai/comfyui', () => ({
  isComfyUIAvailable: mocks.isComfyUIAvailable,
  queueComfyUIPrompt: mocks.queueComfyUIPrompt,
  waitForComfyUIResult: mocks.waitForComfyUIResult,
}));

vi.mock('@/lib/ai/runpod-comfyui', () => ({
  isRunPodConfigured: mocks.isRunPodConfigured,
  queueRunPodJob: vi.fn(),
  waitForRunPodResult: vi.fn(),
}));

vi.mock('@fal-ai/serverless-client', () => ({
  config: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: { generate: vi.fn() },
  })),
}));

vi.mock('replicate', () => ({
  default: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
  })),
}));

import { generateImage } from '@/lib/ai/image-generation';

const BASE_REQUEST = {
  userId: 'user-1',
  type: 'npc',
  name: 'Test NPC',
  storageKeyPrefix: 'test/images',
};

describe('generateImage — provider slot ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HF_API_KEY;
    delete process.env.HF_API_SECRET;
    delete process.env.COMFYUI_URL;
    delete process.env.COMFYUI_ENABLED;
    delete process.env.FAL_KEY;
    delete process.env.REPLICATE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.RUNPOD_API_KEY;
    mocks.isRunPodConfigured.mockReturnValue(false);
    mocks.storageUpload.mockResolvedValue('https://r2.example.com/test-image.png');
  });

  it('prefers higgsfield over comfyui when both are enabled — higgsfield must be slot 0', async () => {
    process.env.COMFYUI_URL = 'http://localhost:8188';
    process.env.COMFYUI_ENABLED = 'true';
    process.env.HF_API_KEY = 'test-hf-key';
    process.env.HF_API_SECRET = 'test-hf-secret';

    mocks.isComfyUIAvailable.mockResolvedValue(true);
    mocks.queueComfyUIPrompt.mockResolvedValue({ promptId: 'p1', seed: 1 });
    mocks.waitForComfyUIResult.mockResolvedValue(Buffer.from('fake-img'));

    mocks.spawnSync.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: 'https://cdn.higgsfield.ai/generated/test.png\n',
      stderr: '',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));

    const result = await generateImage(BASE_REQUEST);

    // FAILS before Task 2: slot 0 is comfyui → result.provider === 'comfyui'
    // PASSES after Task 2:  slot 0 is higgsfield → result.provider === 'higgsfield'
    expect(result.provider).toBe('higgsfield');
  });

  it('uses comfyui when higgsfield keys are absent', async () => {
    process.env.COMFYUI_URL = 'http://localhost:8188';
    process.env.COMFYUI_ENABLED = 'true';

    mocks.isComfyUIAvailable.mockResolvedValue(true);
    mocks.queueComfyUIPrompt.mockResolvedValue({ promptId: 'p2', seed: 2 });
    mocks.waitForComfyUIResult.mockResolvedValue(Buffer.from('fake-img'));

    const result = await generateImage(BASE_REQUEST);

    expect(result.provider).toBe('comfyui');
  });
});
