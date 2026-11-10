/**
 * A depth-6 dasha tree in the engine's R-6 node shape, built by hand for tests (doc 67): the research fixture's
 * three-level Vimsottari tree, with every level-3 node between 2025-06-01 and 2028-06-01 split into three level-4
 * children, each split into three level-5 children, each into three level-6 children. Lords cycle through a fixed list;
 * dates are equal thirds of the parent span. Test data only: it stands in for the engine's answer, it is not astrology.
 */
type Node = { lord: string; level: number; start: string; end: string | null; children?: Node[] };

const LORDS = ['Saturn', 'Mercury', 'Ketu'];
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function split(n: Node, toLevel: number): Node[] {
  if (n.level >= toLevel || !n.end) return [];
  const a = day(n.start);
  const b = day(n.end);
  return [0, 1, 2].map((i) => {
    const c: Node = { lord: LORDS[i]!, level: n.level + 1, start: iso(a + ((b - a) * i) / 3), end: iso(a + ((b - a) * (i + 1)) / 3) };
    const kids = split(c, toLevel);
    return kids.length ? { ...c, children: kids } : c;
  });
}

/** `tree` (a three-level R-6 payload) deepened to `toLevel` inside [from, to); levels above 3 elsewhere stay absent. */
export function deepen(tree: { periods: unknown[] }, toLevel: number, from = '2025-06-01', to = '2028-06-01'): { periods: Node[]; levels: number; system?: string } {
  const walk = (nodes: Node[]): Node[] =>
    nodes.map((n) => {
      if (n.level === 3) return n.end && n.end > from && n.start < to ? { ...n, children: split(n, toLevel) } : n;
      return { ...n, children: walk(n.children ?? []) };
    });
  const base = structuredClone(tree) as { periods: Node[] };
  return { ...base, levels: toLevel, periods: walk(base.periods) };
}
