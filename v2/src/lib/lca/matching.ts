/**
 * Material matching engine.
 *
 * Multi-signal scoring: every candidate gets a composite score from
 * string similarity + domain-specific bonuses/penalties, then we pick the best.
 */

import type {
  NormalizedMaterial,
  MaterialMatch,
  MatchMethod,
} from "@/types/lca";
import { cleanIfcQuery, expandQueryWithSynonyms } from "./preprocessing";

// ---------------------------------------------------------------------------
// Domain-specific filters & bonuses
// ---------------------------------------------------------------------------

/**
 * LCA entries that describe disposal / end-of-life — never auto-match these
 * to production materials. Users can still pick them manually.
 */
const EOL_PATTERNS = [
  /\bend[- ]?of[- ]?life\b/i,
  /\bentsorgung\b/i,
  /\bmva\b/i, // Müllverbrennungsanlage
  /\bdeponierung?\b/i,
  /\brückbau\b/i,
  /\bdemolition\b/i,
  /\bdisposal\b/i,
  /\bincinerat/i,
  /\blandfill\b/i,
  /\brecyclingpotential\b/i,
  /\bmodul\s*[CD]\b/i, // Module C/D = end-of-life in EN 15804
];

function isEndOfLife(name: string): boolean {
  return EOL_PATTERNS.some((p) => p.test(name));
}

/**
 * Preferred LCA entries get a score bonus. These are national/regional
 * averages that are most appropriate for generic IFC material matching.
 */
const PREFERRED_PATTERNS = [
  /durchschnitt/i, // "Durchschnitt DE" — German national average
  /durchschn\./i, // abbreviated
  /\baverage\b/i,
  /\bgeneric\b/i,
  /\btypical\b/i,
];

function isPreferredEntry(name: string): boolean {
  return PREFERRED_PATTERNS.some((p) => p.test(name));
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  material: NormalizedMaterial;
  score: number;
  method: MatchMethod;
  detail: string; // for logging
}

/** Tokenize a name into lowercase words (2+ chars) */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-zäöüàéèêïôùûç0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zäöüàéèêïôùûç\s]/g, " ")
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

/** Token overlap: how many query tokens appear in the candidate name */
function tokenOverlapScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  let hits = 0;
  for (const qt of queryTokens) {
    if (candidateTokens.some((ct) => ct.includes(qt) || qt.includes(ct))) {
      hits++;
    }
  }
  return hits / queryTokens.length;
}

// ---------------------------------------------------------------------------
// Main matching function
// ---------------------------------------------------------------------------

export interface MatchInput {
  materialName: string;
  classificationCode?: string;
}

export interface MatchResult {
  match: MaterialMatch | null;
  alternatives: Array<{
    material: NormalizedMaterial;
    score: number;
    method: MatchMethod;
  }>;
}

/**
 * Score every candidate with a composite algorithm, then pick the best.
 *
 * Score = base_similarity + domain_bonuses + domain_penalties
 *
 * Base similarity: max of (exact, case-insensitive, normalized, trigram, token-overlap)
 * Domain bonuses:  +0.10 for "Durchschnitt" / average entries
 * Domain penalties: -1.0 for end-of-life/disposal entries (effectively excluded)
 */
export function findBestMatch(
  input: MatchInput,
  candidates: NormalizedMaterial[],
  autoMatchThreshold = 0.9
): MatchResult {
  // Preprocess
  const cleaned = cleanIfcQuery(input.materialName);
  const expanded = expandQueryWithSynonyms(cleaned);

  // Pre-compute query representations
  const queryLower = cleaned.toLowerCase();
  const queryNorm = normalizeName(cleaned);
  const queryTrigrams = trigrams(queryLower);
  const queryTokens = tokenize(cleaned);
  const expandedTokens = tokenize(expanded);
  const expandedTrigrams = trigrams(expanded.toLowerCase());

  // Score every candidate
  const scored: ScoredCandidate[] = [];

  for (const c of candidates) {
    const cLower = c.name.toLowerCase();
    const cNorm = normalizeName(c.name);
    const cTokens = tokenize(c.name);
    const cTrigrams = trigrams(cLower);

    // --- Base similarity (max of all strategies) ---
    let baseScore = 0;
    let method: MatchMethod = "fuzzy";
    let detail = "";

    // Exact match
    if (c.name === input.materialName || c.name === cleaned) {
      baseScore = 1.0;
      method = "exact";
      detail = "exact";
    }

    // Case-insensitive match
    if (cLower === queryLower || cLower === input.materialName.toLowerCase()) {
      const s = 0.99;
      if (s > baseScore) { baseScore = s; method = "case_insensitive"; detail = "case_insensitive"; }
    }

    // Normalized match
    if (queryNorm && cNorm && cNorm === queryNorm) {
      const s = 0.95;
      if (s > baseScore) { baseScore = s; method = "fuzzy"; detail = "normalized"; }
    }

    // Token overlap with cleaned query
    const overlapClean = tokenOverlapScore(queryTokens, cTokens);
    // Token overlap with expanded (synonym-enriched) query
    const overlapExpanded = tokenOverlapScore(expandedTokens, cTokens);
    const bestOverlap = Math.max(overlapClean, overlapExpanded);
    if (bestOverlap > 0) {
      // Scale: full overlap = 0.85, partial scales down
      const s = bestOverlap * 0.85;
      if (s > baseScore) { baseScore = s; method = "fuzzy"; detail = `overlap=${bestOverlap.toFixed(2)}`; }
    }

    // Trigram similarity with cleaned query
    const triSim = Math.max(
      trigramSimilarity(queryTrigrams, cTrigrams),
      trigramSimilarity(expandedTrigrams, cTrigrams)
    );
    if (triSim > 0) {
      const s = triSim * 0.80; // Scale: perfect trigram = 0.80
      if (s > baseScore) { baseScore = s; method = "fuzzy"; detail = `trigram=${triSim.toFixed(2)}`; }
    }

    // --- Domain bonuses ---

    // Prefer "Durchschnitt" (average) entries
    if (isPreferredEntry(c.name)) {
      baseScore += 0.10;
      detail += "+avg";
    }

    // Prefer shorter, more specific names (less noise)
    // Candidates with fewer tokens relative to query are more focused
    if (cTokens.length > 0 && queryTokens.length > 0) {
      const conciseness = Math.min(1, queryTokens.length / cTokens.length);
      baseScore += conciseness * 0.05;
    }

    // --- Domain penalties ---

    // End-of-life / disposal entries: hard exclude from auto-matching
    if (isEndOfLife(c.name)) {
      baseScore = Math.min(baseScore, 0.1); // Crush score but keep in alternatives for transparency
      detail += " [EOL]";
    }

    // Skip candidates with zero relevance
    if (baseScore < 0.15) continue;

    scored.push({ material: c, score: baseScore, method, detail });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by sourceId (keep highest score)
  const seen = new Set<string>();
  const unique = scored.filter((s) => {
    if (seen.has(s.material.sourceId)) return false;
    seen.add(s.material.sourceId);
    return true;
  });

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

  // Logging
  console.log(
    `[match:score] "${input.materialName}" → cleaned="${cleaned}" candidates=${candidates.length} scored=${unique.length} best=${best?.score.toFixed(2) ?? "none"}(${best?.detail ?? ""}) threshold=${autoMatchThreshold} accepted=${!!match}`
  );
  if (unique.length > 0) {
    console.log(
      `[match:score] Top 3: ${unique
        .slice(0, 3)
        .map((a) => `"${a.material.name.slice(0, 50)}" ${a.score.toFixed(2)}(${a.detail})`)
        .join(" | ")}`
    );
  }

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
// Classification → keyword mapping (eBKP-H)
// ---------------------------------------------------------------------------

/** Maps eBKP-H codes to likely material category keywords */
const CLASSIFICATION_TO_KEYWORDS: Record<string, string[]> = {
  "C 1": ["beton", "concrete", "stahlbeton"],
  "C 1.1": ["beton", "concrete", "foundation"],
  "C 2": ["mauerwerk", "masonry", "wand", "wall"],
  "C 2.1": ["backstein", "ziegel", "brick", "kalksandstein"],
  "C 2.2": ["beton", "concrete", "wand"],
  "C 3": ["decke", "slab", "beton"],
  "C 4": ["dach", "roof"],
  "C 4.1": ["dach", "roof", "holz", "wood", "timber"],
  "C 4.3": ["flachdach", "flat roof"],
  "D 1": ["fassade", "facade", "aussenwand"],
  "D 2": ["fenster", "window", "glass", "glas"],
  "D 3": ["dach", "roof", "abdichtung"],
  "E 1": ["innenwand", "partition", "gips", "gypsum"],
  "E 2": ["bodenbelag", "floor", "parkett", "parquet"],
  "E 3": ["deckenbelag", "ceiling"],
  "G 1": ["sanitär", "sanitary"],
  "G 2": ["heizung", "heating", "wärme"],
  "G 3": ["lüftung", "ventilation"],
  "G 4": ["elektro", "electrical"],
};
