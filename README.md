# Cartera TR

Panel visual de la cartera de **Trade Republic** a partir de su CSV oficial de transacciones.

## Qué hace

- Sube el CSV y calcula todo **en el navegador**: no hay backend, no se sube nada.
- Evolución del patrimonio (efectivo + cartera) usando precios históricos de Yahoo Finance.
- Composición de la cartera, flujo mensual, gastos por categoría MCC y por comercio.
- Intereses, saveback, comisiones e impuestos.
- Tabla de movimientos con búsqueda, filtro y ordenación.

## Cómo exportar el CSV

1. App de Trade Republic → perfil → **Extractos de cuenta**.
2. **Exportación de transacciones** → periodo *desde la apertura de la cuenta*.
3. Descarga el CSV y súbelo en la app.

## Privacidad

Los datos financieros **nunca salen del navegador**. Se guardan en `localStorage` para no tener que
volver a subir el CSV en cada visita, y se borran con el botón "Borrar datos de este navegador".

En el repositorio solo hay código y precios públicos de mercado (`prices.json`). **No hay datos personales.**

## Precios

`prices.json` se genera con `build_prices.py` (Yahoo Finance, listados europeos en EUR):

```bash
python3 build_prices.py
```

## Desarrollo local

```bash
python3 -m http.server 8765
# abrir http://localhost:8765
```

`demo.csv` son datos sintéticos para probar la interfaz.
