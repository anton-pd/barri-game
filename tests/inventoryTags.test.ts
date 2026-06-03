import { describe, it, expect } from 'vitest';
import { parseInventoryTags } from '@/lib/inventoryTags';
import { makePlayer } from './fixtures';
import type { InventoryItem } from '@/types';

const lantern: InventoryItem = { id: 'item_lantern', name: 'Ліхтар', description: 'Гасовий ліхтар', uses: 3 };

describe('parseInventoryTags', () => {
  it('adds an item via [ITEM] and strips the tag from text', () => {
    const players = [makePlayer({ inventory: [] })];
    const { cleanText, mutatedPlayers } = parseInventoryTags(
      'Ти підбираєш ліхтар. [ITEM:0:Ліхтар:Гасовий ліхтар:3]',
      players
    );
    expect(cleanText.trim()).toBe('Ти підбираєш ліхтар.');
    expect(mutatedPlayers[0].inventory).toHaveLength(1);
    expect(mutatedPlayers[0].inventory[0]).toMatchObject({ name: 'Ліхтар', uses: 3 });
  });

  it('does not duplicate an item with the same name', () => {
    const players = [makePlayer({ inventory: [{ ...lantern }] })];
    const { mutatedPlayers } = parseInventoryTags('[ITEM:0:Ліхтар:Інший:1]', players);
    expect(mutatedPlayers[0].inventory).toHaveLength(1);
  });

  it('decrements uses via [USE_ITEM], floored at 0', () => {
    const players = [makePlayer({ inventory: [{ ...lantern, uses: 1 }] })];
    const once = parseInventoryTags('[USE_ITEM:0:item_lantern]', players).mutatedPlayers;
    expect(once[0].inventory[0].uses).toBe(0);
    const twice = parseInventoryTags('[USE_ITEM:0:item_lantern]', once).mutatedPlayers;
    expect(twice[0].inventory[0].uses).toBe(0);
  });

  it('never decrements an infinite (-1) item', () => {
    const players = [makePlayer({ inventory: [{ ...lantern, uses: -1 }] })];
    const { mutatedPlayers } = parseInventoryTags('[USE_ITEM:0:item_lantern]', players);
    expect(mutatedPlayers[0].inventory[0].uses).toBe(-1);
  });

  it('removes an item via [REMOVE_ITEM] and clears equip if it was equipped', () => {
    const players = [makePlayer({ inventory: [{ ...lantern, equipped: true }], equippedItemId: 'item_lantern' })];
    const { mutatedPlayers } = parseInventoryTags('[REMOVE_ITEM:0:item_lantern]', players);
    expect(mutatedPlayers[0].inventory).toHaveLength(0);
    expect(mutatedPlayers[0].equippedItemId).toBeUndefined();
  });

  it('equips one item exclusively via [EQUIP]', () => {
    const knife: InventoryItem = { id: 'item_knife', name: 'Ніж', description: '', uses: -1, equipped: true };
    const players = [makePlayer({ inventory: [{ ...lantern }, knife], equippedItemId: 'item_knife' })];
    const { mutatedPlayers } = parseInventoryTags('[EQUIP:0:item_lantern]', players);
    const inv = mutatedPlayers[0].inventory;
    expect(inv.find((i) => i.id === 'item_lantern')?.equipped).toBe(true);
    expect(inv.find((i) => i.id === 'item_knife')?.equipped).toBe(false);
    expect(mutatedPlayers[0].equippedItemId).toBe('item_lantern');
  });

  it('marks an item broken and zeroes its uses via [BREAK_ITEM]', () => {
    const players = [makePlayer({ inventory: [{ ...lantern }] })];
    const { mutatedPlayers } = parseInventoryTags('[BREAK_ITEM:0:item_lantern]', players);
    expect(mutatedPlayers[0].inventory[0]).toMatchObject({ broken: true, uses: 0 });
  });

  it('does not mutate the original players array (pure)', () => {
    const players = [makePlayer({ inventory: [{ ...lantern }] })];
    parseInventoryTags('[BREAK_ITEM:0:item_lantern]', players);
    expect(players[0].inventory[0].broken).toBeUndefined();
  });

  it('ignores tags pointing at a non-existent player index', () => {
    const players = [makePlayer({ inventory: [] })];
    const { mutatedPlayers } = parseInventoryTags('[ITEM:5:Привид:опис:1]', players);
    expect(mutatedPlayers[0].inventory).toHaveLength(0);
  });
});
