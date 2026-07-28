export function join(featureIds, rows) {
  const byFips = new Map(rows.map((r) => [r.id, r.value]))
  const out = {}
  for (const id of featureIds) out[id] = byFips.has(id) ? byFips.get(id) : null
  return out
}
