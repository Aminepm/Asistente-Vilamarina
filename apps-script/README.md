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
   - `GROQ_API_KEY` — tu clave de la API de Groq, obtenida en
     [console.groq.com/keys](https://console.groq.com/keys) (no pide
     tarjeta de crédito).
   - `SHEET_ID` — el ID de la Google Sheet (ya debería estar configurado).
   - `GROQ_MODEL` (opcional) — por defecto `llama-3.1-8b-instant`. Se eligió
     este modelo (en vez de uno más grande, como el 70B) porque el tier
     gratuito le da un límite diario de peticiones mucho más alto (miles al
     día en vez de solo unos cientos), y para elegir entre 6 categorías fijas
     no hace falta un modelo grande.
   - `WRITE_SECRET` — ya debería estar configurado (edición en línea desde
     la web).
4. Ejecuta `testGroq()` manualmente y revisa Ver -> Registros de
   ejecución para confirmar que Groq responde bien. A diferencia de
   `testClasificacion()` (que prueba sobre todo la red de palabras clave),
   `testGroq()` usa un texto que fuerza a llamar de verdad a la API.
5. (Opcional) Ejecuta `reclasificarHistorico()` para volver a clasificar
   las incidencias ya guardadas con el nuevo modelo. Como Apps Script
   corta la ejecución a los 6 minutos, puede que necesites ejecutarlo
   varias veces hasta que el log diga "no quedan más filas".
6. Si alguna fila se queda en "Sin clasificar" por un fallo temporal de la
   IA (por ejemplo, un 429 de cuota agotada), no hace falta repetir el
   histórico completo: ejecuta `reintentarSinClasificar()`, que solo repasa
   las filas que ahora mismo están en "Sin clasificar".
7. El disparador (trigger) de `procesarReportes` cada 10-15 min no necesita
   tocarse, sigue llamando a `clasificarIncidencia()` igual que antes. Si vas
   a ejecutar `reclasificarHistorico()` o `reintentarSinClasificar()` a mano
   durante un rato largo, considera desactivar temporalmente ese disparador
   para que no compita por la misma cuota de peticiones/minuto de Groq.

## Qué ha cambiado respecto a la versión anterior (Gemini)

- `clasificarConIA()` ahora llama a la API de Groq
  (`api.groq.com/openai/v1/chat/completions`, compatible con el formato de
  OpenAI) en vez de a la API de Gemini.
- El tier gratuito de Groq permite 30 peticiones/minuto (frente a las 20 de
  Gemini) y, con el modelo `llama-3.1-8b-instant`, un límite diario de
  peticiones mucho más alto — pensado para evitar los cortes por cuota
  agotada (429 `RESOURCE_EXHAUSTED`) que daba Gemini al reclasificar el
  histórico completo.
- Se usa el modo JSON de Groq (`response_format: {type: "json_object"}`)
  con la lista de categorías en el propio prompt. A diferencia del
  `responseSchema` con `enum` de Gemini, esto no obliga al modelo a devolver
  una de las categorías exactas a nivel de API, así que el código sigue
  validando la categoría recibida contra la lista válida antes de usarla
  (si no coincide, se trata igual que un fallo de la IA: la incidencia
  queda "Sin clasificar" para revisión manual).
- En los reintentos tras un 429, se lee el tiempo de espera de la cabecera
  HTTP `Retry-After` que envía Groq (Gemini lo incluía en el texto del
  mensaje de error en vez de en una cabecera).
- El resto del sistema (red de palabras clave que decide "Operativa" y los
  patrones de accidente/robo/daños antes de llamar a la IA) no ha cambiado.
