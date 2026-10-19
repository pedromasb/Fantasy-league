# Fantasy Asesor

Panel personal de LaLiga Fantasy publicado en GitHub Pages. Cada día recibe por chat el pantallazo del mercado (y de la plantilla cuando cambia). Con ellos se actualizan los datos, se buscan estadísticas en internet y se escribe un informe con recomendaciones.

## Pestañas

- **Inicio**: valor de equipo y su evolución, resumen del informe, mejor nota del mercado y alertas automáticas.
- **Informe** (botón central): recomendaciones del día, más un veredicto jugador a jugador (fichar, pujar, vender, alinear…) con la puja máxima.
- **Mercado**: jugadores del día con nota 0–100, veredicto, filtros y orden.
- **Plantilla**: campo con tu once, once recomendado, mejoras posibles y candidatos a venta.
- **Top**: rankings diarios (puntos, subidas, bajadas, rentabilidad y valor).
- **Ficha de jugador**: recomendación, estadísticas por temporada, noticias, evolución del valor y fuentes.

## Datos

Todo está en [`public/data/fantasy.json`](public/data/fantasy.json); el formato está en [`src/types.ts`](src/types.ts).
`npm test` comprueba que el archivo es coherente.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run build
```

## Publicación

`.github/workflows/deploy.yml` publica en GitHub Pages en cada push a `main` o a la rama de trabajo. Requisitos en GitHub:

1. **Settings → Pages → Source: GitHub Actions**.
2. Si se despliega desde una rama distinta de `main`: **Settings → Environments → github-pages → Deployment branches**, añadir esa rama.

Para instalarla en el móvil: abrir la URL en Chrome → ⋮ → **Añadir a pantalla de inicio**.
