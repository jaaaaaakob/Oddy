const test = require("node:test");
const assert = require("node:assert");
const M = require("../js/matcher.js");
const D = require("../js/data.js");

global.window = {};
require("../data/eksempeldata.js");
const records = window.ODDY_EKSEMPELDATA.map((r) => D.cleanRecord(r));

test("direkte match ignorerer store bogstaver og tegnsætning", () => {
  const res = M.findMatches({ product: "eksempel pe-skum 30", manufacturer: "EKSEMPEL EMBALLAGE" }, records);
  assert.strictEqual(res.direct.length, 1);
  assert.strictEqual(res.direct[0].record.product, "Eksempel PE-skum 30");
});

test("forkert producent giver ikke direkte match", () => {
  const res = M.findMatches({ product: "Eksempel PE-skum 30", manufacturer: "Anden Fabrik" }, records);
  assert.strictEqual(res.direct.length, 0);
  assert.strictEqual(res.nearest[0].record.product, "Eksempel PE-skum 30");
});

test("synonymer: 'PE foam' finder polyethylenskum", () => {
  const res = M.findMatches({ composition: "PE", category: "Skum" }, records);
  assert.strictEqual(res.direct.length, 0);
  assert.match(res.nearest[0].record.name, /Polyethylen/);
});

test("nærmeste: neutral silikone foretrækkes frem for eddikehærdende", () => {
  const res = M.findMatches({ category: "Fugemasse", composition: "silicone neutral" }, records);
  assert.match(res.nearest[0].record.name, /neutral/);
});

test("stavevariant af produktnavn giver høj lighed", () => {
  const res = M.findMatches({ product: "Eksempel Hvidlim Std." }, records);
  assert.strictEqual(res.nearest[0].record.product, "Eksempel Hvidlim Standard");
  assert.ok(res.nearest[0].score > 0.6);
});

test("samlet vurdering er dårligste kupon", () => {
  assert.strictEqual(M.overallRating({ silver: "P", copper: "T", lead: "P" }), "T");
  assert.strictEqual(M.overallRating({ silver: "P", copper: "T", lead: "U" }), "U");
  assert.strictEqual(M.overallRating({ silver: "P", overall: "T" }), "T");
  assert.strictEqual(M.overallRating({}), "");
});

test("CSV med semikolon og engelske kolonner importeres", () => {
  const csv = 'Material;Manufacturer;Product;Silver;Copper;Lead\n"Felt; grey";ACME;F-100;pass;temp;fail\n;;;;;\n';
  const res = D.recordsFromCSV(csv);
  assert.strictEqual(res.records.length, 1);
  const r = res.records[0];
  assert.strictEqual(r.name, "Felt; grey");
  assert.deepStrictEqual([r.silver, r.copper, r.lead], ["P", "T", "U"]);
});

test("eksport og re-import giver samme data", () => {
  const csv = D.recordsToCSV(records);
  const back = D.recordsFromCSV(csv).records;
  assert.strictEqual(back.length, records.length);
  back.forEach((r, i) => {
    for (const f of D.FIELDS) assert.strictEqual(r[f], records[i][f], f);
  });
});

test("JSON med danske nøgler", () => {
  const res = D.recordsFromJSON('[{"materiale":"Test","soelv":"U","kobber":"P","bly":"P"}]');
  assert.strictEqual(res.records[0].silver, "U");
});
