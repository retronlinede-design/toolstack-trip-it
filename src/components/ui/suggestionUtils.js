const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const keyOf = (value) => clean(value).toLocaleLowerCase();

export function prepareSuggestions(items, query = "") {
  const unique = new Map();
  items.forEach((item, index) => {
    const source = typeof item === "string" ? { value: item } : item;
    const value = clean(source?.value);
    if (!value) return;
    const key = keyOf(value);
    const existing = unique.get(key);
    if (existing) {
      existing.frequency += Number(source.frequency ?? 1) || 1;
      existing.lastUsed = Math.max(existing.lastUsed, Number(source.lastUsed) || 0);
      return;
    }
    unique.set(key, {
      value,
      normalized: key,
      frequency: Number(source.frequency ?? 1) || 1,
      lastUsed: Number(source.lastUsed) || 0,
      firstIndex: index,
    });
  });

  const normalizedQuery = keyOf(query);
  return [...unique.values()]
    .map((item) => ({ ...item, matchRank: !normalizedQuery ? 0 : item.normalized.startsWith(normalizedQuery) ? 0 : item.normalized.includes(normalizedQuery) ? 1 : 2 }))
    .filter((item) => item.matchRank < 2)
    .sort((left, right) => left.matchRank - right.matchRank
      || right.lastUsed - left.lastUsed
      || right.frequency - left.frequency
      || left.value.localeCompare(right.value, undefined, { sensitivity: "base" })
      || left.firstIndex - right.firstIndex);
}
