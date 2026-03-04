/**
 * Rilevamento cannibalizzazione keyword (ADR-003: logica client-side pura).
 *
 * Algoritmo:
 * 1. Raggruppa keyword per intent (solo quelle con intent assegnato)
 * 2. Per ogni coppia dello stesso gruppo: tokenizza e calcola overlap (escluse stopwords e token ≤ 2 chars)
 * 3. Segnala cannibalizzazione se overlap >= 2 parole significative
 */

export const STOP = new Set([
  "di","a","da","in","su","per","con","tra","fra","il","lo","la","i","gli","le",
  "un","uno","una","e","o","ma","che","è","si","ha","ho","non","del","della","dei",
  "the","an","of","for","on","at","to","with","and","or","but","is","are",
  "how","what","when","where","who","why","best","top","come","cosa","quando","dove",
]);

export type KWSlim = { keyword: string; intent?: string };

export function detectCannibalization(
  kws: KWSlim[]
): Array<{ a: string; b: string; intent: string }> {
  const intentGroups: Record<string, KWSlim[]> = {};
  kws.forEach((k) => {
    if (k.intent) {
      if (!intentGroups[k.intent]) intentGroups[k.intent] = [];
      intentGroups[k.intent].push(k);
    }
  });

  const pairs: Array<{ a: string; b: string; intent: string }> = [];
  Object.entries(intentGroups).forEach(([intent, group]) => {
    if (group.length < 2) return;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const wordsA = new Set(
          group[i].keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
        );
        const wordsB = group[j].keyword
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP.has(w));
        const overlap = wordsB.filter((w) => wordsA.has(w));
        if (overlap.length >= 2) pairs.push({ a: group[i].keyword, b: group[j].keyword, intent });
      }
    }
  });
  return pairs;
}
