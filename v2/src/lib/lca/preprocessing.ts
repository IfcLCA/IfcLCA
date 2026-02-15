/**
 * IFC material query preprocessing for LCA matching.
 *
 * Ported from github.com/louistrue/llm-lca-material-match
 * Four layers of improvement at zero API cost:
 * 1. Query cleaning: Strip Revit/ArchiCAD/Tekla naming noise
 * 2. Cross-lingual synonyms: Map EN/NL/FR terms → DE KBOB terms
 * 3. Element-type category filtering (KBOB + Ökobaudat)
 * 4. Ökobaudat search-term extraction: Clean German keywords for API
 */

// ---------------------------------------------------------------------------
// 1. Query Cleaning
// ---------------------------------------------------------------------------

/** Known construction terms with umlauts (ASCII → umlaut). */
const UMLAUT_WORDS: Record<string, string> = {
  waerme: "wärme",
  daemm: "dämm",
  daemmung: "dämmung",
  waermedaemmung: "wärmedämmung",
  gruendung: "gründung",
  uebergang: "übergang",
  auessere: "äussere",
  aeussere: "äussere",
  oeffnung: "öffnung",
};

function normalizeUmlauts(text: string): string {
  let lower = text.toLowerCase();
  for (const [ascii, umlaut] of Object.entries(UMLAUT_WORDS)) {
    const idx = lower.indexOf(ascii);
    if (idx !== -1) {
      text = text.slice(0, idx) + umlaut + text.slice(idx + ascii.length);
      lower = text.toLowerCase();
    }
  }
  return text;
}

/**
 * Normalize IFC material names from various BIM authoring tools.
 *
 * Handles Revit Swiss conventions (_wg suffix, underscores),
 * numeric IDs, RGB codes, tool prefixes (f2_, h2_, DD_, AT_),
 * German umlaut ASCII encoding, and Revit composite names.
 */
export function cleanIfcQuery(query: string): string {
  const original = query;

  // Strip leading/trailing underscores and whitespace
  query = query.trim().replace(/^_+|_+$/g, "").trim();

  // Remove Revit _wg suffix (Werkgruppe)
  query = query.replace(/[_ ]wg$/i, "");

  // Remove tool-specific prefixes: f2_, h2_, DD_, AT_
  query = query.replace(/^([a-zA-Z]\d?_|DD[_ ]|AT_)/, "");

  // Remove long numeric IDs (6+ digits)
  query = query.replace(/\b\d{6,}\b/g, "");

  // Remove RGB-style color codes
  query = query.replace(/\b\d{1,3}-\d{1,3}-\d{1,3}\b/g, "");

  // Replace underscores with spaces
  query = query.replace(/_/g, " ");

  // Normalize German umlauts from ASCII encoding
  query = normalizeUmlauts(query);

  // Extract material info from Revit composite names like
  // "Floor:STB 25cm, Beton C30/37 Bodenplatte 2:2515405"
  const materialKeywords = [
    "beton",
    "holz",
    "stahl",
    "gips",
    "glas",
    "dämm",
    "isolier",
  ];
  if (
    query.includes(":") &&
    materialKeywords.some((kw) => query.toLowerCase().includes(kw))
  ) {
    const parts = query.split(":");
    for (const part of parts) {
      const trimmed = part.trim();
      if (
        materialKeywords.some((kw) => trimmed.toLowerCase().includes(kw))
      ) {
        query = trimmed;
        break;
      }
    }
  }

  // Clean up multiple spaces
  query = query.replace(/\s+/g, " ").trim();

  // Remove trailing numeric debris
  query = query.replace(/\s+\d+$/, "").trim();

  return query || original;
}

// ---------------------------------------------------------------------------
// 2. Cross-Lingual Synonym Expansion
// ---------------------------------------------------------------------------

/** Maps IFC material terms (any language) to German KBOB search terms. */
const SYNONYM_MAP: Record<string, string[]> = {
  // Dutch → German
  staal: ["Stahl", "Stahlprofil"],
  beton: ["Beton", "Hochbaubeton"],
  prefab: ["Fertigteil", "Betonfertigteil"],
  prefabbeton: ["Betonfertigteil"],
  isolatie: ["Dämmung", "Wärmedämmung"],
  gevel: ["Fassade"],
  randen: ["Rand", "Betonfertigteil"],
  ihwg: ["Hochbaubeton"],

  // English → German (comprehensive BIM material coverage)
  // Concrete
  concrete: ["Beton", "Hochbaubeton"],
  "cast in situ": ["Ortbeton", "Hochbaubeton"],
  "cast-in-place": ["Ortbeton", "Hochbaubeton"],
  "precast concrete": ["Betonfertigteil"],
  "reinforced concrete": ["Hochbaubeton"],
  "lightweight concrete": ["Leichtzementstein", "Porenbetonstein"],

  // Steel / Metal
  steel: ["Stahl", "Stahlprofil"],
  "stainless steel": ["Edelstahl", "Chromstahl"],
  "structural steel": ["Stahlprofil", "Stahl"],
  metal: ["Stahl", "Stahlprofil"],
  "metal stud": ["Metallständer", "Ständerwerk"],
  "stud layer": ["Ständerwerk", "Metallständer"],
  aluminum: ["Aluminiumblech", "Aluminium"],
  aluminium: ["Aluminiumblech", "Aluminium"],
  copper: ["Kupferblech", "Kupfer"],
  zinc: ["Zinkblech", "Zink"],

  // Insulation
  insulation: ["Dämmung", "Wärmedämmung"],
  "rigid insulation": ["Polystyrol extrudiert", "XPS", "EPS"],
  "semi-rigid insulation": ["Glaswolle", "Steinwolle"],
  "thermal barriers": ["Wärmedämmung"],
  "thermal insulation": ["Wärmedämmung", "Dämmung"],
  "mineral wool": ["Mineralwolle", "Steinwolle", "Glaswolle"],
  "glass wool": ["Glaswolle"],
  "rock wool": ["Steinwolle"],
  "stone wool": ["Steinwolle"],
  "foam glass": ["Schaumglas"],
  polystyrene: ["Polystyrol"],
  styrofoam: ["Polystyrol expandiert EPS"],
  xps: ["Polystyrol extrudiert XPS"],
  eps: ["Polystyrol expandiert EPS"],

  // Wood
  wood: ["Holz", "Konstruktionsholz"],
  timber: ["Holz", "Konstruktionsholz", "Brettschichtholz"],
  lumber: ["Konstruktionsholz", "Schnittholz"],
  "dimensional lumber": ["Konstruktionsholz", "Brettschichtholz"],
  "glulam": ["Brettschichtholz"],
  "laminated timber": ["Brettschichtholz"],
  plywood: ["Sperrholzplatte"],
  "wood flooring": ["Parkett"],
  hardwood: ["Laubholz", "Parkett"],
  softwood: ["Nadelholz", "Konstruktionsholz"],
  "wood panel": ["Holzwerkstoff", "Sperrholzplatte"],
  sheathing: ["Holzwerkstoff", "Sperrholzplatte"],
  osb: ["Spanplatte", "Holzwerkstoff"],

  // Masonry
  masonry: ["Mauerwerk"],
  brick: ["Backstein", "Mauerwerk"],
  "concrete block": ["Zementstein", "Betonstein"],
  "concrete masonry": ["Betonstein", "Mauerwerk"],
  "sand lime brick": ["Kalksandstein"],
  "aerated concrete": ["Porenbetonstein"],

  // Gypsum / Drywall
  gypsum: ["Gips", "Gipskartonplatte"],
  "gypsum board": ["Gipskartonplatte"],
  "gypsum wall board": ["Gipskartonplatte"],
  drywall: ["Gipskartonplatte"],
  plasterboard: ["Gipskartonplatte"],
  plaster: ["Gipsputz", "Putz"],
  stucco: ["Putz", "Aussenputz"],

  // Glass
  glass: ["Glas"],
  glazing: ["Verglasung", "Glas"],
  "double glazing": ["Isolierverglasung"],
  "triple glazing": ["Isolierverglasung"],

  // Waterproofing / Membrane
  membrane: ["Abdichtung", "Dichtungsbahn"],
  "vapor barrier": ["Dampfbremse", "Dampfsperre"],
  "vapor retarder": ["Dampfbremse"],
  waterproofing: ["Abdichtung"],
  "epdm membrane": ["Dichtungsbahn Gummi EPDM"],
  epdm: ["Dichtungsbahn Gummi EPDM"],
  bitumen: ["Bitumen", "Bitumenbahn"],
  roofing: ["Dachdeckung", "Dichtungsbahn"],
  "roofing felt": ["Bitumenbahn", "Dachdeckung"],

  // Finishes / Cladding
  "ceramic tile": ["Keramikplatte", "Steinzeugplatte"],
  tile: ["Keramikplatte", "Fliese"],
  ceramic: ["Keramik", "Fliese"],
  "natural stone": ["Natursteinplatte"],
  granite: ["Granit", "Naturstein"],
  marble: ["Marmor", "Naturstein"],
  slate: ["Schiefer", "Naturstein"],
  carpet: ["Teppich", "Bodenbelag"],
  linoleum: ["Linoleum", "Bodenbelag"],
  vinyl: ["Vinyl", "Bodenbelag"],
  "floor covering": ["Bodenbelag"],
  paint: ["Anstrich", "Farbe"],
  coating: ["Beschichtung", "Anstrich"],
  render: ["Putz", "Aussenputz"],
  cladding: ["Fassadenbekleidung", "Bekleidung"],

  // Mortar / Adhesive
  mortar: ["Mörtel", "Zementmörtel"],
  grout: ["Mörtel", "Zementmörtel"],
  adhesive: ["Klebstoff", "Mörtel"],
  sealant: ["Dichtungsmasse", "Fugendichtung"],

  // Misc
  "air space": ["Luftschicht"],
  "air gap": ["Luftschicht"],
  gravel: ["Kies", "Kiessand"],
  sand: ["Sand", "Kiessand"],
  earth: ["Erdreich", "Aushub"],
  soil: ["Erdreich", "Aushub"],
  asphalt: ["Asphalt", "Gussasphalt"],
  "fiber cement": ["Faserzement"],
  "fibre cement": ["Faserzement"],
  "cement board": ["Faserzement"],
  rubber: ["Gummi", "Kautschuk"],
  pvc: ["PVC", "Kunststoff"],
  plastic: ["Kunststoff"],
  polyethylene: ["Polyethylen"],
  polycarbonate: ["Polycarbonat"],
  acrylic: ["Acrylglas"],

  // Generic German → specific KBOB
  "wärmedämmung druckfest": [
    "Polystyrol extrudiert XPS",
    "Polystyrol expandiert EPS",
  ],
  wärmedämmung: [
    "Glaswolle",
    "Steinwolle",
    "Polystyrol expandiert EPS",
  ],
  "dämmung hart": [
    "Polystyrol extrudiert XPS",
    "Polystyrol expandiert EPS",
    "Schaumglas",
  ],
  "dämmung weich": ["Glaswolle", "Steinwolle", "Weichfaserplatte"],
  "isolierung hart": [
    "Polystyrol extrudiert XPS",
    "Polystyrol expandiert EPS",
  ],
  "ortbeton bewehrt": ["Hochbaubeton"],
  ortbeton: ["Hochbaubeton"],
  stahlbeton: ["Hochbaubeton"],
  leichtbeton: ["Porenbetonstein", "Leichtzementstein"],
  trockenbau: ["Gipskartonplatte", "Gipsfaserplatte"],
  rigips: ["Gipskartonplatte"],
  naturstein: ["Natursteinplatte"],
  edelstahl: ["Edelstahl", "Chromstahl"],
  zink: ["Zinkblech"],
  vorfabriziert: ["Betonfertigteil"],
  fertigbeton: ["Betonfertigteil"],
};

/**
 * Expand a cleaned query with German KBOB synonyms.
 * Longest matches first to prioritize specificity.
 */
export function expandQueryWithSynonyms(query: string): string {
  const lower = query.toLowerCase();
  const expansions = new Set<string>();

  // Sort keys by length descending (most specific first)
  const keys = Object.keys(SYNONYM_MAP).sort(
    (a, b) => b.length - a.length
  );

  for (const key of keys) {
    if (lower.includes(key)) {
      for (const synonym of SYNONYM_MAP[key]) {
        expansions.add(synonym);
      }
    }
  }

  if (expansions.size > 0) {
    return query + " | " + [...expansions].sort().join(" ");
  }
  return query;
}

// ---------------------------------------------------------------------------
// 3. Ökobaudat Search-Term Extraction
// ---------------------------------------------------------------------------

/**
 * Maps material keywords (any language, lowercase) to German search terms
 * suitable for the Ökobaudat full-text search API.
 * The API does AND matching, so each term should be a single keyword.
 */
const MATERIAL_KEYWORD_TO_OEKO: Record<string, string[]> = {
  // German construction terms
  ortbeton: ["Beton"],
  stahlbeton: ["Beton"],
  hochbaubeton: ["Beton"],
  spannbeton: ["Spannbeton", "Beton"],
  leichtbeton: ["Leichtbeton", "Beton"],
  porenbeton: ["Porenbeton"],
  beton: ["Beton"],
  estrich: ["Estrich"],
  mörtel: ["Mörtel"],
  putz: ["Putz"],
  zement: ["Zement"],
  kalksandstein: ["Kalksandstein"],
  mauerwerk: ["Mauerwerk", "Kalksandstein"],
  backstein: ["Ziegel", "Klinker"],
  ziegel: ["Ziegel"],
  klinker: ["Klinker"],
  wärmedämmung: ["Dämmstoff", "Dämmung"],
  dämmung: ["Dämmstoff", "Dämmung"],
  steinwolle: ["Steinwolle"],
  glaswolle: ["Glaswolle"],
  mineralwolle: ["Mineralwolle"],
  polystyrol: ["Polystyrol"],
  eps: ["EPS"],
  xps: ["XPS"],
  schaumglas: ["Schaumglas"],
  isolierung: ["Dämmstoff", "Dämmung"],
  weichfaser: ["Holzfaser"],
  holzfaser: ["Holzfaser"],
  holz: ["Holz"],
  brettschichtholz: ["Brettschichtholz"],
  sperrholz: ["Sperrholz"],
  parkett: ["Parkett"],
  laminat: ["Laminat"],
  konstruktionsholz: ["Konstruktionsholz", "Schnittholz"],
  schnittholz: ["Schnittholz"],
  stahl: ["Stahl"],
  edelstahl: ["Edelstahl"],
  chromstahl: ["Edelstahl"],
  zink: ["Zink"],
  kupfer: ["Kupfer"],
  aluminium: ["Aluminium"],
  metall: ["Stahl"],
  gipskarton: ["Gipskartonplatte", "Gips"],
  gipsfaser: ["Gipsfaserplatte", "Gips"],
  gipsplatte: ["Gipsplatte", "Gips"],
  gips: ["Gips"],
  rigips: ["Gipskartonplatte", "Gips"],
  trockenbau: ["Gipskartonplatte", "Gips"],
  glas: ["Glas"],
  isolierverglasung: ["Verglasung", "Glas"],
  verglasung: ["Verglasung", "Glas"],
  faserzement: ["Faserzement"],
  bitumen: ["Bitumen"],
  dachdeckung: ["Dach"],
  epdm: ["EPDM"],
  abdichtung: ["Abdichtung"],
  dichtungsbahn: ["Abdichtung"],
  fliese: ["Fliese"],
  keramik: ["Keramik", "Fliese"],
  naturstein: ["Naturstein"],
  granit: ["Granit", "Naturstein"],
  kies: ["Kies"],
  schotter: ["Kies"],

  // English → German
  concrete: ["Beton"],
  "reinforced concrete": ["Beton"],
  "cast in situ": ["Beton"],
  "lightweight concrete": ["Leichtbeton", "Beton"],
  "concrete block": ["Betonstein", "Beton"],
  precast: ["Betonfertigteil", "Beton"],
  mortar: ["Mörtel"],
  screed: ["Estrich"],
  steel: ["Stahl"],
  "stainless steel": ["Edelstahl"],
  aluminum: ["Aluminium"],
  zinc: ["Zink"],
  copper: ["Kupfer"],
  metal: ["Stahl"],
  wood: ["Holz"],
  timber: ["Holz"],
  lumber: ["Schnittholz", "Holz"],
  plywood: ["Sperrholz", "Holz"],
  flooring: ["Bodenbelag", "Parkett"],
  sheathing: ["Holzwerkstoff", "Sperrholz"],
  insulation: ["Dämmstoff", "Dämmung"],
  "rigid insulation": ["Polystyrol", "XPS", "EPS", "Dämmstoff"],
  "semi-rigid insulation": ["Mineralwolle", "Steinwolle", "Glaswolle"],
  "semi-rigid": ["Mineralwolle", "Steinwolle", "Glaswolle"],
  "thermal barrier": ["Dämmstoff"],
  "glass wool": ["Glaswolle"],
  "rock wool": ["Steinwolle"],
  "stone wool": ["Steinwolle"],
  "mineral wool": ["Mineralwolle"],
  "foam glass": ["Schaumglas"],
  plasterboard: ["Gipskartonplatte", "Gips"],
  drywall: ["Gipskartonplatte"],
  gypsum: ["Gips"],
  glass: ["Glas"],
  glazing: ["Verglasung", "Glas"],
  masonry: ["Mauerwerk", "Kalksandstein"],
  brick: ["Ziegel", "Klinker"],
  "natural stone": ["Naturstein"],
  granite: ["Granit", "Naturstein"],
  gravel: ["Kies"],
  tile: ["Fliese"],
  ceramic: ["Keramik", "Fliese"],
  roofing: ["Dach", "Bitumen"],
  membrane: ["Abdichtung", "EPDM"],
  "fibre cement": ["Faserzement"],
  "fiber cement": ["Faserzement"],

  // Dutch → German
  staal: ["Stahl"],
  prefabbeton: ["Betonfertigteil", "Beton"],
  prefab: ["Betonfertigteil", "Beton"],
  isolatie: ["Dämmstoff", "Dämmung"],
  gevel: ["Fassade"],
  hout: ["Holz"],
  steen: ["Naturstein"],
  baksteen: ["Ziegel"],

  // French → German
  béton: ["Beton"],
  acier: ["Stahl"],
  bois: ["Holz"],
  isolation: ["Dämmstoff"],
  verre: ["Glas"],
};

/**
 * Derive clean German search keywords for the Ökobaudat API.
 *
 * The Ökobaudat name search does AND full-text matching.
 * Multi-word queries with noise return zero results.
 * This function cleans the IFC query and extracts the best
 * German search terms (specific → broad).
 *
 * Never returns empty — falls back to the longest word.
 */
export function extractOekobaudatSearchTerms(query: string): string[] {
  const cleaned = cleanIfcQuery(query).toLowerCase();

  // Collect all keyword matches with position and length
  const matches: Array<{
    pos: number;
    len: number;
    keyword: string;
    terms: string[];
  }> = [];

  for (const keyword of Object.keys(MATERIAL_KEYWORD_TO_OEKO)) {
    const pos = cleaned.indexOf(keyword);
    if (pos !== -1) {
      matches.push({
        pos,
        len: keyword.length,
        keyword,
        terms: MATERIAL_KEYWORD_TO_OEKO[keyword],
      });
    }
  }

  if (matches.length > 0) {
    // Remove subsumed matches (e.g. "stahl" inside "edelstahl")
    const nonSubsumed = matches.filter((m) => {
      return !matches.some(
        (other) =>
          other.len > m.len &&
          other.pos <= m.pos &&
          other.pos + other.len >= m.pos + m.len
      );
    });

    // Sort by keyword length descending (most specific first)
    nonSubsumed.sort((a, b) => b.len - a.len);

    // Flatten terms, deduplicated, preserving specificity order
    const seen = new Set<string>();
    const allTerms: string[] = [];
    for (const m of nonSubsumed) {
      for (const t of m.terms) {
        if (!seen.has(t)) {
          seen.add(t);
          allTerms.push(t);
        }
      }
    }
    return allTerms;
  }

  // Fallback: use the longest word (>= 3 chars) from the cleaned query
  const words = cleaned
    .split(/[\s\-_/,;()|]+/)
    .filter((w) => w.length >= 3);
  if (words.length > 0) {
    const longest = words.reduce((a, b) =>
      a.length >= b.length ? a : b
    );
    return [longest.charAt(0).toUpperCase() + longest.slice(1)];
  }

  return [query.trim().slice(0, 30)];
}

// ---------------------------------------------------------------------------
// 2b. KBOB Search-Term Extraction (uses SYNONYM_MAP for retrieval)
// ---------------------------------------------------------------------------

/**
 * Derive German search terms for KBOB SQL LIKE queries.
 *
 * The KBOB database stores material names in German. IFC files often use
 * English, Dutch, or French names. This function translates the query into
 * German search terms BEFORE the SQL query, using the same synonym map
 * used for scoring. Returns an array ordered most-specific → most-general.
 *
 * Also extracts raw words from the cleaned query as fallback terms,
 * since some abbreviations (XPS, EPS, EPDM) appear in KBOB names verbatim.
 */
export function extractKbobSearchTerms(query: string): string[] {
  const cleaned = cleanIfcQuery(query).toLowerCase();

  // Collect all synonym matches with position and length
  const matches: Array<{
    pos: number;
    len: number;
    keyword: string;
    terms: string[];
  }> = [];

  // Sort keys by length descending (most specific first)
  const keys = Object.keys(SYNONYM_MAP).sort(
    (a, b) => b.length - a.length
  );

  for (const keyword of keys) {
    const pos = cleaned.indexOf(keyword);
    if (pos !== -1) {
      matches.push({
        pos,
        len: keyword.length,
        keyword,
        terms: SYNONYM_MAP[keyword],
      });
    }
  }

  if (matches.length > 0) {
    // Remove subsumed matches (e.g. "stahl" inside "edelstahl")
    const nonSubsumed = matches.filter((m) => {
      return !matches.some(
        (other) =>
          other.len > m.len &&
          other.pos <= m.pos &&
          other.pos + other.len >= m.pos + m.len
      );
    });

    // Flatten terms, deduplicated, preserving specificity order
    const seen = new Set<string>();
    const allTerms: string[] = [];
    for (const m of nonSubsumed) {
      for (const t of m.terms) {
        if (!seen.has(t)) {
          seen.add(t);
          allTerms.push(t);
        }
      }
    }

    // Also add raw words from query (catches abbreviations like XPS, EPS, EPDM)
    const rawWords = cleaned
      .split(/[\s\-_/,;()|]+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.toUpperCase());
    for (const w of rawWords) {
      if (!seen.has(w)) {
        seen.add(w);
        allTerms.push(w);
      }
    }

    return allTerms;
  }

  // No synonym matches — try the Ökobaudat keyword map as fallback
  // (it has many of the same EN→DE mappings)
  const oekTerms = extractOekobaudatSearchTerms(query);
  if (oekTerms.length > 0 && oekTerms[0] !== query.trim().slice(0, 30)) {
    return oekTerms;
  }

  // Final fallback: individual words from cleaned query
  const words = cleaned
    .split(/[\s\-_/,;()|]+/)
    .filter((w) => w.length >= 3);
  if (words.length > 0) {
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  }

  return [query.trim()];
}

// ---------------------------------------------------------------------------
// Combined preprocessing pipeline
// ---------------------------------------------------------------------------

/** Full preprocessing: clean → expand with synonyms. */
export function preprocessQuery(query: string): string {
  const cleaned = cleanIfcQuery(query);
  return expandQueryWithSynonyms(cleaned);
}
