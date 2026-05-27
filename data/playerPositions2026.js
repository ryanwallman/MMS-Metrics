/**
 * Optional defensive positions by normalized player name (same normalization as server `normalizePlayerName`).
 * Leave a player out of this map when their position is unknown — they are treated as offense-only
 * (no defensive penalty when missing).
 *
 * Example:
 *   "anthony dimarco": "SS",
 */
module.exports = {
  normalizedNameToPosition: {},
};
