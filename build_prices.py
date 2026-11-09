#!/usr/bin/env python3
"""Genera prices.json con series diarias en EUR de los ETFs de la cartera.

Se ejecuta a mano cuando se quiera refrescar la valoración histórica:
    python3 build_prices.py

Los precios son datos públicos de mercado; no se incluye ningún dato personal.
"""
import json
import ssl
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    CAFILE = certifi.where()
except Exception:
    CAFILE = "/etc/ssl/cert.pem"

# ISIN -> listado europeo en EUR (evita conversión de divisa)
TICKERS = {
    "IE00B5BMR087": "CSSPX.MI",   # iShares Core S&P 500 UCITS ETF (Acc)
    "IE00B4L5Y983": "IWDA.AS",    # iShares Core MSCI World UCITS ETF (Acc)
    "IE00B4ND3602": "PPFB.DE",    # iShares Physical Gold ETC
}

OUT = Path(__file__).with_name("prices.json")


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            ctx = ssl.create_default_context(cafile=CAFILE)
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return json.loads(r.read().decode())
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1 + i)


def serie(symbol):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
           "?range=2y&interval=1d")
    data = get(url)
    res = data["chart"]["result"][0]
    ts = res.get("timestamp") or []
    closes = res["indicators"]["quote"][0].get("close") or []
    out = {}
    for t, c in zip(ts, closes):
        if c is None:
            continue
        d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        out[d] = round(float(c), 4)
    return {
        "symbol": symbol,
        "currency": res["meta"].get("currency", "EUR"),
        "prices": out,
    }


def main():
    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance · listados europeos en EUR",
        "isin": {},
    }
    for isin, symbol in TICKERS.items():
        s = serie(symbol)
        payload["isin"][isin] = s
        print(f"{isin} -> {symbol}: {len(s['prices'])} sesiones, "
              f"última {max(s['prices']) if s['prices'] else '—'} = "
              f"{s['prices'].get(max(s['prices']), '—')} {s['currency']}")
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"Escrito {OUT} ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
