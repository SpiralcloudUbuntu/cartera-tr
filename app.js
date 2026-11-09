/* Cartera TR — panel local de Trade Republic
   Todo el procesamiento ocurre en el navegador. No hay backend ni subida de datos. */

const $ = (s) => document.querySelector(s);
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 6 });
const pct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "always" });

/* ---------- utilidades ---------- */

const ALIASES = {
  datetime: ["datetime", "fecha_hora", "timestamp"],
  date: ["date", "fecha"],
  type: ["type", "tipo"],
  category: ["category", "categoria"],
  name: ["name", "nombre", "activo"],
  symbol: ["symbol", "isin", "simbolo"],
  shares: ["shares", "cantidad", "acciones", "titulos"],
  price: ["price", "precio"],
  amount: ["amount", "importe", "valor"],
  fee: ["fee", "comision"],
  tax: ["tax", "impuesto", "impuestos", "retencion"],
  currency: ["currency", "divisa"],
  mcc: ["mcc_code", "mcc"],
};

const norm = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function toNum(v) {
  if (v === null || v === undefined) return 0;
  let s = String(v).trim().replace(/\u00a0/g, "").replace(/\s/g, "").replace("€", "");
  if (!s) return 0;
  const neg = s.startsWith("(") && s.endsWith(")");
  s = s.replace(/^\(|\)$/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.split(",").pop().length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const iso = (d) => d.toISOString().slice(0, 10);
const fmtDate = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function parseCSV(text) {
  const first = text.slice(0, 4000).split("\n")[0];
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(norm);
  const map = {};
  headers.forEach((h, i) => {
    for (const [key, names] of Object.entries(ALIASES)) {
      if (names.map(norm).includes(h)) { map[i] = key; break; }
    }
  });
  return rows.slice(1).filter((r) => r.some((x) => x !== "")).map((r) => {
    const o = {};
    r.forEach((v, i) => { if (map[i]) o[map[i]] = v.trim(); });
    return o;
  });
}

const BUY = new Set(["BUY", "ORDER_BUY", "SAVINGS_PLAN", "SAVINGS_PLAN_EXECUTION", "TRADE_BUY"]);
const SELL = new Set(["SELL", "ORDER_SELL", "TRADE_SELL"]);
const DEPOSIT = new Set(["DEPOSIT", "TRANSFER_IN", "CUSTOMER_INBOUND", "TRANSFER_INBOUND", "INBOUND"]);
const WITHDRAW = new Set(["WITHDRAWAL", "TRANSFER_OUT", "CUSTOMER_OUTBOUND_REQUEST", "TRANSFER_INSTANT_OUTBOUND", "OUTBOUND"]);
const CARD = new Set(["CARD_TRANSACTION", "CARD_PAYMENT", "CARD"]);
const INTEREST = new Set(["INTEREST", "INTEREST_PAYMENT", "INTEREST_PAYOUT", "ZINSEN"]);
const TAXT = new Set(["TAX", "TAX_CORRECTION"]);
const FEET = new Set(["FEE"]);

function classify(t) {
  const x = String(t || "").toUpperCase();
  if (BUY.has(x)) return "compra";
  if (SELL.has(x)) return "venta";
  if (x === "DIVIDEND") return "dividendo";
  if (INTEREST.has(x)) return "interes";
  if (DEPOSIT.has(x)) return "ingreso";
  if (WITHDRAW.has(x)) return "retirada";
  if (CARD.has(x)) return "tarjeta";
  if (TAXT.has(x)) return "impuesto";
  if (FEET.has(x)) return "comision";
  if (x === "BENEFITS_SAVEBACK") return "saveback";
  if (x === "MIGRATION") return "migracion";
  return "otro";
}

const MCC = {
  "5411": "Supermercados", "5412": "Alimentación", "5812": "Restaurantes", "5813": "Bares y cafeterías",
  "5814": "Comida rápida", "5816": "Software y juegos digitales", "5942": "Librerías", "5945": "Juguetes y hobby",
  "5947": "Regalos y bazares", "5541": "Carburante", "5399": "Comercio general", "5999": "Comercio especializado",
  "5651": "Ropa", "5912": "Farmacia", "5977": "Cosmética", "7230": "Peluquería", "7832": "Ocio y entradas",
  "4111": "Transporte", "4121": "Taxis", "7995": "Apuestas", "4899": "Suscripciones",
};

/* ---------- modelo ---------- */

function buildModel(rows, prices) {
  const movs = [];
  const pos = new Map();
  let cash = 0, contributed = 0, card = 0, interest = 0, fees = 0, taxes = 0, saveback = 0, dividends = 0;
  let first = null, last = null;

  for (const r of rows) {
    const tipo = classify(r.type);
    const amount = toNum(r.amount), fee = toNum(r.fee), tax = toNum(r.tax), shares = toNum(r.shares);
    const isin = (r.symbol || "").toUpperCase();
    const name = r.name || isin || "—";
    const d = parseDate(r.datetime || r.date);
    if (!d) continue;
    if (!first || d < first) first = d;
    if (!last || d > last) last = d;

    cash += amount + fee + tax;
    fees += fee;
    taxes += tax;

    if (tipo === "compra" && isin) {
      const p = pos.get(isin) || { isin, name, shares: 0, cost: 0, lastPrice: 0 };
      p.shares += Math.abs(shares);
      p.cost += Math.abs(amount) + Math.abs(fee);
      if (toNum(r.price) > 0) p.lastPrice = toNum(r.price);
      p.name = p.name === isin ? name : p.name;
      pos.set(isin, p);
    } else if (tipo === "venta" && isin) {
      const p = pos.get(isin);
      if (p && p.shares > 0) {
        const vend = Math.abs(shares);
        const prop = Math.min(vend / p.shares, 1);
        p.cost *= 1 - prop;
        p.shares = Math.max(p.shares - vend, 0);
      }
    } else if (tipo === "ingreso") contributed += Math.abs(amount) - Math.abs(fee);
    else if (tipo === "retirada") contributed -= Math.abs(amount) + Math.abs(fee);
    else if (tipo === "tarjeta") card += amount;
    else if (tipo === "interes") interest += amount + tax;
    else if (tipo === "dividendo") dividends += amount + tax;
    else if (tipo === "saveback") saveback += amount + tax;

    movs.push({ d, tipo, name, isin, shares, amount, fee, tax, price: toNum(r.price), mcc: r.mcc || "" });
  }

  movs.sort((a, b) => a.d - b.d);

  /* serie temporal diaria */
  const priceDates = new Set();
  for (const k of Object.keys(prices || {})) {
    for (const day of Object.keys(prices[k].prices || {})) priceDates.add(day);
  }
  const allDays = [...priceDates].sort();
  const byDay = new Map();
  for (const m of movs) {
    const k = iso(m.d);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(m);
  }

  const series = [];
  const holdings = new Map();
  let cashRun = 0;
  let lastKnown = {};
  const start = first || (allDays.length ? parseDate(allDays[0]) : new Date());
  const end = last || (allDays.length ? parseDate(allDays[allDays.length - 1]) : new Date());

  for (const day of allDays) {
    const d = parseDate(day);
    if (d < start || d > end) continue;
    for (const [isin, info] of Object.entries(prices)) {
      if (info.prices[day] != null) lastKnown[isin] = info.prices[day];
    }
  }

  const cursor = new Date(start);
  let i = 0;
  while (cursor <= end) {
    const key = iso(cursor);
    const todays = byDay.get(key) || [];
    for (const m of todays) {
      cashRun += m.amount + m.fee + m.tax;
      if (m.tipo === "compra" && m.isin) {
        const h = holdings.get(m.isin) || { shares: 0, lastPrice: 0 };
        h.shares += Math.abs(m.shares);
        if (m.price > 0) h.lastPrice = m.price;
        holdings.set(m.isin, h);
      } else if (m.tipo === "venta" && m.isin) {
        const h = holdings.get(m.isin);
        if (h) h.shares = Math.max(h.shares - Math.abs(m.shares), 0);
      }
    }
    let value = 0;
    for (const [isin, h] of holdings) {
      if (h.shares <= 0) continue;
      const px = (prices?.[isin]?.prices?.[key]) ?? lastKnown[isin] ?? h.lastPrice ?? 0;
      value += h.shares * px;
    }
    series.push({ day: key, cash: cashRun, value, total: cashRun + value });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    i++;
  }

  /* muestreo semanal para el gráfico */
  const sampled = series.filter((_, idx) => idx % 7 === 0 || idx === series.length - 1);

  /* mensual */
  const months = new Map();
  for (const m of movs) {
    const k = iso(m.d).slice(0, 7);
    const o = months.get(k) || { k, income: 0, card: 0, invest: 0, interest: 0, fees: 0, taxes: 0 };
    if (m.tipo === "ingreso") o.income += m.amount;
    else if (m.tipo === "retirada") o.income += m.amount;
    else if (m.tipo === "tarjeta") o.card += m.amount;
    else if (m.tipo === "compra") o.invest += m.amount + m.fee + m.tax;
    else if (m.tipo === "interes" || m.tipo === "saveback") o.interest += m.amount + m.tax;
    o.fees += m.fee;
    o.taxes += m.tax;
    months.set(k, o);
  }
  const monthly = [...months.values()].sort((a, b) => a.k.localeCompare(b.k));
  monthly.forEach((o) => (o.net = o.income + o.card + o.invest + o.interest));

  /* comercios y MCC */
  const merchants = new Map();
  const mccAgg = new Map();
  for (const m of movs) {
    if (m.tipo !== "tarjeta") continue;
    merchants.set(m.name, (merchants.get(m.name) || 0) + m.amount);
    const label = MCC[m.mcc] || (m.mcc ? `MCC ${m.mcc}` : "Sin categoría");
    mccAgg.set(label, (mccAgg.get(label) || 0) + m.amount);
  }

  const positions = [...pos.values()]
    .filter((p) => p.shares > 0.0000001)
    .map((p) => {
      const lastPx = prices?.[p.isin]?.prices?.[iso(end)] ?? prices?.[p.isin]?.prices?.[allDays[allDays.length - 1]] ?? p.lastPrice;
      return { ...p, price: lastPx, value: p.shares * lastPx };
    })
    .sort((a, b) => b.value - a.value);

  const cost = positions.reduce((s, p) => s + p.cost, 0);
  const marketValue = positions.reduce((s, p) => s + p.value, 0);

  return {
    movs, positions, series, sampled, monthly,
    merchants: [...merchants.entries()].sort((a, b) => a[1] - b[1]),
    mcc: [...mccAgg.entries()].sort((a, b) => a[1] - b[1]),
    cash, contributed, card, interest, fees, taxes, saveback, dividends,
    cost, marketValue, first, last, count: movs.length,
  };
}

/* ---------- gráficas ---------- */

let charts = {};
const palette = ["#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#4ade80", "#e879f9", "#94a3b8"];

function themeColors() {
  const light = document.documentElement.dataset.theme === "light";
  return {
    text: light ? "#12203a" : "#e8eefc",
    muted: light ? "#5b6b87" : "#8fa3c4",
    grid: light ? "rgba(20,40,80,.08)" : "rgba(255,255,255,.07)",
    card: light ? "#ffffff" : "#121c2f",
  };
}

function makeChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const c = themeColors();
  cfg.options = cfg.options || {};
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  cfg.options.plugins = cfg.options.plugins || {};
  cfg.options.plugins.legend = Object.assign({ labels: { color: c.muted, boxWidth: 10, usePointStyle: true } }, cfg.options.plugins.legend || {});
  cfg.options.plugins.tooltip = Object.assign({
    callbacks: {
      label: (ctx) => `${ctx.dataset.label || ctx.label}: ${eur.format(ctx.parsed.y ?? ctx.parsed ?? 0)}`,
    },
  }, cfg.options.plugins.tooltip || {});
  if (cfg.options.scales) {
    for (const s of Object.values(cfg.options.scales)) {
      s.ticks = Object.assign({ color: c.muted }, s.ticks || {});
      s.grid = Object.assign({ color: c.grid }, s.grid || {});
    }
  }
  charts[id] = new Chart(document.getElementById(id), cfg);
}

/* ---------- render ---------- */

function kpi(label, value, sub = "", cls = "") {
  return `<div class="kpi ${cls}"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

function render(m) {
  const total = m.cash + m.marketValue;
  const gain = m.marketValue - m.cost;
  const gainPct = m.cost ? (gain / m.cost) * 100 : 0;
  const months = m.monthly.length || 1;
  const avgCard = m.card / months;

  $("#kpis").innerHTML = [
    kpi("Total en Trade Republic", eur.format(total), `${fmtDate(m.first)} → ${fmtDate(m.last)}`),
    kpi("Efectivo", eur.format(m.cash), "cuenta remunerada", m.cash < 0 ? "bad" : ""),
    kpi("Cartera", eur.format(m.marketValue), `${m.positions.length} posiciones`),
    kpi("Ganancia latente", eur.format(gain), `${pct.format(gainPct)} %`, gain >= 0 ? "good" : "bad"),
    kpi("Aportado neto", eur.format(m.contributed), `${m.count} movimientos`),
    kpi("Gasto con tarjeta", eur.format(Math.abs(m.card)), `media ${eur.format(Math.abs(avgCard))}/mes`, "bad"),
  ].join("");

  $("#subtitle").textContent = `Datos hasta ${fmtDate(m.last)}`;
  $("#status").textContent = `${m.count} movimientos`;

  /* evolución */
  $("#evoRange").textContent = `${fmtDate(m.first)} → ${fmtDate(m.last)}`;
  makeChart("evo", {
    type: "line",
    data: {
      labels: m.sampled.map((p) => p.day),
      datasets: [
        { label: "Total", data: m.sampled.map((p) => p.total), borderColor: "#34d399", backgroundColor: "rgba(52,211,153,.12)", fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
        { label: "Cartera", data: m.sampled.map((p) => p.value), borderColor: "#60a5fa", fill: false, tension: .25, pointRadius: 0, borderWidth: 1.6 },
        { label: "Efectivo", data: m.sampled.map((p) => p.cash), borderColor: "#fbbf24", fill: false, tension: .25, pointRadius: 0, borderWidth: 1.6, borderDash: [4, 3] },
      ],
    },
    options: {
      interaction: { mode: "index", intersect: false },
      scales: { x: { ticks: { maxTicksLimit: 8, callback: (v, i) => m.sampled[i] ? fmtDate(parseDate(m.sampled[i].day)) : "" } }, y: { ticks: { callback: (v) => eur.format(v) } } },
    },
  });

  /* composición */
  makeChart("comp", {
    type: "doughnut",
    data: {
      labels: m.positions.map((p) => p.name),
      datasets: [{ data: m.positions.map((p) => p.value), backgroundColor: palette, borderWidth: 0 }],
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: themeColors().muted, boxWidth: 9, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${eur.format(ctx.parsed)}` } },
      },
    },
  });

  /* MCC */
  const mccTop = m.mcc.slice(-8);
  makeChart("mcc", {
    type: "doughnut",
    data: {
      labels: mccTop.map(([k]) => k),
      datasets: [{ data: mccTop.map(([, v]) => Math.abs(v)), backgroundColor: palette.slice(2).concat(palette), borderWidth: 0 }],
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: themeColors().muted, boxWidth: 9, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${eur.format(ctx.parsed)}` } },
      },
    },
  });

  /* flujo mensual */
  makeChart("flow", {
    type: "bar",
    data: {
      labels: m.monthly.map((o) => o.k),
      datasets: [
        { label: "Ingresos", data: m.monthly.map((o) => o.income), backgroundColor: "#34d399" },
        { label: "Gasto tarjeta", data: m.monthly.map((o) => o.card), backgroundColor: "#f87171" },
        { label: "Inversión", data: m.monthly.map((o) => o.invest), backgroundColor: "#60a5fa" },
        { label: "Neto", data: m.monthly.map((o) => o.net), type: "line", borderColor: "#fbbf24", backgroundColor: "#fbbf24", tension: .25, pointRadius: 2, borderWidth: 2 },
      ],
    },
    options: {
      scales: { x: { stacked: false }, y: { stacked: false, ticks: { callback: (v) => eur.format(v) } } },
      plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur.format(ctx.parsed.y)}` } } },
    },
  });

  /* comercios */
  const topM = m.merchants.slice(0, 14).slice().reverse();
  makeChart("merchants", {
    type: "bar",
    data: {
      labels: topM.map(([k]) => k.length > 26 ? k.slice(0, 26) + "…" : k),
      datasets: [{ label: "Gasto", data: topM.map(([, v]) => Math.abs(v)), backgroundColor: "#f87171", borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      scales: { x: { ticks: { callback: (v) => eur.format(v) } }, y: { ticks: { color: themeColors().muted, font: { size: 10 } } } },
      plugins: { legend: { display: false } },
    },
  });

  /* intereses */
  makeChart("interest", {
    type: "bar",
    data: {
      labels: m.monthly.map((o) => o.k),
      datasets: [{ label: "Intereses + saveback", data: m.monthly.map((o) => o.interest), backgroundColor: "#fbbf24", borderRadius: 4 }],
    },
    options: {
      scales: { y: { ticks: { callback: (v) => eur.format(v) } } },
      plugins: { legend: { display: false } },
    },
  });

  renderTable(m);
  renderDetails(m);
}

/* ---------- tabla ---------- */

let currentModel = null;
let sortKey = "fecha";
let sortDir = -1;

function renderTable(m) {
  const q = ($("#q").value || "").toLowerCase();
  const tf = $("#typeFilter").value;
  let rows = m.movs.filter((x) => {
    if (tf && x.tipo !== tf) return false;
    if (!q) return true;
    return `${x.name} ${x.isin} ${x.tipo} ${x.amount}`.toLowerCase().includes(q);
  });

  const dir = sortDir;
  const key = sortKey;
  rows.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (key === "fecha") { va = a.d.getTime(); vb = b.d.getTime(); }
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  const limit = 300;
  const shown = rows.slice(0, limit);
  $("#table tbody").innerHTML = shown.map((x) => `
    <tr>
      <td>${fmtDate(x.d)}</td>
      <td><span class="tag ${x.tipo}">${x.tipo}</span></td>
      <td>${escapeHtml(x.name)}${x.isin ? ` <span class="hint">${x.isin}</span>` : ""}</td>
      <td class="num">${x.shares ? num.format(Math.abs(x.shares)) : "—"}</td>
      <td class="num">${eur.format(x.amount)}</td>
      <td class="num">${x.fee ? eur.format(x.fee) : "—"}</td>
      <td class="num">${x.tax ? eur.format(x.tax) : "—"}</td>
    </tr>`).join("");
  $("#tableInfo").textContent = `${rows.length} movimientos${rows.length > limit ? ` · mostrando ${limit}` : ""}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- detalles ---------- */

function renderDetails(m) {
  const byMonth = [...m.monthly].sort((a, b) => a.card - b.card);
  const worst = byMonth[0];
  const best = byMonth[byMonth.length - 1];
  const topMerchant = m.merchants[0];
  const negMonths = m.monthly.filter((o) => o.net < 0).length;
  $("#details").innerHTML = `
    <h3>Lectura rápida</h3>
    <ul>
      <li>Periodo: <strong>${fmtDate(m.first)} → ${fmtDate(m.last)}</strong> · ${m.count} movimientos.</li>
      <li>Has ingresado <strong>${eur.format(m.contributed)}</strong>; hoy tienes <strong>${eur.format(m.cash + m.marketValue)}</strong> entre efectivo y cartera, con <strong>${eur.format(m.marketValue)}</strong> invertidos (${pct.format(m.cost ? (m.marketValue - m.cost) / m.cost * 100 : 0)} % sobre coste).</li>
      <li>Gasto con tarjeta: <strong>${eur.format(Math.abs(m.card))}</strong> · media <strong>${eur.format(Math.abs(m.card / (m.monthly.length || 1)))}</strong>/mes.</li>
      <li>Mes con más gasto: <strong>${worst ? worst.k : "—"}</strong> (${worst ? eur.format(Math.abs(worst.card)) : "—"}). Mes con menos: <strong>${best ? best.k : "—"}</strong> (${best ? eur.format(Math.abs(best.card)) : "—"}).</li>
      <li>Meses con flujo neto negativo: <strong>${negMonths} de ${m.monthly.length}</strong>.</li>
      <li>Mayor comercio: <strong>${topMerchant ? escapeHtml(topMerchant[0]) : "—"}</strong> (${topMerchant ? eur.format(Math.abs(topMerchant[1])) : "—"}).</li>
      <li>Intereses cobrados: <strong>${eur.format(m.interest)}</strong> · saveback: <strong>${eur.format(m.saveback)}</strong> · comisiones: <strong>${eur.format(Math.abs(m.fees))}</strong>.</li>
    </ul>`;
}

/* ---------- datos ---------- */

let PRICES = {};

async function loadPrices() {
  try {
    const r = await fetch("prices.json", { cache: "no-cache" });
    if (r.ok) PRICES = (await r.json()).isin || {};
  } catch (e) { PRICES = {}; }
}

function processCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) { alert("El CSV no tiene filas legibles."); return; }
  const m = buildModel(rows, PRICES);
  currentModel = m;
  $("#welcome").hidden = true;
  $("#app").hidden = false;
  render(m);
}

function readFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    const text = String(fr.result);
    try { localStorage.setItem("tr_csv", text); } catch (e) {}
    processCSV(text);
  };
  fr.readAsText(file, "utf-8");
}

/* ---------- eventos ---------- */

$("#file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) readFile(f);
});

$("#q").addEventListener("input", () => currentModel && renderTable(currentModel));
$("#typeFilter").addEventListener("change", () => currentModel && renderTable(currentModel));

document.querySelectorAll("#table th").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.dataset.sort;
    sortDir = sortKey === k ? -sortDir : -1;
    sortKey = k;
    currentModel && renderTable(currentModel);
  });
});

$("#loadDemo").addEventListener("click", async () => {
  const r = await fetch("demo.csv");
  if (!r.ok) return alert("No se encontró demo.csv");
  processCSV(await r.text());
});

$("#reset").addEventListener("click", () => {
  localStorage.removeItem("tr_csv");
  location.reload();
});

$("#theme").addEventListener("click", () => {
  const light = document.documentElement.dataset.theme === "light";
  document.documentElement.dataset.theme = light ? "dark" : "light";
  localStorage.setItem("tr_theme", light ? "dark" : "light");
  if (currentModel) render(currentModel);
});

/* ---------- arranque ---------- */

(async function init() {
  const savedTheme = localStorage.getItem("tr_theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = themeColors().muted;
  await loadPrices();
  if (new URLSearchParams(location.search).has("demo")) {
    const r = await fetch("demo.csv");
    if (r.ok) { processCSV(await r.text()); return; }
  }
  const saved = localStorage.getItem("tr_csv");
  if (saved) processCSV(saved);
})();

/* PWA */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
