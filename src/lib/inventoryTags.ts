import type { Player } from '@/types';

/**
 * Parse inventory lifecycle tags from AI response text and apply them to a
 * copy of the players array. Server is the source of truth for inventory —
 * the LLM only emits tags, this function performs the mutations.
 *
 * Supported tags:
 *   [ITEM:idx:name:desc:uses]   — add item (no-op if same name already held)
 *   [USE_ITEM:idx:itemId]       — decrement uses by 1 (floored at 0; -1 = infinite)
 *   [REMOVE_ITEM:idx:itemId]    — remove item; clears equip if it was equipped
 *   [EQUIP:idx:itemId]          — set as the single equipped item
 *   [BREAK_ITEM:idx:itemId]     — mark broken and zero its uses
 *
 * Returns the text with all inventory tags stripped, plus the mutated players.
 */
// ANT-128: the model occasionally emits a technical id as the item name
// ("case_file", "old_note") despite prompt instructions. The name is the only
// thing the player sees on the inventory chip, so de-uglify id-shaped names:
// underscores → spaces, first letter capitalized ("Case file").
function humanizeItemName(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes('_')) return name;
  const words = name.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function parseInventoryTags(
  text: string,
  players: Player[]
): { cleanText: string; mutatedPlayers: Player[] } {
  const mutated = players.map((p) => ({
    ...p,
    inventory: (p.inventory ?? []).map((it) => ({ ...it })),
  }));

  // [ITEM:idx:name:desc:uses] — add item.
  // ANT-125: desc is lazy-greedy `(.+?)` anchored by the trailing `:uses]` so
  // colons inside the description ("Нотатка: стара адреса") don't break the
  // match — with `[^:]+` the tag silently failed and the item was never added.
  text = text.replace(
    /\[ITEM:(\d+):([^:]+):(.+?):(-?\d+)\]/g,
    (_, idx, name, desc, uses) => {
      const i = Number(idx);
      if (!mutated[i]) return '';
      const displayName = humanizeItemName(name.trim());
      const existing = mutated[i].inventory.find((it) => it.name === displayName);
      if (!existing) {
        mutated[i].inventory.push({
          id: `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: displayName,
          description: desc.trim(),
          uses: Number(uses),
        });
      }
      return '';
    }
  );

  // [USE_ITEM:idx:itemId] — decrement uses by 1
  text = text.replace(/\[USE_ITEM:(\d+):([^\]]+)\]/g, (_, idx, itemId) => {
    const i = Number(idx);
    if (!mutated[i]) return '';
    const item = mutated[i].inventory.find((it) => it.id === itemId);
    if (item && item.uses !== -1) {
      item.uses = Math.max(0, item.uses - 1);
    }
    return '';
  });

  // [REMOVE_ITEM:idx:itemId] — fully remove from inventory
  text = text.replace(/\[REMOVE_ITEM:(\d+):([^\]]+)\]/g, (_, idx, itemId) => {
    const i = Number(idx);
    if (!mutated[i]) return '';
    mutated[i].inventory = mutated[i].inventory.filter((it) => it.id !== itemId);
    if (mutated[i].equippedItemId === itemId) {
      mutated[i] = { ...mutated[i], equippedItemId: undefined };
    }
    return '';
  });

  // [EQUIP:idx:itemId] — mark as in-hand
  text = text.replace(/\[EQUIP:(\d+):([^\]]+)\]/g, (_, idx, itemId) => {
    const i = Number(idx);
    if (!mutated[i]) return '';
    mutated[i].inventory.forEach((it) => { it.equipped = false; });
    const item = mutated[i].inventory.find((it) => it.id === itemId);
    if (item) {
      item.equipped = true;
      mutated[i] = { ...mutated[i], equippedItemId: itemId };
    }
    return '';
  });

  // [BREAK_ITEM:idx:itemId] — mark as broken
  text = text.replace(/\[BREAK_ITEM:(\d+):([^\]]+)\]/g, (_, idx, itemId) => {
    const i = Number(idx);
    if (!mutated[i]) return '';
    const item = mutated[i].inventory.find((it) => it.id === itemId);
    if (item) {
      item.broken = true;
      item.uses = 0;
    }
    return '';
  });

  return { cleanText: text, mutatedPlayers: mutated };
}
