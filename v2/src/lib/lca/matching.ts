/**
 * Material matching engine.
 *
 * Multi-signal matching algorithm that tries several strategies
 * in order of confidence to find the best LCA material match
 * for an IFC material name.
 */

import type {
  NormalizedMaterial,
  MaterialMatch,
  MatchMethod,
} from "@/types/lca";

// ---------------------------------------------------------------------------
// Matching strategies
// ---------------------------------------------------------------------------

interface MatchCandidate {
  material: NormalizedMaterial;
  score: number;
  method: MatchMethod;
}

/** Exact string match */
function tryExactMatch(
  name: string,
  candidates: NormalizedMaterial[]
): MatchCandidate | null {
  const match = candidates.find((c) => c.name === name);
  if (match) {
    return { material: match, score: 1.0, method: "exact" };
  }
  return null;
}

/** Case-insensitive match */
function tryCaseInsensitiveMatch(
  name: string,
  candidates: NormalizedMaterial[]
): MatchCandidate | null {
  const lower = name.toLowerCase();
  const match = candidates.find((c) => c.name.toLowerCase() === lower);
  if (match) {
    return { material: match, score: 0.99, method: "case_insensitive" };
  }
  return null;
}

/** Normalized name match — strips common prefixes, suffixes, numbers */
function tryNormalizedMatch(
  name: string,
  candidates: NormalizedMaterial[]
): MatchCandidate | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  let best: MatchCandidate | null = null;

  for (const c of candidates) {
    const cNorm = normalizeName(c.name);
    if (!cNorm) continue;

    if (cNorm === normalized) {
      const score = 0.95;
      if (!best || score > best.score) {
        best = { material: c, score, method: "fuzzy" };
      }
    }
  }

  return best;
}

/** Trigram similarity match */
function tryFuzzyMatch(
  name: string,
  candidates: NormalizedMaterial[],
  minScore = 0.6
): MatchCandidate | null {
  const nameTokens = trigrams(name.toLowerCase());
  let best: MatchCandidate | null = null;

  for (const c of candidates) {
    const cTokens = trigrams(c.name.toLowerCase());
    const score = trigramSimilarity(nameTokens, cTokens);

    if (score >= minScore && (!best || score > best.score)) {
      best = { material: c, score, method: "fuzzy" };
    }
  }

  return best;
}

/** Classification-based match using eBKP-H code → material category mapping */
function tryClassificationMatch(
  classificationCode: string | undefined,
  candidates: NormalizedMaterial[]
): MatchCandidate | null {
  if (!classificationCode) return null;

  const categoryKeywords = CLASSIFICATION_TO_KEYWORDS[classificationCode];
  if (!categoryKeywords) return null;

  // Find candidates whose category matches any of the keywords
  for (const c of candidates) {
    const catLower = c.category.toLowerCase();
    const nameLower = c.name.toLowerCase();

    for (const kw of categoryKeywords) {
      if (catLower.includes(kw) || nameLower.includes(kw)) {
        return { material: c, score: 0.7, method: "classification" };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main matching function
// ---------------------------------------------------------------------------

export interface MatchInput {
  /** Material name from IFC */
  materialName: string;
  /** Optional classification code (e.g., eBKP-H "C 2.1") */
  classificationCode?: string;
}

export interface MatchResult {
  match: MaterialMatch | null;
  /** All candidates considered, sorted by score desc */
  alternatives: Array<{
    material: NormalizedMaterial;
    score: number;
    method: MatchMethod;
  }>;
}

/**
 * Find the best LCA material match for an IFC material.
 *
 * Tries strategies in order of confidence:
 * 1. Exact name match (1.0)
 * 2. Case-insensitive name match (0.99)
 * 3. Normalized name match (0.95)
 * 4. Classification-based match (0.7)
 * 5. Fuzzy trigram match (0.6-0.9)
 *
 * @param input      Material name + optional classification
 * @param candidates Available LCA materials to match against
 * @param autoMatchThreshold Minimum score for automatic matching (default 0.9)
 */
export function findBestMatch(
  input: MatchInput,
  candidates: NormalizedMaterial[],
  autoMatchThreshold = 0.9
): MatchResult {
  const alternatives: MatchCandidate[] = [];

  // Try each strategy in order
  const exact = tryExactMatch(input.materialName, candidates);
  if (exact) alternatives.push(exact);

  const caseInsensitive = tryCaseInsensitiveMatch(
    input.materialName,
    candidates
  );
  if (caseInsensitive && !exact) alternatives.push(caseInsensitive);

  const normalized = tryNormalizedMatch(input.materialName, candidates);
  if (normalized) alternatives.push(normalized);

  const classification = tryClassificationMatch(
    input.classificationCode,
    candidates
  );
  if (classification) alternatives.push(classification);

  const fuzzy = tryFuzzyMatch(input.materialName, candidates, 0.5);
  if (fuzzy) alternatives.push(fuzzy);

  // Deduplicate and sort by score
  const seen = new Set<string>();
  const unique = alternatives.filter((a) => {
    if (seen.has(a.material.sourceId)) return false;
    seen.add(a.material.sourceId);
    return true;
  });
  unique.sort((a, b) => b.score - a.score);

  // Auto-match if best candidate exceeds threshold
  const best = unique[0] ?? null;
  const match: MaterialMatch | null =
    best && best.score >= autoMatchThreshold
      ? {
          lcaMaterialId: best.material.id,
          sourceId: best.material.sourceId,
          source: best.material.source,
          score: best.score,
          method: best.method,
          matchedAt: new Date(),
        }
      : null;

  return {
    match,
    alternatives: unique.map((a) => ({
      material: a.material,
      score: a.score,
      method: a.method,
    })),
  };
}

// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zäöüàéèêïôùûç\s]/g, " ") // Keep letters (including accented)
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.substring(i, i + 3));
  }
  return set;
}

function trigramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }

  return intersection / (a.size + b.size - intersection);
}

// ---------------------------------------------------------------------------
// Classification → keyword mapping (eBKP-H)
// ---------------------------------------------------------------------------

/** Maps eBKP-H codes to likely material category keywords */
const CLASSIFICATION_TO_KEYWORDS: Record<string, string[]> = {
  // C - Structure
  "C 1": ["beton", "concrete", "stahlbeton"],
  "C 1.1": ["beton", "concrete", "foundation"],
  "C 2": ["mauerwerk", "masonry", "wand", "wall"],
  "C 2.1": ["backstein", "ziegel", "brick", "kalksandstein"],
  "C 2.2": ["beton", "concrete", "wand"],
  "C 3": ["decke", "slab", "beton"],
  "C 4": ["dach", "roof"],
  "C 4.1": ["dach", "roof", "holz", "wood", "timber"],
  "C 4.3": ["flachdach", "flat roof"],

  // D - Enclosure
  "D 1": ["fassade", "facade", "aussenwand"],
  "D 2": ["fenster", "window", "glass", "glas"],
  "D 3": ["dach", "roof", "abdichtung"],

  // E - Interior
  "E 1": ["innenwand", "partition", "gips", "gypsum"],
  "E 2": ["bodenbelag", "floor", "parkett", "parquet"],
  "E 3": ["deckenbelag", "ceiling"],

  // G - Installations
  "G 1": ["sanitär", "sanitary"],
  "G 2": ["heizung", "heating", "wärme"],
  "G 3": ["lüftung", "ventilation"],
  "G 4": ["elektro", "electrical"],
};
