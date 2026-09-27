/*
 * Oddy-matcher: finder direkte match eller nærmeste materiale i en samling
 * af Oddy-testresultater. Ren logik uden DOM, så den kan testes i Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OddyMatcher = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Synonymer, så fx "PE", "polyethylene" og "polyethylen" regnes som det samme.
  const SYNONYMS = {
    pe: "polyethylen", polyethylene: "polyethylen", ldpe: "polyethylen", hdpe: "polyethylen",
    pp: "polypropylen", polypropylene: "polypropylen",
    pet: "polyester", pes: "polyester", polyethylenterephthalat: "polyester",
    pvc: "polyvinylchlorid", polyvinylchloride: "polyvinylchlorid", vinyl: "polyvinylchlorid",
    pvac: "polyvinylacetat", pva: "polyvinylacetat", polyvinylacetate: "polyvinylacetat", hvidlim: "polyvinylacetat",
    pu: "polyurethan", pur: "polyurethan", polyurethane: "polyurethan",
    pa: "polyamid", nylon: "polyamid", polyamide: "polyamid",
    pmma: "akryl", acrylic: "akryl", acryl: "akryl", akrylat: "akryl", acrylate: "akryl",
    ps: "polystyren", polystyrene: "polystyren", eps: "polystyren", flamingo: "polystyren",
    eva: "ethylenvinylacetat",
    silicone: "silikone", silikon: "silikone",
    wool: "uld", cotton: "bomuld", silk: "silke", linen: "hør", lin: "hør",
    felt: "filt", foam: "skum", adhesive: "lim", glue: "lim", klæber: "lim",
    paint: "maling", lacquer: "lak", varnish: "lak", sealant: "fugemasse",
    wood: "træ", mdf: "træfiberplade", plywood: "krydsfiner",
    paper: "papir", board: "karton", cardboard: "karton", pap: "karton",
    rubber: "gummi", latex: "gummi",
    polycarbonate: "polycarbonat", pc: "polycarbonat",
    epoxy: "epoxy", epoxi: "epoxy",
    waterbased: "vandbaseret", "water-based": "vandbaseret",
  };

  // Vægte for de felter der sammenlignes. Kun felter brugeren har udfyldt tæller.
  const WEIGHTS = {
    product: 0.30,
    manufacturer: 0.15,
    category: 0.20,
    composition: 0.25,
    keywords: 0.10,
  };

  const RATING_ORDER = { P: 0, T: 1, U: 2 };

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function canonicalToken(token) {
    // Synonymer er skrevet med danske bogstaver; normalisér dem ens.
    const hit = SYNONYM_LOOKUP[token];
    return hit || token;
  }

  const SYNONYM_LOOKUP = (function () {
    const map = {};
    Object.keys(SYNONYMS).forEach(function (k) {
      map[normalize(k).replace(/ /g, "")] = normalize(SYNONYMS[k]);
    });
    return map;
  })();

  function tokens(value) {
    const n = normalize(value);
    if (!n) return [];
    return n.split(" ").filter(Boolean).map(canonicalToken);
  }

  function tokenSet(value) {
    return new Set(tokens(value));
  }

  function trigrams(value) {
    const s = "  " + normalize(value) + " ";
    const grams = new Map();
    for (let i = 0; i < s.length - 2; i++) {
      const g = s.slice(i, i + 3);
      grams.set(g, (grams.get(g) || 0) + 1);
    }
    return grams;
  }

  // Dice-koefficient på trigrammer: 1 = identisk, 0 = intet til fælles.
  function stringSimilarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const ga = trigrams(na);
    const gb = trigrams(nb);
    let overlap = 0;
    let total = 0;
    ga.forEach(function (count, g) {
      total += count;
      if (gb.has(g)) overlap += Math.min(count, gb.get(g));
    });
    gb.forEach(function (count) { total += count; });
    return total ? (2 * overlap) / total : 0;
  }

  // Summen af bedste ord-match for hvert ord i a, med delvis kredit for næsten-ens ord.
  function matchedTokens(sa, sb) {
    let score = 0;
    sa.forEach(function (ta) {
      let best = 0;
      sb.forEach(function (tb) {
        if (ta === tb) best = 1;
        else if (best < 1) {
          const s = stringSimilarity(ta, tb);
          if (s >= 0.6 && s * 0.8 > best) best = s * 0.8;
        }
      });
      score += best;
    });
    return score;
  }

  // Symmetrisk ordlighed: gennemsnit af dækning begge veje.
  function tokenSimilarity(a, b) {
    const sa = tokenSet(a);
    const sb = tokenSet(b);
    if (!sa.size || !sb.size) return 0;
    const score = matchedTokens(sa, sb);
    return (score / sa.size + Math.min(1, score / sb.size)) / 2;
  }

  // Ensidig dækning: hvor stor en del af ordene i a findes i b.
  function tokenCoverage(a, b) {
    const sa = tokenSet(a);
    const sb = tokenSet(b);
    if (!sa.size || !sb.size) return 0;
    return matchedTokens(sa, sb) / sa.size;
  }

  function categorySimilarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    return tokenSimilarity(a, b) * 0.7;
  }

  function normalizeRating(value) {
    const v = normalize(value).toUpperCase();
    if (!v) return "";
    const c = v.charAt(0);
    if (c === "P") return "P";
    if (c === "T") return "T";
    if (c === "U" || c === "F") return "U";
    return "";
  }

  // Samlet vurdering = den dårligste af de tre metalkuponer, hvis ikke angivet.
  function overallRating(record) {
    const explicit = normalizeRating(record.overall);
    if (explicit) return explicit;
    const ratings = [record.silver, record.copper, record.lead]
      .map(normalizeRating)
      .filter(Boolean);
    if (!ratings.length) return "";
    return ratings.reduce(function (worst, r) {
      return RATING_ORDER[r] > RATING_ORDER[worst] ? r : worst;
    });
  }

  function hasValue(v) {
    return normalize(v).length > 0;
  }

  function isDirectMatch(query, record) {
    if (!hasValue(query.product) || !hasValue(record.product)) return false;
    if (normalize(query.product) !== normalize(record.product)) return false;
    if (hasValue(query.manufacturer) && hasValue(record.manufacturer)) {
      return normalize(query.manufacturer) === normalize(record.manufacturer);
    }
    return true;
  }

  function scoreRecord(query, record) {
    const parts = {
      product: hasValue(query.product)
        ? Math.max(stringSimilarity(query.product, record.product), stringSimilarity(query.product, record.name) * 0.9)
        : null,
      manufacturer: hasValue(query.manufacturer) ? stringSimilarity(query.manufacturer, record.manufacturer) : null,
      category: hasValue(query.category) ? categorySimilarity(query.category, record.category) : null,
      composition: hasValue(query.composition)
        ? Math.max(
            tokenSimilarity(query.composition, record.composition),
            tokenSimilarity(query.composition, record.name) * 0.8
          )
        : null,
      keywords: hasValue(query.keywords)
        ? tokenCoverage(query.keywords, [record.keywords, record.category, record.name, record.composition, record.notes].join(" "))
        : null,
    };

    let weightSum = 0;
    let total = 0;
    Object.keys(parts).forEach(function (key) {
      if (parts[key] === null) return;
      weightSum += WEIGHTS[key];
      total += WEIGHTS[key] * parts[key];
    });

    const direct = isDirectMatch(query, record);
    const score = direct ? 1 : weightSum ? total / weightSum : 0;
    return { record: record, score: score, direct: direct, parts: parts };
  }

  /*
   * Sammenlign et indtastet materiale med databasen.
   * Returnerer { direct: [...], nearest: [...] } sorteret efter score.
   */
  function findMatches(query, records, options) {
    const limit = (options && options.limit) || 5;
    // Under denne score er ligheden så svag, at den ikke er værd at vise.
    const minScore = options && options.minScore != null ? options.minScore : 0.15;
    const scored = records.map(function (r) { return scoreRecord(query, r); });
    const direct = scored.filter(function (s) { return s.direct; });
    const nearest = scored
      .filter(function (s) { return !s.direct && s.score > 0 && s.score >= minScore; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limit);
    return { direct: direct, nearest: nearest };
  }

  function confidenceLabel(score) {
    if (score >= 0.85) return { level: "hoej", text: "Meget tæt på" };
    if (score >= 0.6) return { level: "middel", text: "Beslægtet materiale" };
    if (score >= 0.35) return { level: "lav", text: "Svag lighed" };
    return { level: "meget-lav", text: "Kun fjern lighed" };
  }

  return {
    normalize: normalize,
    tokens: tokens,
    stringSimilarity: stringSimilarity,
    tokenSimilarity: tokenSimilarity,
    tokenCoverage: tokenCoverage,
    normalizeRating: normalizeRating,
    overallRating: overallRating,
    isDirectMatch: isDirectMatch,
    scoreRecord: scoreRecord,
    findMatches: findMatches,
    confidenceLabel: confidenceLabel,
    WEIGHTS: WEIGHTS,
  };
});
