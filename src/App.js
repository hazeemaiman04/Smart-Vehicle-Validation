// src/App.js
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Wand2, Info, ChevronRight, Compass, Sparkles, Upload } from "lucide-react";

// Demo dataset (Malaysia-centric)
const VEHICLE_DB = {
  Perodua: ["Axia", "Bezza", "Myvi", "Aruz", "Alza", "Ativa"],
  Proton: ["Saga", "Persona", "Iriz", "X50", "X70", "X90", "Exora", "Wira", "Waja", "Perdana"],
  Toyota: ["Vios", "Yaris", "Corolla Altis", "Camry", "Hilux", "Avanza"],
  Honda: ["City", "Civic", "HR-V", "CR-V", "Accord", "Jazz"],
  Nissan: ["Almera", "X-Trail", "Serena"],
  Mazda: ["Mazda 2", "Mazda 3", "CX-3", "CX-5", "CX-8"],
  "Mercedes-Benz": ["A 200", "C 200", "E 300", "E 63", "GLC 300"],
  BMW: ["320i", "330i", "520i", "X1", "X3"],
  Hyundai: ["Elantra", "Tucson", "Santa Fe", "Kona"],
  Kia: ["Cerato", "Picanto", "Sportage", "Sorento"],
  Volkswagen: ["Polo", "Jetta", "Golf", "Passat"],
};

const MAKE_SYNONYMS = {
  perodua: "Perodua",
  peroduo: "Perodua",
  proton: "Proton",
  toyyota: "Toyota",
  toyota: "Toyota",
  honda: "Honda",
  nissan: "Nissan",
  mazda: "Mazda",
  merc: "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  mercedesbenz: "Mercedes-Benz",
  bmw: "BMW",
  hyundai: "Hyundai",
  kia: "Kia",
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
};

const MODEL_SYNONYMS = {
  myvee: "Myvi",
  myvy: "Myvi",
  beza: "Bezza",
  alzza: "Alza",
  segar: "Saga",
  personna: "Persona",
  x7o: "X70",
  vious: "Vios",
  altis: "Corolla Altis",
  "e300 amg": "E 300",
  e300: "E 300",
  e63: "E 63",
  civc: "Civic",
  hrv: "HR-V",
  crv: "CR-V",
};

const nowYear = new Date().getFullYear();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const normalizeText = (s) => (s || "").toString().trim().replace(/\s+/g, " ");
const key = (s) => (s || "").toLowerCase().replace(/\s|-/g, "");

function leven(a = "", b = "") {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
const similarity = (a, b) => {
  const d = leven(a, b);
  const L = Math.max(a.length, b.length) || 1;
  return 1 - d / L;
};
const bestMatch = (input, choices) => {
  if (!input) return { match: "", score: 0 };
  const scores = choices.map((c) => ({ c, s: similarity(input, c) })).sort((x, y) => y.s - x.s);
  return { match: scores[0]?.c || "", score: scores[0]?.s || 0 };
};

function sanitizePlate(raw) {
  const clean = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const readable = clean.replace(/([A-Z]+)(\d+)/, "$1 $2");
  return { clean, readable };
}
function validatePlate(raw) {
  const { clean, readable } = sanitizePlate(raw);
  const ok = /^[A-Z]{1,4}[0-9]{1,4}$/.test(clean);
  let conf = 0.2;
  if (/^[A-Z]{1,4}/.test(clean)) conf += 0.2;
  if (/\d{1,4}$/.test(clean)) conf += 0.2;
  if (ok) conf = 0.95;
  return { ok, conf: clamp(conf, 0, 0.98), clean, readable, message: ok ? "Looks valid." : "Plate should be 1-4 letters followed by 1-4 digits (e.g., WVY 1234)." };
}
function canonicalMake(input, dynMakeSyn = {}) {
  const t = key(input);
  return dynMakeSyn[t] || MAKE_SYNONYMS[t] || null;
}
function canonicalModel(input, dynModelSyn = {}, brand = "") {
  const t = (input || "").toLowerCase().trim();
  const brandMap = dynModelSyn[brand] || {};
  return brandMap[key(input)] || MODEL_SYNONYMS[t] || null;
}
const allModels = () => Object.values(VEHICLE_DB).flat();
const getModelsForMake = (make) => VEHICLE_DB[make] || [];
function validateYear(y) {
  const year = parseInt(y, 10);
  if (!y || Number.isNaN(year)) return { ok: false, conf: 0.2, message: "Enter a 4-digit year (e.g., 2019)." };
  const minY = 1980, maxY = nowYear;
  const ok = year >= minY && year <= maxY;
  return { ok, conf: ok ? 0.98 : 0.4, year, message: ok ? "Looks valid." : `Year should be between ${minY} and ${maxY}.` };
}

// CSV parsing (local file)
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQ && next === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export default function SmartVehicleValidation() {
  // form
  const [plate, setPlate] = useState("wvy1234");
  const [make, setMake] = useState("perdua");
  const [model, setModel] = useState("myvee");
  const [year, setYear] = useState("2019");
  const [variant, setVariant] = useState("E300 AMG");
  const [accepted, setAccepted] = useState({ make: false, model: false, plate: false, year: false, variant: false });

  // dataset
  const [rows, setRows] = useState([]);
  const [loadingCSV, setLoadingCSV] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [dynMakeSyn, setDynMakeSyn] = useState({});
  const [dynModelSyn, setDynModelSyn] = useState({});
  const [metrics, setMetrics] = useState(null);

  // fuzzy with dynamic synonyms
  const makeCanon = canonicalMake(make, dynMakeSyn) || make;
  const makeChoices = Object.keys(VEHICLE_DB);
  const bestMake = useMemo(() => bestMatch(makeCanon, makeChoices), [makeCanon]);

  const modelCanon = canonicalModel(model, dynModelSyn, bestMake.match) || model;
  const modelChoices = getModelsForMake(bestMake.match).length ? getModelsForMake(bestMake.match) : allModels();
  const bestModel = useMemo(() => bestMatch(modelCanon, modelChoices), [modelCanon, bestMake.match]);

  const plateVal = useMemo(() => validatePlate(plate), [plate]);
  const yearVal = useMemo(() => validateYear(year), [year]);

  const confidence = useMemo(() => {
    const makeScore = bestMake.score || 0;
    const modelScore = bestModel.score || 0;
    const plateScore = plateVal.conf;
    const yearScore = yearVal.conf;
    const variantScore = variant?.length ? 0.8 : 0.4;
    return clamp(makeScore * 0.22 + modelScore * 0.26 + plateScore * 0.22 + yearScore * 0.2 + variantScore * 0.1, 0, 1);
  }, [bestMake, bestModel, plateVal, yearVal, variant]);

  const modelOk = (bestModel.score || 0) > 0.8;
  const makeOk = (bestMake.score || 0) > 0.85;

  const issues = [];
  if (!plateVal.ok) issues.push({ key: "plate", label: "Plate format", suggestion: plateVal.readable, action: () => { setPlate(plateVal.readable); setAccepted((s) => ({ ...s, plate: true })); }, tone: "warn" });
  if (!makeOk) issues.push({ key: "make", label: "Brand looks off", suggestion: bestMake.match, action: () => { setMake(bestMake.match); setAccepted((s) => ({ ...s, make: true })); }, tone: "bad" });
  if (!modelOk) issues.push({ key: "model", label: "Did you mean", suggestion: bestModel.match, action: () => { setModel(bestModel.match); setAccepted((s) => ({ ...s, model: true })); }, tone: "warn" });
  if (!yearVal.ok) issues.push({ key: "year", label: "Year range", suggestion: `${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`, action: () => { setYear(`${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`); setAccepted((s) => ({ ...s, year: true })); }, tone: "warn" });

  const formValid = plateVal.ok && makeOk && modelOk && yearVal.ok;

  const normalizedPayload = useMemo(() => {
    const { clean, readable } = sanitizePlate(plate);
    return {
      plate: { raw: plate, normalized: clean, display: readable },
      brand: bestMake.match,
      model: bestModel.match,
      year: Number(yearVal.year || year),
      variant: normalizeText(variant),
      confidence: Number(confidence.toFixed(3)),
      flags: {
        platePatternOk: plateVal.ok,
        brandAutoCorrected: accepted.make,
        modelAutoCorrected: accepted.model,
        yearAutoCorrected: accepted.year,
      },
    };
  }, [plate, bestMake, bestModel, yearVal, variant, confidence, accepted]);

  const exampleSets = [
    { plate: "wvy1234", make: "perdua", model: "myvee", year: "2019", variant: "1.5 AV" },
    { plate: "bml3301", make: "bmw", model: "330l", year: "2026", variant: "M Sport" },
    { plate: "qtr-88", make: "toyyota", model: "vious", year: "2014", variant: "TRD" },
    { plate: "jpb 7", make: "merc", model: "e300 amg", year: "2021", variant: "AMG Line" },
  ];
  const applyExample = (ex) => {
    setPlate(ex.plate); setMake(ex.make); setModel(ex.model); setYear(ex.year); setVariant(ex.variant);
    setAccepted({ make: false, model: false, plate: false, year: false, variant: false });
  };

  // CSV (local only)
  function onLocalCSVSelected(file) {
    if (!file) return;
    setCsvError("");
    setLoadingCSV(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result || ""));
        applyDataset(parsed);
      } catch (e) {
        setCsvError(`Failed to parse CSV — ${e.message}`);
      } finally {
        setLoadingCSV(false);
      }
    };
    reader.readAsText(file);
  }
  function applyDataset(parsedRows) {
    const cols = parsedRows[0] ? Object.keys(parsedRows[0]) : [];
    const need = [
      "user_input_plate",
      "user_input_brand",
      "user_input_model",
      "user_input_year",
      "expected_brand",
      "expected_model",
      "expected_year",
    ];
    const ok = need.every((c) => cols.includes(c));
    if (!ok) {
      setCsvError(`CSV missing required columns. Found: ${cols.join(", ")}`);
      setRows([]);
      setDynMakeSyn({});
      setDynModelSyn({});
      setMetrics(null);
      return;
    }
    setRows(parsedRows);

    // learn synonyms from dataset
    const makeMap = {};
    const modelMap = {};
    parsedRows.forEach((r) => {
      const ub = key(r.user_input_brand);
      const eb = (r.expected_brand || "").trim();
      if (ub && eb) makeMap[ub] = eb;

      const emake = eb;
      const um = key(r.user_input_model);
      const em = (r.expected_model || "").trim();
      if (emake && um && em) {
        if (!modelMap[emake]) modelMap[emake] = {};
        modelMap[emake][um] = em;
      }
    });
    setDynMakeSyn(makeMap);
    setDynModelSyn(modelMap);
    setMetrics(null);
  }
  function evaluateAgainstDataset() {
    if (!rows.length) return setMetrics(null);
    let correctMake = 0, correctModel = 0, correctYear = 0;
    const total = rows.length;

    rows.forEach((r) => {
      const _make = r.user_input_brand || "";
      const _model = r.user_input_model || "";
      const _year = String(r.user_input_year || "");

      const makeCanonSim = canonicalMake(_make, dynMakeSyn) || _make;
      const candidateMake = bestMatch(makeCanonSim, Object.keys(VEHICLE_DB)).match;

      const modelCanonSim = canonicalModel(_model, dynModelSyn, candidateMake) || _model;
      const candidateModel = bestMatch(
        modelCanonSim,
        VEHICLE_DB[candidateMake] || allModels()
      ).match;

      const yearStat = validateYear(_year);

      if (candidateMake === (r.expected_brand || "")) correctMake++;
      if (candidateModel === (r.expected_model || "")) correctModel++;
      if (String(yearStat.year || "") === String(r.expected_year || "")) correctYear++;
    });

    setMetrics({ total, makeAcc: correctMake / total, modelAcc: correctModel / total, yearAcc: correctYear / total });
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Smart Vehicle Data Validation</div>
              <div className="text-xs text-slate-500">BJAK – Frontend Demo (React)</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
            <Info size={14} />
            <span>Auto-detects typos & suggests corrections in real-time</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        {/* Left: Form */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Wand2 size={18} className="text-amber-600" />
            <h2 className="text-lg font-semibold">Enter Vehicle Details</h2>
          </div>

          {/* CSV controls (local only) */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-sm">
              <Upload size={16} />
              <span>Load CSV (local)</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => onLocalCSVSelected(e.target.files?.[0])} />
            </label>
            {loadingCSV && <span className="text-xs text-slate-500">Loading…</span>}
            {!!rows.length && <span className="text-xs text-slate-600">Rows loaded: <b>{rows.length}</b></span>}
            {csvError && <span className="text-xs text-rose-600">{csvError}</span>}
          </div>

          {/* Quick examples */}
          <div className="flex flex-wrap gap-2 mb-5">
            {exampleSets.map((ex, i) => (
              <Badge key={i} intent="neutral" onClick={() => applyExample(ex)}>
                Try example {i + 1}
              </Badge>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Plate */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Plate Number</label>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="e.g., WVY 1234"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="mt-1 text-xs text-slate-500">Auto-formats to <span className="font-mono">{sanitizePlate(plate).readable}</span></div>
            </div>

            {/* Make */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Brand</label>
              <input
                list="makes"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g., Perodua"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="makes">{Object.keys(VEHICLE_DB).map((m) => <option key={m} value={m} />)}</datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestMake.match}</span> ({(bestMake.score * 100).toFixed(0)}%)</div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                list="models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., Myvi / X70 / Corolla Altis"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="models">{modelChoices.map((m) => <option key={m} value={m} />)}</datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestModel.match}</span> ({(bestModel.score * 100).toFixed(0)}%)</div>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Year of Manufacture</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={`${nowYear}`}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="mt-1 text-xs text-slate-500">Allowed range: 1980 – {nowYear}</div>
            </div>

            {/* Variant */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Variant / Trim (optional)</label>
              <input
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="e.g., 1.5 AV, AMG Line, M Sport"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="mt-1 text-xs text-slate-500">Enter any known trim to improve pricing accuracy</div>
            </div>
          </div>

          {/* Smart suggestions */}
          {issues.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <div className="text-sm font-semibold">Smart Suggestions</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {issues.map((it) => (
                  <Badge key={it.key} intent={it.tone} onClick={it.action}>
                    <Wand2 size={14} /> {it.label}: <span className="font-medium ml-1">{it.suggestion}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Validation Confidence</div>
              <div className="text-xs text-slate-600">{Math.round(confidence * 100)}%</div>
            </div>
            <Progress value={confidence} />
            <div className="mt-2 text-xs text-slate-500">We compute confidence from plate pattern, brand/model similarity and year plausibility. Higher is better.</div>
          </div>

          {/* Checks */}
          <div className="mt-6 grid sm:grid-cols-2 gap-2">
            <StatusLine ok={plateVal.ok} label="Plate number" message={plateVal.message} />
            <StatusLine ok={makeOk} label="Brand" message={makeOk ? `Looks like “${bestMake.match}”` : `Did you mean “${bestMake.match}”?`}/>
            <StatusLine ok={modelOk} label="Model" message={modelOk ? `Looks like “${bestModel.match}”` : `Did you mean “${bestModel.match}”?`}/>
            <StatusLine ok={yearVal.ok} label="Year" message={yearVal.message} />
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center gap-3">
            <button
              disabled={!formValid}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white ${formValid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"}`}
              onClick={() => alert("Submitted! (Demo)")}
            >
              <ChevronRight size={18} /> Validate & Continue
            </button>
            <div className="text-xs text-slate-500">Submission is enabled when all checks pass.</div>
          </div>
        </motion.section>

        {/* Right: Output & Dataset panel */}
        <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass size={18} className="text-cyan-600" />
            <h3 className="text-lg font-semibold">Result</h3>
          </div>
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-auto max-h-[320px]">
            <pre>{JSON.stringify(normalizedPayload, null, 2)}</pre>
          </div>

          {/* Dataset controls */}
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Dataset</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={evaluateAgainstDataset}
                disabled={!rows.length}
                className={`px-3 py-1.5 rounded-lg text-sm ${rows.length ? "bg-cyan-600 text-white hover:bg-cyan-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
              >
                Evaluate against dataset
              </button>
              <span className="text-xs text-slate-600">Rows: <b>{rows.length}</b></span>
              {csvError && <span className="text-xs text-rose-600">{csvError}</span>}
            </div>

            {metrics && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="font-semibold">Make</div>
                  <div>{Math.round(metrics.makeAcc * 100)}%</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="font-semibold">Model</div>
                  <div>{Math.round(metrics.modelAcc * 100)}%</div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="font-semibold">Year</div>
                  <div>{Math.round(metrics.yearAcc * 100)}%</div>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold mb-1">Preview (first 5)</div>
                <div className="border border-slate-200 rounded-lg overflow-auto max-h-[220px]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-1 text-left">user_input_plate</th>
                        <th className="px-2 py-1 text-left">user_input_brand</th>
                        <th className="px-2 py-1 text-left">user_input_model</th>
                        <th className="px-2 py-1 text-left">user_input_year</th>
                        <th className="px-2 py-1 text-left">expected_brand</th>
                        <th className="px-2 py-1 text-left">expected_model</th>
                        <th className="px-2 py-1 text-left">expected_year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="odd:bg-white even:bg-slate-50">
                          <td className="px-2 py-1 font-mono">{r.user_input_plate}</td>
                          <td className="px-2 py-1">{r.user_input_brand}</td>
                          <td className="px-2 py-1">{r.user_input_model}</td>
                          <td className="px-2 py-1">{r.user_input_year}</td>
                          <td className="px-2 py-1">{r.expected_brand}</td>
                          <td className="px-2 py-1">{r.expected_model}</td>
                          <td className="px-2 py-1">{r.expected_year}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 text-sm text-slate-700">
            <div className="font-semibold mb-1">Why this matters</div>
            <ul className="list-disc ml-5 space-y-1">
              <li>Prevents pricing errors and policy delays caused by typos.</li>
              <li> Improves quote accuracy with canonicalized brand/model.</li>
              <li>Flags out-of-range years and invalid plate formats instantly.</li>
            </ul>
          </div>
        </motion.aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 pb-10 text-xs text-slate-500">
        <div className="pt-4">This is a frontend demo only. Hook the payload to your backend for real vehicle profile lookups (e.g., JPJ/insurance partner APIs) and stronger rules.</div>
      </footer>
    </div>
  );
}

function Badge({ children, onClick, intent = "neutral" }) {
  const color =
    intent === "good"
      ? "bg-green-100 text-green-700 ring-green-200"
      : intent === "warn"
      ? "bg-amber-100 text-amber-700 ring-amber-200"
      : intent === "bad"
      ? "bg-rose-100 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ring-1 ${color} hover:opacity-90 transition`}>
      {children}
    </button>
  );
}
function StatusLine({ ok, label, message }) {
  const Icon = ok ? CheckCircle : XCircle;
  const tone = ok ? "text-green-600" : "text-rose-600";
  return (
    <div className="flex items-start gap-2 py-2">
      <Icon className={tone} size={18} />
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-600">{message}</div>
      </div>
    </div>
  );
}
function Progress({ value }) {
  const v = clamp(value, 0, 1);
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
