# Fantasy Asesor

App personal (PWA) para analizar tu equipo de LaLiga Fantasy desde el móvil. Sin IA y sin servidor: los datos se guardan solo en tu teléfono.

## Cómo se usa

1. Haz un pantallazo del **mercado** o de tu **alineación** en LaLiga Fantasy.
2. Ábrelo en el Pixel y pulsa **Lens → Texto → Seleccionar todo → Copiar** (o "Copiar texto" en Recientes).
3. En la app, pulsa **+ → Pegar → Analizar texto**, revisa y guarda.
   Con la app instalada también puedes usar **Compartir → Fantasy Asesor** desde Lens.

Tipos de texto que entiende:

- **Mercado**: tarjetas con posición (COA/DEF/MID/STR), FSYP, Value, Price, estado y pujas.
- **Alineación** (pestaña Line-up): formación, valor de equipo y los 11 titulares por línea.
- **Squad**: la lista de la pestaña Squad, con valores y puntos de cada jugador.

## Qué ofrece

- **Inicio**: valor de equipo y su evolución, saldo, plusvalías, mejor oportunidad del día y consejos.
- **Mercado**: nota de oportunidad 0–100 (puntos por millón, puntos y tendencia del valor), filtros por posición y por saldo.
- **Plantilla**: campo con tu once, once ideal, mejoras posibles con jugadores del mercado y candidatos a venta.
- **Top**: rankings diarios (puntos, subidas, bajadas, rentabilidad, valor) con podio.
- **Ficha de jugador**: evolución del valor, historial, precio de compra y ganancia, fusionar nombres cortados.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests del lector de texto
npm run build
```

## Publicarla en tu móvil

El workflow `.github/workflows/deploy.yml` publica la app en GitHub Pages al hacer push a `main`.
Activa **Settings → Pages → Source: GitHub Actions** en el repositorio, abre la URL en Chrome del Pixel y elige **Añadir a pantalla de inicio → Instalar**.
