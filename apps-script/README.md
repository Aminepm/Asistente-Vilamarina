# Apps Script - Clasificador de incidencias (Vilamarina)

Este es el backend de clasificación por IA que alimenta la Google Sheet leída
por `js/app.js` (`VILAMARINA_WEBAPP_URL`). Vive en un proyecto de Google Apps
Script aparte (no en GitHub), pero se guarda aquí una copia versionada de
`Clasificador.gs` para poder revisar cambios e histórico.

## Cómo aplicar cambios

1. Abre el proyecto de Apps Script vinculado a la Google Sheet
   (Extensiones -> Apps Script).
2. Sustituye el contenido del archivo `.gs` correspondiente por el de
   `Clasificador.gs`.
3. Configura las Propiedades del script (⚙️ Configuración del proyecto ->
   Propiedades del script):
   - `GEMINI_API_KEY` — tu clave de la API de Gemini, obtenida en
     [Google AI Studio](https://aistudio.google.com/apikey).
   - `SHEET_ID` — el ID de la Google Sheet (ya debería estar configurado).
   - `GEMINI_MODEL` (opcional) — por defecto `gemini-2.5-flash`. Puedes
     probar `gemini-2.5-flash-lite` si buscas menor coste/latencia, o
     `gemini-2.5-pro` si necesitas más precisión.
   - `WRITE_SECRET` — ya debería estar configurado (edición en línea desde
     la web).
4. Ejecuta `testClasificacion()` manualmente y revisa
   Ver -> Registros de ejecución para confirmar que Gemini responde bien.
5. (Opcional) Ejecuta `reclasificarHistorico()` para volver a clasificar
   las incidencias ya guardadas con el nuevo modelo. Como Apps Script
   corta la ejecución a los 6 minutos, puede que necesites ejecutarlo
   varias veces hasta que el log diga "no quedan más filas".
6. El disparador (trigger) de `procesarReportes` cada 10-15 min no necesita
   tocarse, sigue llamando a `clasificarIncidencia()` igual que antes.

## Qué ha cambiado respecto a la versión anterior (Hugging Face)

- `clasificarConIA()` ahora llama a la API de Gemini
  (`generativelanguage.googleapis.com`) en vez de al router de Hugging
  Face.
- Se usa "structured output" (`responseSchema` con un `enum` de las 6
  categorías exactas), así que Gemini siempre devuelve una de las
  categorías válidas en JSON — no hace falta parsear texto libre.
- El resto del sistema (red de palabras clave que decide "Operativa" y los
  patrones de accidente/robo/daños antes de llamar a la IA) no ha cambiado.
