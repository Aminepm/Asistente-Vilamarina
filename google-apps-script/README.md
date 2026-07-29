# Clasificador de incidencias (Google Apps Script)

`clasificacion-incidencias.gs` es el script que lee los correos de "Comunicado en
el servicio", extrae cada incidencia y las guarda clasificadas en la hoja de
cálculo que consume la web (`index.html` / `js/app.js`). **No se ejecuta desde
este repositorio** — Google Apps Script no despliega desde Git, así que este
archivo se guarda aquí solo para llevar control de versiones. Los cambios hay
que copiarlos manualmente al editor de Apps Script.

## Cómo actualizar el script

1. Abre tu proyecto en [script.google.com](https://script.google.com) (vinculado
   a la hoja de cálculo de incidencias).
2. Sustituye el contenido del archivo `.gs` por el de `clasificacion-incidencias.gs`.
3. En el icono de engranaje ⚙️ **Configuración del proyecto** → **Propiedades del
   script**, confirma que existen:
   - `HF_TOKEN` — tu token de Hugging Face (con permisos de solo lectura basta
     para llamar al modelo de clasificación).
   - `SHEET_ID` — el ID de la hoja de cálculo.
4. Ejecuta manualmente `testClasificacionIA()` desde el editor (▶ Ejecutar) y
   revisa **Ver → Registros** para comprobar que Hugging Face responde y que las
   categorías salen como se espera.
5. Solo entonces deja el disparador (trigger) de `procesarReportes` activo cada
   10–15 minutos.

## Qué cambió respecto a la versión anterior

- **Clasificación real por IA**: antes el token y el modelo de Hugging Face
  estaban definidos pero nunca se llegaban a usar — `analizarIncidencia()` era
  puramente por palabras clave. Ahora `analizarIncidenciaIA()` llama al modelo
  zero-shot `MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7` con las
  categorías como hipótesis en castellano, y si la llamada falla (token no
  configurado, error de red, límite de cuota, modelo cargando...) cae
  automáticamente a la clasificación por palabras clave, para que nunca se deje
  un aviso sin categorizar.
- **Tilde corregida**: la categoría de incidencias leves se guarda ahora como
  `"Incidència Baixa"` (con tilde en la è, grafía catalana) en vez de
  `"Incidencia Baixa"`. La web (`js/app.js`) compara este valor de forma exacta
  en varios sitios — con la tilde que faltaba, esas incidencias no se traducían
  a "Incidencia leve", no se excluían de los KPIs de seguridad y la
  reclasificación automática de avisos de ascensor nunca se activaba para datos
  reales de la hoja.
- **Avisos de mantenimiento de ascensores**: se añaden los nombres de empresas
  de mantenimiento (`schindler`, `otis`, `kone`, `thyssenkrupp`/`thyssen`) a las
  palabras clave que clasifican como "Operativa" directamente, sin gastar
  llamada a la IA. Deliberadamente **no** se añade la palabra suelta "ascensor",
  para no clasificar como operativa un accidente real ocurrido dentro de un
  ascensor.

## Nota sobre datos históricos

Las filas ya guardadas en la hoja con el valor antiguo `"Incidencia Baixa"`
(sin tilde) seguirán funcionando en la web, pero no se benefician de la
traducción de etiqueta ni de la exclusión de KPIs hasta que se corrijan a mano
en la hoja (buscar y reemplazar por `"Incidència Baixa"`) o se vuelvan a
procesar.
