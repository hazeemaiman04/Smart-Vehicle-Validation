import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, AlertTriangle, Wand2, Info,
  ChevronRight, Compass, Sparkles, Check, Undo2, CheckCheck
} from "lucide-react";

// ------------------------------
// Demo dataset (Malaysia-centric)
// ------------------------------
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

// Common misspellings or shorthand → canonical form
const MAKE_SYNONYMS = {
  perodua: "Perodua", peroduo: "Perodua", proton: "Proton",
  toyyota: "Toyota", toyota: "Toyota", honda: "Honda",
  nissan: "Nissan", mazda: "Mazda", merc: "Mercedes-Benz",
  mercedes: "Mercedes-Benz", mercedesbenz: "Mercedes-Benz",
  bmw: "BMW", hyundai: "Hyundai", kia: "Kia",
  vw: "Volkswagen", volkswagen: "Volkswagen",
};

const MODEL_SYNONYMS = {
  myvee: "Myvi", myvy: "Myvi", beza: "Bezza", alzza: "Alza",
  segar: "Saga", personna: "Persona", x7o: "X70",
  vious: "Vios", altis: "Corolla Altis",
  "e300 amg": "E 300", e300: "E 300", e63: "E 63",
  civc: "Civic", hrv: "HR-V", crv: "CR-V",
};

// ------------------------------
// Utilities
// ------------------------------
const nowYear = new Date().getFullYear();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const normalizeText = (s) => (s || "").toString().trim().replace(/\s+/g, " ");

function leven(a = "", b = "") {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
  }
  return dp[m][n];
}
const similarity = (a, b) => {
  const d = leven(a, b); const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - d / maxLen;
};
const bestMatch = (input, choices) => {
  if (!input) return { match: "", score: 0 };
  const scores = choices.map(c => ({ c, s: similarity(input, c) })).sort((x, y) => y.s - x.s);
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
  return { ok, conf: clamp(conf, 0, 0.98), clean, readable,
    message: ok ? "Looks valid." : "Plate should be 1-4 letters followed by 1-4 digits (e.g., WVY 1234)." };
}
const canonicalMake  = (input) => MAKE_SYNONYMS[input?.toLowerCase().replace(/\s|-/g, "") || ""] || null;
const canonicalModel = (input) => MODEL_SYNONYMS[input?.toLowerCase().trim() || ""] || null;
const allModels = () => Object.values(VEHICLE_DB).flat();
const getModelsForMake = (make) => VEHICLE_DB[make] || [];
function validateYear(y) {
  const year = parseInt(y, 10);
  if (!y || Number.isNaN(year)) return { ok: false, conf: 0.2, message: "Enter a 4-digit year (e.g., 2019)." };
  const minY = 1980, maxY = nowYear;
  const ok = year >= minY && year <= maxY;
  return { ok, conf: ok ? 0.98 : 0.4, year, message: ok ? "Looks valid." : `Year should be between ${minY} and ${maxY}.` };
}

// ------------------------------
// Palettes (colour themes)
// ------------------------------
const PALETTES = {
  aurora:  { name: "Aurora",  grad: "from-emerald-500 to-cyan-500", ring: "ring-emerald-300", soft: "from-emerald-50 to-cyan-50",  color: "#10b981" },
  sunset:  { name: "Sunset",  grad: "from-rose-500 to-orange-500",  ring: "ring-rose-300",    soft: "from-rose-50 to-orange-50", color: "#f43f5e" },
  galaxy:  { name: "Galaxy",  grad: "from-indigo-500 to-fuchsia-500", ring: "ring-indigo-300", soft: "from-indigo-50 to-fuchsia-50", color: "#6366f1" },
  lagoon:  { name: "Lagoon",  grad: "from-teal-500 to-lime-500",     ring: "ring-teal-300",   soft: "from-teal-50 to-lime-50",   color: "#14b8a6" },
};

// ------------------------------
// UI helpers
// ------------------------------
function Badge({ children, onClick, intent = "neutral" }) {
  const color =
    intent === "good" ? "bg-green-100 text-green-700 ring-green-200" :
    intent === "warn" ? "bg-amber-100 text-amber-700 ring-amber-200" :
    intent === "bad"  ? "bg-rose-100 text-rose-700 ring-rose-200" :
                        "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ring-1 ${color} hover:translate-y-[-1px] hover:shadow transition`}>
      {children}
    </button>
  );
}
function StatusLine({ ok, label, message }) {
  const Icon = ok ? CheckCircle : XCircle;
  const tone = ok ? "text-green-600" : "text-rose-600";
  return (
    <motion.div layout className="flex items-start gap-2 py-2">
      <Icon className={tone} size={18} />
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-600">{message}</div>
      </div>
    </motion.div>
  );
}
function Progress({ value, palette="aurora" }) {
  const v = clamp(value, 0, 1);
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${PALETTES[palette].grad}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}
// Donut confidence ring
function Donut({ value, size = 120, palette="aurora" }) {
  const v = clamp(value, 0, 1);
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size/2} cy={size/2} r={r} stroke="#e2e8f0" strokeWidth="12" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} strokeWidth="12" fill="none"
              stroke={PALETTES[palette].color} style={{ strokeDasharray: `${dash} ${c-dash}`, strokeLinecap: "round" }}
              transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="font-bold fill-slate-700">
        {Math.round(v*100)}%
      </text>
    </svg>
  );
}
// Confetti burst (emoji-based, lightweight)
function ConfettiBurst({ show }) {
  const particles = Array.from({ length: 14 }, (_, i) => i);
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map(i => (
            <motion.span key={i}
              initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              animate={{ opacity: 0, x: (Math.random()-0.5)*400, y: -Math.random()*300 - 80, rotate: Math.random()*360 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2">🎉</motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
// Toast
function Toast({ open, title, description, onClose, icon = <Check size={16}/> }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg bg-white border border-slate-200 min-w-[260px]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600">{icon}</div>
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-slate-600">{description}</div>
            </div>
            <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
              <XCircle size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------
// Main Component
// ------------------------------
export default function SmartVehicleValidation() {
  const [palette, setPalette] = useState("aurora");
  const [autoFix, setAutoFix] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState({ open:false, title:"", desc:"" });

  const [plate, setPlate] = useState("wvy1234");
  const [make, setMake] = useState("perdua");
  const [model, setModel] = useState("myvee");
  const [year, setYear] = useState("2019");
  const [variant, setVariant] = useState("E300 AMG");
  const [accepted, setAccepted] = useState({ make:false, model:false, plate:false, year:false, variant:false });

  // Canonical + best matches
  const makeCanon = canonicalMake(make) || make;
  const makeChoices = Object.keys(VEHICLE_DB);
  const bestMake = useMemo(() => bestMatch(makeCanon, makeChoices), [makeCanon]);

  const modelCanon = canonicalModel(model) || model;
  const modelChoices = getModelsForMake(bestMake.match).length ? getModelsForMake(bestMake.match) : allModels();
  const bestModel = useMemo(() => bestMatch(modelCanon, modelChoices), [modelCanon, bestMake.match]);

  const plateVal = useMemo(() => validatePlate(plate), [plate]);
  const yearVal  = useMemo(() => validateYear(year), [year]);

  // Confidence score weighted
  const confidence = useMemo(() => {
    const makeScore = bestMake.score || 0;
    const modelScore = bestModel.score || 0;
    const plateScore = plateVal.conf;
    const yearScore  = yearVal.conf;
    const variantScore = variant?.length ? 0.8 : 0.4;
    return clamp(makeScore*0.22 + modelScore*0.26 + plateScore*0.22 + yearScore*0.2 + variantScore*0.1, 0, 1);
  }, [bestMake, bestModel, plateVal, yearVal, variant]);

  const modelOk = (bestModel.score || 0) > 0.8;
  const makeOk  = (bestMake.score  || 0) > 0.85;

  // Issues & actions
  const issues = [];
  if (!plateVal.ok) issues.push({
    key:"plate", label:"Plate format", suggestion:sanitizePlate(plate).readable, tone:"warn",
    action: () => { setPlate(sanitizePlate(plate).readable); setAccepted(s=>({...s,plate:true}));
      setToast({ open:true, title:"Plate normalized", desc:"We reformatted your plate for readability." }); }
  });
  if (!makeOk) issues.push({
    key:"make", label:"Make looks off", suggestion:bestMake.match, tone:"bad",
    action: () => { setMake(bestMake.match); setAccepted(s=>({...s,make:true}));
      setToast({ open:true, title:"Make corrected", desc:`Changed to "${bestMake.match}".` }); }
  });
  if (!modelOk) issues.push({
    key:"model", label:"Did you mean", suggestion:bestModel.match, tone:"warn",
    action: () => { setModel(bestModel.match); setAccepted(s=>({...s,model:true}));
      setToast({ open:true, title:"Model corrected", desc:`Changed to "${bestModel.match}".` }); }
  });
  if (!yearVal.ok) issues.push({
    key:"year", label:"Year range", suggestion:`${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`, tone:"warn",
    action: () => { setYear(`${clamp(parseInt(year || nowYear, 10) || nowYear, 1980, nowYear)}`); setAccepted(s=>({...s,year:true}));
      setToast({ open:true, title:"Year adjusted", desc:"Set to valid range." }); }
  });

  const formValid = plateVal.ok && makeOk && modelOk && yearVal.ok;

  // Auto-fix obvious high-confidence suggestions
  useEffect(() => {
    if (!autoFix) return;
    if (!makeOk  && bestMake.score  > 0.92) setMake(bestMake.match);
    if (!modelOk && bestModel.score > 0.92) setModel(bestModel.match);
    if (!plateVal.ok && sanitizePlate(plate).clean.length >= 2) setPlate(sanitizePlate(plate).readable);
  }, [autoFix, bestMake, bestModel, makeOk, modelOk, plateVal.ok, plate]);

  const normalizedPayload = useMemo(() => {
    const { clean, readable } = sanitizePlate(plate);
    return {
      plate: { raw: plate, normalized: clean, display: readable },
      make: bestMake.match, model: bestModel.match, year: Number(yearVal.year || year),
      variant: normalizeText(variant), confidence: Number(confidence.toFixed(3)),
      flags: {
        platePatternOk: plateVal.ok,
        makeAutoCorrected: accepted.make,
        modelAutoCorrected: accepted.model,
        yearAutoCorrected: accepted.year,
      },
    };
  }, [plate, bestMake, bestModel, yearVal, year, variant, confidence, accepted]);

  const exampleSets = [
    { plate:"wvy1234", make:"perdua",  model:"myvee",     year:"2019", variant:"1.5 AV" },
    { plate:"bml3301", make:"bmw",     model:"330l",      year:"2026", variant:"M Sport" },
    { plate:"qtr-88",  make:"toyyota", model:"vious",     year:"2014", variant:"TRD" },
    { plate:"jpb 7",   make:"merc",    model:"e300 amg",  year:"2021", variant:"AMG Line" },
  ];
  const applyExample = (ex) => {
    setPlate(ex.plate); setMake(ex.make); setModel(ex.model); setYear(ex.year); setVariant(ex.variant);
    setAccepted({ make:false, model:false, plate:false, year:false, variant:false });
    setToast({ open:true, title:"Loaded example", desc:"Play with the fields and see suggestions." });
  };
  const applyAllFixes = () => issues.forEach(it => it.action());
  const handleSubmit  = () => {
    if (!formValid) return;
    setShowConfetti(true);
    setToast({ open:true, title:"Validated!", desc:"All checks passed. Proceeding to quote." });
    setTimeout(() => setShowConfetti(false), 1500);
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* make sure Tailwind keeps these dynamic classes */}
      <div className="hidden from-emerald-500 to-cyan-500 from-rose-500 to-orange-500 from-indigo-500 to-fuchsia-500 from-teal-500 to-lime-500 ring-emerald-300 ring-rose-300 ring-indigo-300 ring-teal-300" />
      <ConfettiBurst show={showConfetti} />
      <Toast open={toast.open} title={toast.title} description={toast.desc} onClose={() => setToast(t=>({ ...t, open:false }))} />

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${PALETTES[palette].grad} flex items-center justify-center shadow`}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Smart Vehicle Data Validation</div>
              <div className="text-xs text-slate-500">BJAK – Frontend Demo (React)</div>
            </div>
          </div>

          {/* Palette switcher + note */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <Info size={14} /><span>Real-time typo detection & suggestions</span>
            </div>
            {Object.entries(PALETTES).map(([key, p]) => (
              <button key={key} onClick={() => setPalette(key)} title={p.name}
                className={`h-6 w-6 rounded-full bg-gradient-to-br ${p.grad} ring-2 ${palette===key ? p.ring : "ring-transparent"} transition`} />
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        {/* Left: Form */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
          {/* faint ribbon */}
          <div className={`pointer-events-none absolute -top-20 right-[-40%] h-64 w-[140%] bg-gradient-to-r ${PALETTES[palette].grad} opacity-10 rotate-[8deg]`} />

          <div className="flex items-center justify-between mb-5 relative">
            <div className="flex items-center gap-2">
              <Wand2 size={18} className="text-amber-600" />
              <h2 className="text-lg font-semibold">Enter Vehicle Details</h2>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="accent-emerald-600" checked={autoFix} onChange={()=>setAutoFix(v=>!v)} />
              Auto-accept obvious fixes
            </label>
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
              <div className="relative">
                <input
                  value={plate}
                  onChange={e => setPlate(e.target.value)}
                  placeholder="e.g., WVY 1234"
                  className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ${
                    plateVal.ok ? "border-emerald-300 focus:ring-emerald-500" : "border-amber-300 focus:ring-amber-500"}`}
                />
                <span className="absolute right-3 top-3 text-slate-400 font-mono text-xs">{sanitizePlate(plate).readable}</span>
              </div>
            </div>

            {/* Make */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Make</label>
              <input
                list="makes" value={make} onChange={e => setMake(e.target.value)} placeholder="e.g., Perodua"
                className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ${
                  makeOk ? "border-emerald-300 focus:ring-emerald-500" : "border-amber-300 focus:ring-amber-500"}`}
              />
              <datalist id="makes">{Object.keys(VEHICLE_DB).map(m => <option key={m} value={m} />)}</datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestMake.match}</span> ({(bestMake.score*100).toFixed(0)}%)</div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                list="models" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g., Myvi / X70 / Corolla Altis"
                className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ${
                  modelOk ? "border-emerald-300 focus:ring-emerald-500" : "border-amber-300 focus:ring-amber-500"}`}
              />
              <datalist id="models">{(getModelsForMake(bestMake.match).length ? getModelsForMake(bestMake.match) : allModels()).map(m => <option key={m} value={m} />)}</datalist>
              <div className="mt-1 text-xs text-slate-500">Suggestion: <span className="font-medium">{bestModel.match}</span> ({(bestModel.score*100).toFixed(0)}%)</div>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Year of Manufacture</label>
              <input
                type="number" value={year} onChange={e => setYear(e.target.value)} placeholder={`${nowYear}`}
                className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ${
                  yearVal.ok ? "border-emerald-300 focus:ring-emerald-500" : "border-amber-300 focus:ring-amber-500"}`}
              />
              <div className="mt-1 text-xs text-slate-500">Allowed range: 1980 – {nowYear}</div>
            </div>

            {/* Variant */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Variant / Trim (optional)</label>
              <input
                value={variant} onChange={e => setVariant(e.target.value)} placeholder="e.g., 1.5 AV, AMG Line, M Sport"
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
                <button onClick={applyAllFixes}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  <CheckCheck size={14} /> Apply all fixes
                </button>
              </div>
              <motion.div layout className="flex flex-wrap gap-2">
                {issues.map((it) => (
                  <Badge key={it.key} intent={it.tone} onClick={it.action}>
                    <Wand2 size={14} /> {it.label}: <span className="font-medium ml-1">{it.suggestion}</span>
                  </Badge>
                ))}
              </motion.div>
            </div>
          )}

          {/* Confidence */}
          <div className="mt-6 grid grid-cols-5 gap-4 items-center">
            <div className="col-span-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Validation Confidence</div>
                <div className="text-xs text-slate-600">{Math.round(confidence * 100)}%</div>
              </div>
              <Progress value={confidence} palette={palette} />
              <div className="mt-2 text-xs text-slate-500">Confidence is based on plate pattern, make/model similarity and year plausibility.</div>
            </div>
            <div className="col-span-2 flex items-center justify-center">
              <Donut value={confidence} palette={palette} />
            </div>
          </div>

          {/* Checks */}
          <div className="mt-6 grid sm:grid-cols-2 gap-2">
            <StatusLine ok={plateVal.ok} label="Plate number" message={plateVal.message} />
            <StatusLine ok={makeOk} label="Make" message={makeOk ? `Looks like "${bestMake.match}"` : `Did you mean "${bestMake.match}"?`} />
            <StatusLine ok={modelOk} label="Model" message={modelOk ? `Looks like "${bestModel.match}"` : `Did you mean "${bestModel.match}"?`} />
            <StatusLine ok={yearVal.ok} label="Year" message={yearVal.message} />
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center gap-3">
            <button
              disabled={!formValid}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r ${PALETTES[palette].grad} ${
                formValid ? "hover:opacity-95" : "opacity-50 cursor-not-allowed"}`}
              onClick={handleSubmit}>
              <ChevronRight size={18} /> Validate & Continue
            </button>
            <button
              onClick={() => { setPlate(""); setMake(""); setModel(""); setYear(""); setVariant(""); setToast({ open:true, title:"Cleared", desc:"All inputs reset." }); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50">
              <Undo2 size={16} /> Reset
            </button>
            <div className="text-xs text-slate-500">Submission enables when all checks pass.</div>
          </div>
        </motion.section>

        {/* Right: Output & Dev panel */}
        <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass size={18} className="text-cyan-600" />
            <h3 className="text-lg font-semibold">Normalized Payload (Mock)</h3>
          </div>
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-auto max-h-[360px]">
            <pre>{JSON.stringify(normalizedPayload, null, 2)}</pre>
          </div>

          <div className={`mt-6 p-4 rounded-xl bg-gradient-to-br ${PALETTES[palette].soft} border border-slate-200 text-sm text-slate-700`}>
            <div className="font-semibold mb-1">Why this matters</div>
            <ul className="list-disc ml-5 space-y-1">
              <li>Prevents pricing errors and policy delays caused by typos.</li>
              <li>Improves quote accuracy with canonicalized make/model.</li>
              <li>Flags out-of-range years and invalid plate formats instantly.</li>
            </ul>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Implementation Notes</div>
            <ul className="text-sm text-slate-600 space-y-1 list-disc ml-5">
              <li>Levenshtein similarity for fuzzy matching (make & model).</li>
              <li>Heuristic Malaysia plate pattern: <span className="font-mono">[A-Z]{`{1,4}`}[0-9]{`{1,4}`}</span>.</li>
              <li>Year validation against range 1980 – {nowYear}.</li>
              <li>User-approved one-click badges, plus bulk “Apply all fixes”.</li>
            </ul>
          </div>
        </motion.aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 pb-10 text-xs text-slate-500">
        <div className="pt-4">Frontend demo only. Hook the payload to your backend for real vehicle profile lookups (e.g., JPJ/insurance partner APIs) and stronger rules.</div>
      </footer>
    </div>
  );
}
