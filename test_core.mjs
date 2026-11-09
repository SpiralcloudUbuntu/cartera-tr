// Test de la lógica pura de app.js (sin DOM) con Node.
import fs from "fs";

const src = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
const cut = src.indexOf("/* ---------- gráficas ---------- */");
if (cut < 0) throw new Error("No se encontró el corte de gráficas");
const code = src.slice(0, cut);
const factory = new Function(code + "\nreturn { parseCSV, buildModel, classify, toNum };");
const { parseCSV, buildModel } = factory();

const prices = JSON.parse(fs.readFileSync(new URL("./prices.json", import.meta.url), "utf8")).isin;
const file = process.argv[2];
const csv = fs.readFileSync(file, "utf8");
const rows = parseCSV(csv);
const m = buildModel(rows, prices);

const eur = (v) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);
console.log("Archivo:", file);
console.log("Filas parseadas:", rows.length, "| movimientos:", m.count);
console.log("Periodo:", m.first?.toISOString().slice(0, 10), "→", m.last?.toISOString().slice(0, 10));
console.log("Efectivo:", eur(m.cash));
console.log("Aportado neto:", eur(m.contributed));
console.log("Coste:", eur(m.cost), "| Valor mercado:", eur(m.marketValue));
console.log("Ganancia latente:", eur(m.marketValue - m.cost));
console.log("Tarjeta:", eur(m.card));
console.log("Intereses:", eur(m.interest), "| Saveback:", eur(m.saveback));
console.log("Comisiones:", eur(m.fees), "| Impuestos:", eur(m.taxes));
console.log("Posiciones:");
for (const p of m.positions) {
  console.log(`  ${p.name} | ${p.isin} | ${p.shares.toFixed(6)} | coste ${eur(p.cost)} | valor ${eur(p.value)} | px ${p.price}`);
}
console.log("Serie:", m.series.length, "días | muestreada:", m.sampled.length);
console.log("Meses:", m.monthly.length, "| comercios:", m.merchants.length, "| MCC:", m.mcc.length);
if (m.series.length) {
  console.log("Primer punto:", JSON.stringify(m.series[0]));
  console.log("Último punto:", JSON.stringify(m.series[m.series.length - 1]));
}
