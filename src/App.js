import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Wand2, TrendingUp, Info, Loader2, ChevronRight, Compass, Sparkles } from "lucide-react";

// ------------------------------
// Demo dataset (Malaysia‑centric)
// ------------------------------
const VEHICLE_DB = {
  "Perodua": ["Axia", "Bezza", "Myvi", "Aruz", "Alza", "Ativa"],
  "Proton": ["Saga", "Persona", "Iriz", "X50", "X70", "X90", "Exora", "Wira", "Waja", "Perdana"],
  "Toyota": ["Vios", "Yaris", "Corolla Altis", "Camry", "Hilux", "Avanza"],
  "Honda": ["City", "Civic", "HR-V", "CR-V", "Accord", "Jazz"],
  "Nissan": ["Almera", "X-Trail", "Serena"],
  "Mazda": ["Mazda 2", "Mazda 3", "CX-3", "CX-5", "CX-8"],
  "Mercedes-Benz": ["A 200", "C 200", "E 300", "E 63", "GLC 300"],
  "BMW": ["320i", "330i", "520i", "X1", "X3"],
  "Hyundai": ["Elantra", "Tucson", "Santa Fe", "Kona"],
  "Kia": ["Cerato", "Picanto", "Sportage", "Sorento"],
  "Volkswagen": ["Polo", "Jetta", "Golf", "Passat"],
};

// Common misspellings or shorthand → canonical form
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
  // Perodua
  myvee: "Myvi",
  myvy: "Myvi",
  beza: "Bezza",
  alzza: "Alza",
  // Proton
  segar: "Saga",
  personna: "Persona",
  x7o: "X70",
  // Toyota
  vious: "Vios",
  altis: "Corolla Altis",
  // Mercedes-Benz
  "e300 amg": "E 300",
  e300: "E 300",
  e63: "E 63",
  // Honda
  civc: "Civic",
  hrv: "HR-V",
  crv: "CR-V",
};

// ------------------------------
// Utilities
// ------------------------------
const nowYear = new Date().getFullYear();

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function normalizeText(s) {
  return (s || "").toString().trim().replace(/\s+/g, " ");
}

function leven(a = "", b = "") {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const d = leven(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - d / maxLen; // 0..1
}

function bestMatch(input, choices) {
  if (!input) return { match: "", score: 0 };
  const scores = choices.map(c => ({ c, s: similarity(input, c) }));
  scores.sort((x, y) => y.s - x.s);
  return { match: scores[0]?.c || "", score: scores[0]?.s || 0 };
}

function sanitizePlate(raw) {
  // Uppercase, strip spaces/hyphens, keep alphanumerics only
  const clean = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const readable = clean.replace(/([A-Z]+)(\d+)/, "$1 $2");
  return { clean, readable };
}

function validatePlate(raw) {
  const { clean, readable } = sanitizePlate(raw);
  // Malaysia plate heuristic: 1‑4 letters (prefix) + 1‑4 digits
  const ok = /^[A-Z]{1,4}[0-9]{1,4}$/.test(clean);
  // Confidence: higher if pattern matches and length is sensible
  let conf = 0.2;
  if (/^[A-Z]{1,4}/.test(clean)) conf += 0.2;
  if (/\d{1,4}$/.test(clean)) conf += 0.2;
  if (ok) conf = 0.95;
  conf = clamp(conf, 0, 0.98);
  return { ok, conf, clean, readable, message: ok ? "Looks valid." : "Plate should be 1‑4 letters followed by 1‑4 digits (e.g., WVY 1234)." };
}

function canonicalMake(input) {
  const t = input?.toLowerCase().replace(/\s|-/g, "") || "";
  return MAKE_SYNONYMS[t] || null;
}

function canonicalModel(input) {
  const t = input?.toLowerCase().trim() || "";
  return MODEL_SYNONYMS[t] || null;
}

function allModels() {
  return Object.values(VEHICLE_DB).flat();
}

function getModelsForMake(make) {
  return VEHICLE_DB[make] || [];
}

function validateYear(y) {
  const year = parseInt(y, 10);
  if (!y || Number.isNaN(year)) return { ok: false, conf: 0.2, message: "Enter a 4‑digit year (e.g., 2019)." };
  const minY = 1980;
  const maxY = nowYear;
  const ok = year >= minY && year <= maxY;
  const conf = ok ? 0.98 : 0.4;
  let message = ok ? "Looks valid." : `Year should be between ${minY} and ${maxY}.`;
  return { ok, conf, year, message };
}

// ------------------------------
// UI helpers
// ------------------------------
function Badge({ children, onClick, intent = "neutral" }) {
  const color = intent === "good" ? "bg-green-100 text-green-700 ring-green-200" : intent === "warn" ? "bg-amber-100 text-amber-700 ring-amber-200" : intent === "bad" ? "bg-rose-100 text-rose-700 ring-rose-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ring-1 ${color} hover:opacity-90 transition`}>{children}</button>
  );
}

function StatusLine({ ok, label, message }) {
  const Icon = ok ? CheckCircle : XCircle;
  const tone = ok ? "text-green-600" : "text-rose-600";
  return (
    <div className="flex items-start gap-2 py-2">
      <Icon className={`${tone}`} size={18} />
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

// ------------------------------
// Main Component
// ------------------------------
export default function SmartVehicleValidation() {
  const [plate, setPlate] = useState("wvy1234");
  const [make, setMake] = useState("perdua");
  const [model, setModel] = useState("myvee");
  const [year, setYear] = useState("2019");
  const [variant, setVariant] = useState("E300 AMG");
  const [accepted, setAccepted] = useState({ make: false, model: false, plate: false, year: false, variant: false });

  // Canonical + best matches
  const makeCanon = canonicalMake(make) || make;
  const makeChoices = Object.keys(VEHICLE_DB);
  const bestMake = useMemo(() => bestMatch(makeCanon, makeChoices), [makeCanon]);

  const modelCanon = canonicalModel(model) || model;
  const modelChoices = getModelsForMake(bestMake.match).length ? getModelsForMake(bestMake.match) : allModels();
  const bestModel = useMemo(() => bestMatch(modelCanon, modelChoices), [modelCanon, bestMake.match]);

  const plateVal = useMemo(() => validatePlate(plate), [plate]);
  const yearVal = useMemo(() => validateYear(year), [year]);

  // Confidence score weighted
  const confidence = useMemo(() => {
    const makeScore = bestMake.score || 0;
    const modelScore = bestModel.score || 0;
    const plateScore = plateVal.conf;
    const yearScore = yearVal.conf;
    const variantScore = variant?.length ? 0.8 : 0.4;
    return clamp((makeScore * 0.22) + (modelScore * 0.26) + (plateScore * 0.22) + (yearScore * 0.2) + (variantScore * 0.1), 0, 1);
  }, [bestMake, bestModel, plateVal, yearVal, variant]);

  const modelOk = (bestModel.score || 0) > 0.8;
  const makeOk = (bestMake.score || 0) > 0.85;

  const issues = [];
  if (!plateVal.ok) issues.push({ key: "plate", label: "Plate format", suggestion: plateVal.readable, action: () => { setPlate(plateVal.readable); setAccepted(s => ({ ...s, plate: true })); }, tone: "warn" });
  if (!makeOk) issues.push({ key: "make", label: "Brand looks off", suggestion: bestMake.match, action: () => { setMake(bestMake.match); setAccepted(s => ({ ...s, make: true })); }, tone: "bad" });
  if (!modelOk) issues.push({ key: "model", label: "Did you mean", suggestion: bestModel.match, action: () => { setModel(bestModel.match); setAccepted(s => ({ ...s, model: true })); }, tone: "warn" });
  if (!yearVal.ok) issues.push({ key: "year", label: "Year range", suggestion: `${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`, action: () => { setYear(`${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`); setAccepted(s => ({ ...s, year: true })); }, tone: "warn" });

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

  function applyExample(ex) {
    setPlate(ex.plate); setMake(ex.make); setModel(ex.model); setYear(ex.year); setVariant(ex.variant); setAccepted({ make: false, model: false, plate: false, year: false, variant: false });
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
            <span>Auto‑detects typos & suggests corrections in real‑time</span>
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
                onChange={e => setPlate(e.target.value)}
                placeholder="e.g., WVY 1234"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="mt-1 text-xs text-slate-500">Auto‑formats to <span className="font-mono">{sanitizePlate(plate).readable}</span></div>
            </div>

            {/* Make */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Brand</label>
              <input
                list="makes"
                value={make}
                onChange={e => setMake(e.target.value)}
                placeholder="e.g., Perodua"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="makes">
                {Object.keys(VEHICLE_DB).map(m => <option key={m} value={m} />)}
              </datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestMake.match}</span> ({(bestMake.score*100).toFixed(0)}%)</div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                list="models"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g., Myvi / X70 / Corolla Altis"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="models">
                {modelChoices.map(m => <option key={m} value={m} />)}
              </datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestModel.match}</span> ({(bestModel.score*100).toFixed(0)}%)</div>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Year of Manufacture</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
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
                onChange={e => setVariant(e.target.value)}
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
                    <Wand2 size={14} />
                    {it.label}: <span className="font-medium ml-1">{it.suggestion}</span>
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

        {/* Right: Output & Dev panel */}
        <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass size={18} className="text-cyan-600" />
            <h3 className="text-lg font-semibold">Normalized Payload (Mock)</h3>
          </div>
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-auto max-h-[360px]">
            <pre>{JSON.stringify(normalizedPayload, null, 2)}</pre>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 text-sm text-slate-700">
            <div className="font-semibold mb-1">Why this matters</div>
            <ul className="list-disc ml-5 space-y-1">
              <li>Prevents pricing errors and policy delays caused by typos.</li>
              <li>Improves quote accuracy with canonicalized brand/model.</li>
              <li>Flags out‑of‑range years and invalid plate formats instantly.</li>
            </ul>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Implementation Notes</div>
            <ul className="text-sm text-slate-600 space-y-1 list-disc ml-5">
              <li>Levenshtein similarity for fuzzy matching (make & model).</li>
              <li>Heuristic Malaysia plate pattern: <span className="font-mono">[A‑Z]{`{1,4}`}[0‑9]{`{1,4}`}</span>.</li>
              <li>Year validation against range 1980 – {nowYear}.</li>
              <li>All corrections are user‑approved via one‑click badges.</li>
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
