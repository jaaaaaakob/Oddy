(function () {
  "use strict";

  const M = window.OddyMatcher;
  const D = window.OddyData;

  const STORE_RECORDS = "oddy.records.v1";
  const STORE_MINE = "oddy.mine.v1";

  const RATING_TEXT = { P: "Permanent", T: "Temporær", U: "Uegnet", "": "Ikke angivet" };
  const PART_LABELS = {
    product: "Produktnavn", manufacturer: "Producent", category: "Kategori",
    composition: "Sammensætning", keywords: "Nøgleord",
  };

  // ---------- Lagring ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert("Kunne ikke gemme i browseren. Data forsvinder, når siden lukkes.");
    }
  }

  const state = {
    records: load(STORE_RECORDS, null),
    mine: load(STORE_MINE, []),
    lastQuery: null,
  };

  if (!Array.isArray(state.records)) {
    state.records = sampleRecords();
    save(STORE_RECORDS, state.records);
  }

  function sampleRecords() {
    return (window.ODDY_EKSEMPELDATA || []).map(function (r) { return D.cleanRecord(r); });
  }

  function setRecords(records) {
    state.records = records;
    save(STORE_RECORDS, records);
    refreshAll();
  }

  function setMine(mine) {
    state.mine = mine;
    save(STORE_MINE, mine);
    renderMine();
  }

  // ---------- Hjælpere ----------

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function chip(rating, title) {
    const r = rating || "";
    return el("span", { class: "chip " + (r || "none"), title: title || RATING_TEXT[r], text: r || "–" });
  }

  function pct(score) {
    return Math.round(score * 100) + " %";
  }

  function formData(form) {
    const out = {};
    new FormData(form).forEach(function (v, k) { out[k] = String(v).trim(); });
    return out;
  }

  function fillForm(form, data) {
    Array.prototype.forEach.call(form.elements, function (field) {
      if (field.name && field.name in data) field.value = data[field.name] || "";
    });
  }

  function hasQuery(q) {
    return ["category", "composition", "manufacturer", "product", "keywords", "name"].some(function (k) {
      return q[k];
    });
  }

  // Beskrivelsesfeltet bruges som ekstra nøgleord, så det også påvirker søgningen.
  function toMatcherQuery(q) {
    return {
      product: q.product,
      manufacturer: q.manufacturer,
      category: q.category,
      composition: q.composition,
      keywords: [q.keywords, q.name].filter(Boolean).join(" "),
    };
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // ---------- Faner ----------

  function showTab(name) {
    $$(".tab").forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.tab === name)); });
    $$(".panel").forEach(function (p) { p.hidden = p.id !== "panel-" + name; });
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* file:// */ }
  }

  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () { showTab(t.dataset.tab); });
  });
  document.addEventListener("click", function (e) {
    const link = e.target.closest("[data-goto]");
    if (link) { e.preventDefault(); showTab(link.dataset.goto); }
  });

  // ---------- Tjek materiale ----------

  const queryForm = $("#query-form");
  const resultsBox = $("#results");

  queryForm.addEventListener("submit", function (e) {
    e.preventDefault();
    runQuery(formData(queryForm));
  });

  queryForm.addEventListener("reset", function () {
    state.lastQuery = null;
    setTimeout(function () {
      resultsBox.replaceChildren(el("div", { class: "empty" }, [el("p", { text: "Resultaterne vises her." })]));
    });
  });

  $("#save-query").addEventListener("click", function () {
    const q = formData(queryForm);
    if (!hasQuery(q)) {
      alert("Udfyld mindst ét felt, før du gemmer.");
      return;
    }
    const entry = Object.assign({ id: D.makeId(), savedAt: today() }, q);
    setMine(state.mine.concat([entry]));
    runQuery(q);
    flash($("#save-query"), "Gemt ✓");
  });

  function flash(button, text) {
    const original = button.textContent;
    button.textContent = text;
    button.disabled = true;
    setTimeout(function () { button.textContent = original; button.disabled = false; }, 1400);
  }

  function runQuery(q) {
    state.lastQuery = q;
    if (!hasQuery(q)) {
      resultsBox.replaceChildren(el("div", { class: "empty" }, [el("p", { text: "Udfyld mindst ét felt for at sammenligne." })]));
      return;
    }
    if (!state.records.length) {
      resultsBox.replaceChildren(el("div", { class: "empty" }, [
        el("p", { text: "Testdatabasen er tom." }),
        el("p", {}, [el("a", { href: "#", "data-goto": "import", text: "Importér testresultater" })]),
      ]));
      return;
    }

    const result = M.findMatches(toMatcherQuery(q), state.records, { limit: 5 });
    const nodes = [];

    if (result.direct.length) {
      nodes.push(el("div", { class: "verdict ok" }, [
        el("strong", { text: result.direct.length === 1 ? "Direkte match fundet" : result.direct.length + " direkte match fundet" }),
        el("span", { text: " – materialet er testet." }),
      ]));
      result.direct.forEach(function (m) { nodes.push(matchCard(m, "Direkte match")); });
      if (result.nearest.length) {
        nodes.push(el("h3", { class: "section-title", text: "Lignende testede materialer" }));
        result.nearest.slice(0, 3).forEach(function (m) { nodes.push(matchCard(m, "Lignende")); });
      }
    } else if (result.nearest.length) {
      const best = result.nearest[0];
      const weak = best.score < 0.35;
      nodes.push(el("div", { class: "verdict " + (weak ? "warn" : "info") }, [
        el("strong", { text: "Intet direkte match." }),
        el("span", {
          text: weak
            ? " Ingen testede materialer ligner rigtig meget. Overvej at teste materialet selv."
            : " Her er de testede materialer, der ligger tættest på.",
        }),
      ]));
      result.nearest.forEach(function (m, i) {
        nodes.push(matchCard(m, i === 0 ? "Nærmeste materiale" : "Nr. " + (i + 1)));
      });
      nodes.push(el("p", { class: "warning small", text: "Et nærmeste match er en indikation, ikke et testresultat for dit materiale." }));
    } else {
      nodes.push(el("div", { class: "verdict warn" }, [
        el("strong", { text: "Ingen sammenlignelige materialer." }),
        el("span", { text: " Prøv med sammensætning eller kategori, eller test materialet selv." }),
      ]));
    }

    resultsBox.replaceChildren.apply(resultsBox, nodes);
  }

  function matchCard(m, kind) {
    const r = m.record;
    const node = $("#match-template").content.firstElementChild.cloneNode(true);
    const overall = M.overallRating(r);

    $(".match-kind", node).textContent = kind;
    $(".match-name", node).textContent = r.name || r.product;
    $(".match-meta", node).textContent = [
      r.category,
      r.composition,
      [r.manufacturer, r.product].filter(Boolean).join(" "),
    ].filter(Boolean).join(" · ");

    const ov = $(".match-overall", node);
    ov.className = "match-overall rating-" + (overall || "none");
    ov.append(el("span", { class: "big", text: overall || "–" }), el("span", { text: RATING_TEXT[overall] }));

    $(".match-coupons", node).append(
      coupon("Sølv", r.silver), coupon("Kobber", r.copper), coupon("Bly", r.lead)
    );

    if (!m.direct) {
      const conf = M.confidenceLabel(m.score);
      $(".match-score", node).append(
        el("div", { class: "score-label" }, [
          el("span", { text: "Lighed " }),
          el("strong", { text: pct(m.score) }),
          el("span", { class: "conf conf-" + conf.level, text: conf.text }),
        ]),
        bar(m.score)
      );
      const parts = $(".match-parts", node);
      Object.keys(m.parts).forEach(function (k) {
        if (m.parts[k] === null) return;
        parts.append(el("div", {}, [el("dt", { text: PART_LABELS[k] }), el("dd", {}, [bar(m.parts[k], true), el("span", { text: pct(m.parts[k]) })])]));
      });
    } else {
      $(".match-score", node).remove();
      $(".match-parts", node).remove();
    }

    const notes = [r.notes, r.source && "Kilde: " + r.source, r.date && "Testet: " + r.date].filter(Boolean).join(" · ");
    if (notes) $(".match-notes", node).textContent = notes;
    else $(".match-notes", node).remove();
    return node;
  }

  function coupon(label, rating) {
    const r = M.normalizeRating(rating);
    return el("div", { class: "coupon" }, [chip(r), el("span", { text: label })]);
  }

  function bar(value, small) {
    const b = el("span", { class: "bar" + (small ? " small" : ""), role: "presentation" });
    const fill = el("span", { class: "bar-fill" });
    fill.style.width = Math.round(value * 100) + "%";
    b.appendChild(fill);
    return b;
  }

  // ---------- Mine materialer ----------

  function bestMatch(q) {
    const res = M.findMatches(toMatcherQuery(q), state.records, { limit: 1 });
    if (res.direct.length) return res.direct[0];
    return res.nearest[0] || null;
  }

  function renderMine() {
    const tbody = $("#mine-table tbody");
    tbody.replaceChildren();
    $("#mine-count").textContent = state.mine.length || "";
    $("#mine-empty").hidden = state.mine.length > 0;
    $("#mine-table").hidden = state.mine.length === 0;

    state.mine.forEach(function (q) {
      const m = bestMatch(q);
      const overall = m ? M.overallRating(m.record) : "";
      const title = q.name || [q.manufacturer, q.product].filter(Boolean).join(" ") || q.composition || "Uden navn";
      const sub = [q.category, q.composition, [q.manufacturer, q.product].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

      const show = el("button", { class: "btn small", text: "Vis" });
      show.addEventListener("click", function () {
        fillForm(queryForm, q);
        showTab("tjek");
        runQuery(q);
      });
      const del = el("button", { class: "btn small ghost", text: "Slet", "aria-label": "Slet " + title });
      del.addEventListener("click", function () {
        if (confirm("Slet \"" + title + "\" fra mine materialer?")) {
          setMine(state.mine.filter(function (x) { return x.id !== q.id; }));
        }
      });

      tbody.append(el("tr", {}, [
        el("td", {}, [el("strong", { text: title }), sub ? el("div", { class: "sub", text: sub }) : null]),
        el("td", {}, m ? [m.record.name || m.record.product, el("div", { class: "sub", text: m.direct ? "Direkte match" : "Nærmeste materiale" })] : ["–"]),
        el("td", { text: m ? (m.direct ? "100 %" : pct(m.score)) : "–" }),
        el("td", {}, [chip(overall)]),
        el("td", { class: "row-actions" }, [show, del]),
      ]));
    });
  }

  $("#export-mine").addEventListener("click", function () {
    const header = ["materiale", "kategori", "sammensaetning", "producent", "produkt", "noegleord", "noter", "gemt", "bedste_match", "match_type", "lighed_pct", "soelv", "kobber", "bly", "samlet"];
    const rows = state.mine.map(function (q) {
      const m = bestMatch(q);
      const r = m ? m.record : {};
      return [q.name, q.category, q.composition, q.manufacturer, q.product, q.keywords, q.notes, q.savedAt,
        r.name || "", m ? (m.direct ? "direkte" : "naermeste") : "", m ? Math.round(m.score * 100) : "",
        r.silver || "", r.copper || "", r.lead || "", m ? M.overallRating(r) : ""];
    });
    const csv = "﻿" + [header].concat(rows).map(function (row) {
      return row.map(function (v) {
        const s = String(v == null ? "" : v);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");
    download("mine-materialer-" + today() + ".csv", csv, "text/csv;charset=utf-8");
  });

  // ---------- Testdatabase ----------

  const recordForm = $("#record-form");
  const ratingSelects = ["silver", "copper", "lead", "overall"];

  ratingSelects.forEach(function (name) {
    const select = recordForm.elements[name];
    [["", name === "overall" ? "Beregn (dårligste)" : "–"], ["P", "P – Permanent"], ["T", "T – Temporær"], ["U", "U – Uegnet"]]
      .forEach(function (o) { select.append(el("option", { value: o[0], text: o[1] })); });
  });

  function openRecordForm(record) {
    recordForm.reset();
    recordForm.elements.id.value = "";
    $("#record-form-title").textContent = record ? "Redigér testresultat" : "Tilføj testresultat";
    if (record) fillForm(recordForm, record);
    recordForm.hidden = false;
    recordForm.elements.name.focus();
    recordForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#new-record").addEventListener("click", function () { openRecordForm(null); });
  $("#cancel-record").addEventListener("click", function () { recordForm.hidden = true; });

  recordForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = formData(recordForm);
    const rec = D.cleanRecord(data);
    if (data.id) {
      rec.id = data.id;
      setRecords(state.records.map(function (r) { return r.id === data.id ? rec : r; }));
    } else {
      rec.id = D.makeId();
      setRecords(state.records.concat([rec]));
    }
    recordForm.hidden = true;
  });

  $("#db-filter").addEventListener("input", renderDatabase);

  function renderDatabase() {
    const tbody = $("#db-table tbody");
    const filter = M.normalize($("#db-filter").value);
    tbody.replaceChildren();
    $("#db-count").textContent = state.records.length || "";
    $("#db-empty").hidden = state.records.length > 0;

    const rows = state.records
      .filter(function (r) {
        if (!filter) return true;
        return M.normalize([r.name, r.category, r.composition, r.manufacturer, r.product, r.keywords, r.source].join(" ")).indexOf(filter) >= 0;
      })
      .sort(function (a, b) {
        return (a.category || "").localeCompare(b.category || "", "da") || (a.name || "").localeCompare(b.name || "", "da");
      });

    rows.forEach(function (r) {
      const edit = el("button", { class: "btn small", text: "Redigér" });
      edit.addEventListener("click", function () { openRecordForm(r); });
      const del = el("button", { class: "btn small ghost", text: "Slet" });
      del.addEventListener("click", function () {
        if (confirm("Slet \"" + (r.name || r.product) + "\" fra testdatabasen?")) {
          setRecords(state.records.filter(function (x) { return x.id !== r.id; }));
        }
      });
      tbody.append(el("tr", {}, [
        el("td", {}, [el("strong", { text: r.name || r.product }), r.composition ? el("div", { class: "sub", text: r.composition }) : null]),
        el("td", { text: r.category || "–" }),
        el("td", { text: [r.manufacturer, r.product].filter(Boolean).join(" · ") || "–" }),
        el("td", { class: "coupons-cell" }, [chip(r.silver, "Sølv"), chip(r.copper, "Kobber"), chip(r.lead, "Bly")]),
        el("td", {}, [chip(M.overallRating(r))]),
        el("td", { class: "row-actions" }, [edit, del]),
      ]));
    });
  }

  function renderDatalists() {
    const lists = { "category-list": "category", "composition-list": "composition", "manufacturer-list": "manufacturer", "product-list": "product" };
    Object.keys(lists).forEach(function (id) {
      const values = Array.from(new Set(state.records.map(function (r) { return r[lists[id]]; }).filter(Boolean)))
        .sort(function (a, b) { return a.localeCompare(b, "da"); });
      $("#" + id).replaceChildren.apply($("#" + id), values.map(function (v) { return el("option", { value: v }); }));
    });
  }

  function renderBanner() {
    const hasSample = state.records.some(function (r) { return r.source === "Eksempeldata"; });
    $("#sample-banner").hidden = !hasSample;
  }

  // ---------- Import og eksport ----------

  $("#import-file").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const status = $("#import-status");
    const reader = new FileReader();
    reader.onload = function () {
      let result;
      try {
        const text = String(reader.result);
        const isJSON = /\.json$/i.test(file.name) || /^\s*[\[{]/.test(text);
        result = isJSON ? D.recordsFromJSON(text) : D.recordsFromCSV(text);
      } catch (err) {
        status.className = "status error";
        status.textContent = "Filen kunne ikke læses: " + err.message;
        return;
      }
      if (!result.records.length) {
        status.className = "status error";
        status.textContent = "Ingen poster fundet. Tjek at første række indeholder kolonnenavne som 'materiale' eller 'produkt'.";
        return;
      }
      const mode = ($("input[name=import-mode]:checked") || {}).value;
      if (mode === "replace" && !confirm("Erstat alle " + state.records.length + " poster med " + result.records.length + " nye?")) {
        e.target.value = "";
        return;
      }
      setRecords(mode === "replace" ? result.records : state.records.concat(result.records));
      const msgs = [result.records.length + " poster importeret."];
      if (result.skipped) msgs.push(result.skipped + " rækker uden materiale eller produkt blev sprunget over.");
      if (result.unknownHeaders.length) msgs.push("Ukendte kolonner ignoreret: " + result.unknownHeaders.join(", ") + ".");
      status.className = "status ok";
      status.textContent = msgs.join(" ");
      e.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  });

  $("#export-csv").addEventListener("click", function () {
    download("oddy-testresultater-" + today() + ".csv", D.recordsToCSV(state.records), "text/csv;charset=utf-8");
  });
  $("#export-json").addEventListener("click", function () {
    download("oddy-testresultater-" + today() + ".json", JSON.stringify(state.records, null, 2), "application/json");
  });
  $("#download-template").addEventListener("click", function () {
    download("oddy-skabelon.csv", D.recordsToCSV([]), "text/csv;charset=utf-8");
  });
  $("#load-sample").addEventListener("click", function () {
    const others = state.records.filter(function (r) { return r.source !== "Eksempeldata"; });
    setRecords(others.concat(sampleRecords()));
    $("#import-status").className = "status ok";
    $("#import-status").textContent = "Eksempeldata indlæst.";
  });
  $("#clear-db").addEventListener("click", function () {
    if (confirm("Slet alle " + state.records.length + " poster i testdatabasen? Eksportér først, hvis du vil beholde dem.")) {
      setRecords([]);
    }
  });

  // ---------- Start ----------

  function refreshAll() {
    renderDatabase();
    renderDatalists();
    renderBanner();
    renderMine();
    if (state.lastQuery) runQuery(state.lastQuery);
  }

  refreshAll();
  const initial = location.hash.replace("#", "");
  if (initial && $("#panel-" + initial)) showTab(initial);
})();
