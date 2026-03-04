/**
 * Tests per lib/cannibalization.ts (ADR-003).
 *
 * detectCannibalization() è la logica più complessa del frontend.
 * Questi test assicurano che il comportamento resti determinato
 * anche dopo modifiche all'algoritmo o alle stopwords.
 */

import { describe, it, expect } from "vitest";
import { detectCannibalization, STOP } from "../lib/cannibalization";

// ── Nessuna cannibalizzazione attesa ──────────────────────────────────────────

describe("nessuna cannibalizzazione", () => {
  it("lista vuota", () => {
    expect(detectCannibalization([])).toEqual([]);
  });

  it("keyword senza intent non vengono considerate", () => {
    const kws = [
      { keyword: "agenzia seo milano professionale", intent: undefined },
      { keyword: "agenzia seo roma professionale",   intent: undefined },
    ];
    expect(detectCannibalization(kws)).toEqual([]);
  });

  it("keyword singola per intent — nessun confronto possibile", () => {
    const kws = [
      { keyword: "agenzia seo milano", intent: "commerciale" },
    ];
    expect(detectCannibalization(kws)).toEqual([]);
  });

  it("overlap < 2 parole significative — non segnalata", () => {
    const kws = [
      { keyword: "agenzia seo",      intent: "commerciale" },
      { keyword: "studio grafico",   intent: "commerciale" },
    ];
    // "agenzia" e "seo" non si sovrappongono con "studio" e "grafico"
    expect(detectCannibalization(kws)).toEqual([]);
  });
});

// ── Cannibalizzazione rilevata ────────────────────────────────────────────────

describe("cannibalizzazione rilevata", () => {
  it("overlap >= 2 parole significative nello stesso intent", () => {
    const kws = [
      { keyword: "agenzia seo milano professionale", intent: "commerciale" },
      { keyword: "agenzia seo roma professionale",   intent: "commerciale" },
    ];
    const result = detectCannibalization(kws);
    expect(result).toHaveLength(1);
    expect(result[0].intent).toBe("commerciale");
    expect(result[0].a).toBe("agenzia seo milano professionale");
    expect(result[0].b).toBe("agenzia seo roma professionale");
  });

  it("rileva più coppie in cannibalizzazione", () => {
    const kws = [
      { keyword: "agenzia seo milano ottima",      intent: "commerciale" },
      { keyword: "agenzia seo roma ottima",        intent: "commerciale" },
      { keyword: "agenzia seo napoli ottima",      intent: "commerciale" },
    ];
    // 3 keyword → 3 coppie possibili, tutte con overlap >= 2
    const result = detectCannibalization(kws);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Separazione per intent ────────────────────────────────────────────────────

describe("isolamento per intent", () => {
  it("keyword con overlap non vengono segnalate se intent diversi", () => {
    const kws = [
      { keyword: "agenzia seo milano professionale", intent: "commerciale" },
      { keyword: "agenzia seo milano professionale", intent: "informativo" },
    ];
    // Stesso testo, intent diversi → NON cannibalizzazione
    const result = detectCannibalization(kws);
    expect(result).toEqual([]);
  });

  it("gestisce più gruppi di intent indipendentemente", () => {
    const kws = [
      { keyword: "agenzia seo roma migliore",    intent: "commerciale" },
      { keyword: "agenzia seo napoli migliore",  intent: "commerciale" },
      { keyword: "cos'è agenzia seo professionale", intent: "informativo" },
      { keyword: "guida agenzia seo professionale", intent: "informativo" },
    ];
    const result = detectCannibalization(kws);
    // Cannibalizzazioni in entrambi i gruppi, ma separate
    const commerciali = result.filter((r) => r.intent === "commerciale");
    const informativi = result.filter((r) => r.intent === "informativo");
    expect(commerciali.length).toBeGreaterThan(0);
    expect(informativi.length).toBeGreaterThan(0);
  });
});

// ── Stopwords e token corti ───────────────────────────────────────────────────

describe("stopwords e token corti", () => {
  it("le stopwords non contribuiscono all'overlap", () => {
    const kws = [
      { keyword: "come fare seo", intent: "informativo" },
      { keyword: "come fare link building", intent: "informativo" },
    ];
    // "come" è stopword, "fare" ha 4 chars ma non è stopword — solo 1 overlap ("fare")
    // → NON deve segnalare cannibalizzazione (overlap < 2)
    const result = detectCannibalization(kws);
    expect(result).toEqual([]);
  });

  it("token di 2 caratteri o meno non contribuiscono all'overlap", () => {
    const kws = [
      { keyword: "seo ok web",     intent: "informativo" },
      { keyword: "seo ok digital", intent: "informativo" },
    ];
    // "ok" ha 2 chars → escluso; "seo" ha 3 chars → incluso
    // overlap = ["seo"] → solo 1 → NON cannibalizzazione
    const result = detectCannibalization(kws);
    expect(result).toEqual([]);
  });

  it("le stopwords italiane sono nel set STOP", () => {
    expect(STOP.has("di")).toBe(true);
    expect(STOP.has("il")).toBe(true);
    expect(STOP.has("per")).toBe(true);
    expect(STOP.has("non")).toBe(true);
  });

  it("le stopwords inglesi sono nel set STOP", () => {
    expect(STOP.has("the")).toBe(true);
    expect(STOP.has("for")).toBe(true);
    expect(STOP.has("best")).toBe(true);
    expect(STOP.has("how")).toBe(true);
  });
});
