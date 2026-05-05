import { describe, it, expect, beforeEach } from 'vitest';
import { usePinnedItems } from '../pinned-items-store';

beforeEach(() => {
  usePinnedItems.setState({ pinned: [], activeSheetItem: null });
});

describe('usePinnedItems', () => {
  it('pins an item and assigns next order', () => {
    const store = usePinnedItems.getState();
    store.pin({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 });
    const { pinned } = usePinnedItems.getState();
    expect(pinned).toHaveLength(1);
    expect(pinned[0].id).toBe('npc-1');
  });

  it('does not duplicate pins', () => {
    const store = usePinnedItems.getState();
    const item = { id: 'npc-1', entityType: 'npc' as const, name: 'Arveth', order: 0 };
    store.pin(item);
    store.pin(item);
    expect(usePinnedItems.getState().pinned).toHaveLength(1);
  });

  it('unpins by id', () => {
    const store = usePinnedItems.getState();
    store.pin({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 });
    store.unpin('npc-1');
    expect(usePinnedItems.getState().pinned).toHaveLength(0);
  });

  it('isPinned returns true for pinned items', () => {
    const store = usePinnedItems.getState();
    store.pin({ id: 'item-1', entityType: 'item', name: 'Sword', order: 0 });
    expect(usePinnedItems.getState().isPinned('item-1')).toBe(true);
    expect(usePinnedItems.getState().isPinned('npc-1')).toBe(false);
  });

  it('reorder swaps order values', () => {
    const store = usePinnedItems.getState();
    store.pin({ id: 'a', entityType: 'npc', name: 'A', order: 0 });
    store.pin({ id: 'b', entityType: 'item', name: 'B', order: 1 });
    store.reorder(['b', 'a']);
    const { pinned } = usePinnedItems.getState();
    expect(pinned[0].id).toBe('b');
    expect(pinned[1].id).toBe('a');
  });

  it('openSheet sets activeSheetItem', () => {
    const store = usePinnedItems.getState();
    store.openSheet({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 });
    expect(usePinnedItems.getState().activeSheetItem?.id).toBe('npc-1');
  });

  it('closeSheet clears activeSheetItem', () => {
    const store = usePinnedItems.getState();
    store.openSheet({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 });
    store.closeSheet();
    expect(usePinnedItems.getState().activeSheetItem).toBeNull();
  });
});
