/*
 * Import/eksport af Oddy-testresultater (CSV og JSON).
 * Ren logik uden DOM, så den kan testes i Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./matcher.js"));
  } else {
    root.OddyData = factory(root.OddyMatcher);
  }
})(typeof self !== "undefined" ? self : this, function (Matcher) {
  "use strict";

  const FIELDS = [
    "name", "category", "composition", "manufacturer", "product",
    "silver", "copper", "lead", "overall", "source", "date", "notes", "keywords",
  ];

  // Danske kolonnenavne bruges ved eksport.
  const DANISH_HEADERS = {
    name: "materiale", category: "kategori", composition: "sammensaetning",
    manufacturer: "producent", product: "produkt", silver: "soelv", copper: "kobber",
    lead: "bly", overall: "samlet", source: "kilde", date: "dato", notes: "noter",
    keywords: "noegleord",
  };

  // Kolonnenavne der genkendes ved import (danske og engelske varianter).
  const HEADER_ALIASES = {
    name: ["materiale", "material", "name", "navn", "beskrivelse", "description", "material description"],
    category: ["kategori", "category", "type", "materialetype", "material type", "gruppe"],
    composition: ["sammensaetning", "composition", "materialesammensaetning", "polymer", "indhold", "base"],
    manufacturer: ["producent", "manufacturer", "fabrikant", "leverandoer", "supplier", "brand", "maerke"],
    product: ["produkt", "product", "produktnavn", "product name", "handelsnavn", "trade name"],
    silver: ["soelv", "solv", "silver", "ag"],
    copper: ["kobber", "copper", "cu"],
    lead: ["bly", "lead", "pb"],
    overall: ["samlet", "overall", "resultat", "result", "rating", "vurdering", "samlet vurdering"],
    source: ["kilde", "source", "institution", "tester", "testet af", "tested by", "laboratorie"],
    date: ["dato", "date", "testdato", "test date", "aar", "year"],
    notes: ["noter", "notes", "bemaerkninger", "kommentar", "comments", "remarks"],
    keywords: ["noegleord", "keywords", "tags", "anvendelse", "use"],
  };

  const ALIAS_LOOKUP = (function () {
    const map = {};
    Object.keys(HEADER_ALIASES).forEach(function (field) {
      HEADER_ALIASES[field].forEach(function (alias) {
        map[Matcher.normalize(alias)] = field;
      });
    });
    return map;
  })();

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/)[0] || "";
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch in counts) counts[ch]++;
    }
    return Object.keys(counts).reduce(function (a, b) { return counts[b] > counts[a] ? b : a; });
  }

  function parseCSV(text, delimiter) {
    text = text.replace(/^﻿/, "");
    const delim = delimiter || detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field); field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
  }

  function cleanRecord(raw) {
    const rec = {};
    FIELDS.forEach(function (f) { rec[f] = raw[f] == null ? "" : String(raw[f]).trim(); });
    ["silver", "copper", "lead", "overall"].forEach(function (f) {
      rec[f] = Matcher.normalizeRating(rec[f]);
    });
    if (!rec.name) rec.name = [rec.product, rec.composition].filter(Boolean).join(" – ");
    rec.id = raw.id || makeId();
    return rec;
  }

  function makeId() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Returnerer { records, unknownHeaders, skipped }
  function recordsFromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return { records: [], unknownHeaders: [], skipped: 0 };
    const header = rows[0].map(function (h) { return ALIAS_LOOKUP[Matcher.normalize(h)] || null; });
    const unknownHeaders = rows[0].filter(function (h, i) { return !header[i] && h.trim(); });
    const records = [];
    let skipped = 0;
    rows.slice(1).forEach(function (cells) {
      const raw = {};
      header.forEach(function (field, i) { if (field) raw[field] = cells[i]; });
      const rec = cleanRecord(raw);
      if (!rec.name && !rec.product) { skipped++; return; }
      records.push(rec);
    });
    return { records: records, unknownHeaders: unknownHeaders, skipped: skipped };
  }

  function recordsFromJSON(text) {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed.records || [];
    const records = [];
    let skipped = 0;
    list.forEach(function (item) {
      // Tillad også danske nøgler i JSON.
      const raw = {};
      Object.keys(item).forEach(function (k) {
        const field = FIELDS.indexOf(k) >= 0 ? k : ALIAS_LOOKUP[Matcher.normalize(k)];
        if (field) raw[field] = item[k];
      });
      if (item.id) raw.id = item.id;
      const rec = cleanRecord(raw);
      if (!rec.name && !rec.product) { skipped++; return; }
      records.push(rec);
    });
    return { records: records, unknownHeaders: [], skipped: skipped };
  }

  function csvEscape(value) {
    const s = String(value == null ? "" : value);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Semikolon som separator, så filen åbner pænt i dansk Excel.
  function recordsToCSV(records) {
    const lines = [FIELDS.map(function (f) { return DANISH_HEADERS[f]; }).join(";")];
    records.forEach(function (r) {
      lines.push(FIELDS.map(function (f) { return csvEscape(r[f]); }).join(";"));
    });
    return "﻿" + lines.join("\r\n") + "\r\n";
  }

  return {
    FIELDS: FIELDS,
    parseCSV: parseCSV,
    recordsFromCSV: recordsFromCSV,
    recordsFromJSON: recordsFromJSON,
    recordsToCSV: recordsToCSV,
    cleanRecord: cleanRecord,
    makeId: makeId,
  };
});
