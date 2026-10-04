const LABELS = Object.freeze(['e', 'B', 'G', 'D', 'A', 'E']);

export function createFixedSixStringRows({ activeString = 1, placements = [] } = {}) {
  const byString = new Map(placements.map((item) => [item.string, item]));
  return LABELS.map((label, index) => {
    const string = index + 1;
    const placement = byString.get(string) ?? null;
    return Object.freeze({
      string,
      label,
      active: string === activeString,
      fret: placement?.fret ?? null,
      sourceEventId: placement?.sourceEventId ?? null,
    });
  });
}
