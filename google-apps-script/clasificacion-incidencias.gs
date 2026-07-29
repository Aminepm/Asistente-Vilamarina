/******************************************************************
 * Vilamarina - Clasificacion automatica de reportes de seguridad
 * Google Apps Script + Hugging Face (zero-shot)
 *
 * Este archivo NO forma parte de la web estatica (index.html/js/*):
 * se pega manualmente en el editor de Google Apps Script vinculado
 * a la hoja de calculo de incidencias. Se guarda aqui en el repo
 * solo para llevar control de versiones del clasificador.
 *
 * CONFIGURACION (una sola vez):
 *  - Configuracion del proyecto -> Propiedades del script:
 *      HF_TOKEN = tu token de Hugging Face
 *      SHEET_ID = el ID de tu Google Sheet
 *  - Activador temporal: procesarReportes cada 10-15 min.
 *  - Antes de activar el trigger real, ejecuta testClasificacionIA()
 *    una vez desde el editor y revisa los logs (Ver -> Registros).
 ******************************************************************/

const PROPS     = PropertiesService.getScriptProperties();
const HF_TOKEN  = PROPS.getProperty('HF_TOKEN');
const SHEET_ID  = PROPS.getProperty('SHEET_ID');
const HF_MODEL  = 'MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7';
const REMITENTE = 'no_responder@serviap.es';

// IMPORTANTE: "Incidència Baixa" lleva tilde en la "è" (grafía catalana).
// La app web (js/app.js) compara este valor de forma exacta en varios
// sitios (traduccion de la etiqueta, exclusion de KPIs, reclasificacion
// automatica de avisos de ascensor). Si aqui se guarda sin tilde
// ("Incidencia Baixa"), la app web deja de reconocerlo y esas
// incidencias aparecen sin traducir y sin excluir de los KPIs.
const CATEGORIAS = ['Robatori','Danys','Accident Parking','Accident CC','Incidència Baixa','Operativa'];
const GRAVEDADES = ['Critica','Alta','Media','Baja'];

// Palabras clave que identifican tareas OPERATIVAS (no incidencias de seguridad reales).
// Cierres, aperturas, revisiones rutinarias, avisos de mantenimiento, etc.
const OPERATIVA_KEYWORDS = [
  'manusa', 'persiana', 'percian', 'barrera', 'compactadora', 'compactador',
  'lavabo', 'aseo', 'wc', 'carro', 'mercadona', 'recojan los carros',
  'cierre de', 'cierre parcial', 'cierran', 'cierra', 'bajada de', 'apertura de',
  'abre', 'abren', 'muelle', 'acceso de', 'salida de parkin', 'entrada -salida',
  'entrada-salida', 'parkin', 'parking', 'basura', 'residuo', 'residuos',
  'revision', 'revicion', 'ronda', 'ilumina', 'luces', 'aire acondicionado', 'climatizacion',
  // Empresas de mantenimiento de ascensores: si se las nombra es un aviso tecnico,
  // no una incidencia de seguridad. OJO: no se incluye la palabra suelta "ascensor"
  // porque un accidente real dentro de un ascensor SI debe clasificarse como
  // Accident CC, no como Operativa.
  'schindler', 'otis', 'kone', 'thyssenkrupp', 'thyssen'
];

function esOperativa(desc) {
  var t = (desc || '').toLowerCase();
  for (var i = 0; i < OPERATIVA_KEYWORDS.length; i++) {
    if (t.indexOf(OPERATIVA_KEYWORDS[i]) !== -1) return true;
  }
  return false;
}

function procesarReportes() {
  var msgs = GmailApp.search('is:unread "Comunicado en el servicio"', 0, 50);
  var procesados = 0;
  for (var k = 0; k < msgs.length; k++) {
    var thread = msgs[k];
    var arr = thread.getMessages();
    for (var mi = 0; mi < arr.length; mi++) {
      var msg = arr[mi];
      if (!msg.isUnread()) continue;
      var html = msg.getBody();
      var um = html.match(/https:\/\/serviap\.cat\/_URL\/app4000\.asp\?hash=[^"\x27\s<>]+/);
      if (!um) { continue; }
      var url = um[0];
      var texto = extraerReporte(url);
      if (!texto) { Logger.log('Reporte ' + (procesados+1) + ': no se pudo extraer texto'); continue; }
      var idxDes = texto.toUpperCase().indexOf("DESARROLLO");
      var cuerpo = (idxDes >= 0) ? texto.slice(idxDes + "DESARROLLO".length) : texto;
      // Split into individual incidents by date-time header.
      // Cada entrada empieza con fecha (dd/mm/yyyy) + hora (hh:mm) + autor, y su
      // descripcion va hasta la siguiente cabecera de fecha-hora o el final.
      var re = /(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})[^\n]*\n([\s\S]*?)(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}|$)/g;
      var mm, count = 0;
      while ((mm = re.exec(cuerpo)) !== null) {
        var fecha = mm[1];
        var hora = mm[2];
        var desc = (mm[3] || "").replace(/\s+/g, " ").trim();
        // Quitar posible pie de pagina del comunicado.
        desc = desc.replace(/\s*(Enviar a e-?mail|Imprimir|Descargar PDF)\s*/gi, " ").trim();
        if (!desc) continue;
        var up = desc.toUpperCase();
        // Descartar lineas de control de servicio y de jornada (no se guardan).
      if (/(INICI|FINALIZ|FIN|TERMIN|ACABA)\w*\s+(DE\s+)?(SERVICIO|JORNADA|TURNO)/.test(up) ||
          up.indexOf("INICIO SERVICIO") !== -1 || up.indexOf("FINALIZO SERVICIO") !== -1 ||
          up.indexOf("FINALIZ") !== -1) continue;
      var categoria, gravedad, textoFinal;
      // Red de seguridad: si es claramente operativa, no gastamos llamada de IA.
      if (esOperativa(desc)) {
        categoria = "Operativa";
        gravedad  = "Baja";
        textoFinal = corregirOrtografia(desc);
      } else {
        var analisis = analizarIncidenciaIA(desc);
        categoria  = analisis.categoria;
        gravedad   = analisis.gravedad;
        textoFinal = analisis.texto || desc;
      }
      // Toda incidencia Operativa es siempre gravedad Baja.
      if (categoria === "Operativa") gravedad = "Baja";
      guardarIncidencia({
        fecha: fecha,
        hora: hora,
        gravedad: gravedad,
        categoria: categoria,
        resumen: textoFinal.slice(0, 250),
        original: textoFinal.slice(0, 1000),
          enlace: url
        });
        count++;
        Utilities.sleep(300);
      }
      msg.markRead();
      procesados++;
      Logger.log("Reporte " + procesados + ": " + count + " incidencias guardadas");
    }
  }
  Logger.log("TOTAL correos procesados: " + procesados);
}

function extraerReporte(url) {
  try {
    const html = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true}).getContentText();
    return html.replace(/<script[\s\S]*?<\/script>/gi,' ')
               .replace(/<style[\s\S]*?<\/style>/gi,' ')
               .replace(/<br\s*\/?>/gi,'\n')
               .replace(/<\/(p|div|tr|li|h\d)>/gi,'\n')
               .replace(/<[^>]+>/g,' ')
               .replace(/&nbsp;/g,' ')
               .replace(/[ \t\f\v]+/g,' ')
               .replace(/ *\n */g,'\n')
               .replace(/\n{2,}/g,'\n')
               .trim();
  } catch (e) {
    Logger.log('Error extrayendo reporte: ' + e);
    return null;
  }
}

/* === CLASIFICACIÓN CON IA (Hugging Face, zero-shot) =========
   Llama al modelo multilingue de clasificacion zero-shot con las
   categorias como hipotesis en castellano. Si la llamada falla
   (token no configurado, error de red, modelo cargando, limite de
   cuota...) cae automaticamente a la clasificacion por reglas, para
   que el proceso nunca se quede sin categorizar un aviso. ============ */

var ETIQUETAS_HF = [
  'un robo o hurto',
  'daños o vandalismo',
  'un accidente en el parking o aparcamiento',
  'un accidente dentro del centro comercial',
  'una incidencia de seguridad leve',
  'una tarea operativa o de mantenimiento'
];
var ETIQUETA_A_CATEGORIA = {
  'un robo o hurto': 'Robatori',
  'daños o vandalismo': 'Danys',
  'un accidente en el parking o aparcamiento': 'Accident Parking',
  'un accidente dentro del centro comercial': 'Accident CC',
  'una incidencia de seguridad leve': 'Incidència Baixa',
  'una tarea operativa o de mantenimiento': 'Operativa'
};
var CATEGORIA_A_GRAVEDAD = {
  'Robatori': 'Alta',
  'Danys': 'Media',
  'Accident Parking': 'Media',
  'Accident CC': 'Media',
  'Incidència Baixa': 'Media',
  'Operativa': 'Baja'
};

function analizarIncidenciaIA(desc) {
  var texto = corregirOrtografia(desc);
  var fallback = analizarIncidencia(desc);

  if (!HF_TOKEN) {
    Logger.log('HF_TOKEN no configurado en Propiedades del script; usando clasificación por reglas.');
    return fallback;
  }

  try {
    var respuesta = UrlFetchApp.fetch('https://api-inference.huggingface.co/models/' + HF_MODEL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + HF_TOKEN },
      payload: JSON.stringify({
        inputs: desc,
        parameters: {
          candidate_labels: ETIQUETAS_HF,
          hypothesis_template: 'Este mensaje describe {}.',
          multi_label: false
        }
      }),
      muteHttpExceptions: true
    });

    var codigo = respuesta.getResponseCode();
    if (codigo !== 200) {
      Logger.log('Hugging Face devolvió ' + codigo + ': ' + respuesta.getContentText().slice(0, 300));
      return fallback;
    }

    var datos = JSON.parse(respuesta.getContentText());
    var mejorEtiqueta = datos && datos.labels && datos.labels[0];
    var mejorPuntuacion = datos && datos.scores && datos.scores[0];
    var categoria = ETIQUETA_A_CATEGORIA[mejorEtiqueta];
    if (!categoria) {
      Logger.log('Hugging Face devolvió una etiqueta no reconocida: ' + mejorEtiqueta);
      return fallback;
    }
    Logger.log('HF clasificó como "' + mejorEtiqueta + '" (' + Math.round((mejorPuntuacion||0)*100) + '%) -> ' + categoria);
    return { categoria: categoria, gravedad: CATEGORIA_A_GRAVEDAD[categoria], texto: texto };
  } catch (e) {
    Logger.log('Excepción llamando a Hugging Face: ' + e);
    return fallback;
  }
}

// Ejecuta esto manualmente desde el editor (Ejecutar -> testClasificacionIA)
// y revisa Ver -> Registros para comprobar que el token funciona y que las
// categorías salen como se espera, antes de dejar el trigger automático.
function testClasificacionIA() {
  var ejemplos = [
    'Se avisa a Schindler porque el ascensor de la zona norte no funciona correctamente',
    'Un cliente ha robado varias prendas de la tienda sin pagar',
    'Se ha roto una farola en el aparcamiento tras el golpe de un vehículo',
    'Un cliente se ha caído dentro del ascensor de la planta 1 y se ha golpeado',
    'Ronda rutinaria de comprobación de cámaras'
  ];
  ejemplos.forEach(function (desc) {
    var r = analizarIncidenciaIA(desc);
    Logger.log(desc + '  =>  ' + JSON.stringify(r));
  });
}

/* === CLASIFICACIÓN POR REGLAS (sin API, gratis; usada como respaldo) === */

// Normaliza: minúsculas y sin acentos, para poder buscar palabras clave.
function _norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Devuelve {categoria, gravedad, texto} clasificando por palabras clave.
function analizarIncidencia(desc) {
  var t = _norm(desc);
  var texto = corregirOrtografia(desc);

  // --- OPERATIVA: aperturas, cierres, mantenimiento, relevos, expulsiones... ---
  var opRe = /(apertur|abrimos|abre el centro|cierre|cerramos|cierra el centro|emisora|walkie|relevo|cambio de turno|ronda|rondas|mantenimiento|limpiez|glovo|repartidor|reparto|residuo|basura|contenedor|expuls|se echa|echa a|echo a|echan a|echamos|echad|desalojo|invit(a|o|ar).{0,15}(salir|abandonar|marchar)|acompan.{0,12}salida|advert|sospechos|merode|persona.{0,20}(fuera|salir|abandone)|se avisa por emisora|gesti[oó]n|revisi[oó]n rutinaria|rutina|comprobaci[oó]n)/;
  if (opRe.test(t)) {
    return { categoria: "Operativa", gravedad: "Baja", texto: texto };
  }

  // --- ROBATORI: robos y hurtos (incluye intento) ---
  var roboRe = /(robo|robat|hurto|hurt|sustrac|sustrajo|birl|sisa|carteris|intento de robo|intent.{0,10}(rob|hurt)|se llev[oó] sin pagar|sin pagar)/;
  if (roboRe.test(t)) {
    return { categoria: "Robatori", gravedad: "Alta", texto: texto };
  }

  // --- DAÑOS / VANDALISMO ---
  var danyRe = /(danos|dany|dano|vandal|rotur|rompio|roto|rompen|destroz|pintad|grafiti|graffiti|desperfec|averia)/;
  if (danyRe.test(t)) {
    return { categoria: "Danys", gravedad: "Media", texto: texto };
  }

  // --- ACCIDENTES: caídas, golpes, lesiones ---
  var accRe = /(accident|caid|cayo|se cayo|golpe|golpear|lesion|herid|resbal|tropiez|desmay|mareo|contusion|fractur)/;
  if (accRe.test(t)) {
    var parkingRe = /(parking|parquin|aparcamiento|garaje|planta -|planta menos|sotano|zona de coches)/;
    if (parkingRe.test(t)) {
      return { categoria: "Accident Parking", gravedad: "Media", texto: texto };
    }
    return { categoria: "Accident CC", gravedad: "Media", texto: texto };
  }

  // --- Por defecto: nota de seguridad de baja importancia ---
  return { categoria: "Incidència Baixa", gravedad: "Media", texto: texto };
}

// Corrección ortográfica básica por diccionario (sin API). No cambia el sentido.
function corregirOrtografia(desc) {
  var s = desc || "";
  var reglas = [
    [/\bq\b/gi, "que"],
    [/\bxq\b/gi, "porque"],
    [/\bpq\b/gi, "porque"],
    [/\bx\b/gi, "por"],
    [/\btb\b/gi, "también"],
    [/\btmb\b/gi, "también"],
    [/\bd\b/gi, "de"],
    [/\bhaber\b/gi, "a ver"],
    [/\bhechar\b/gi, "echar"],
    [/\bhecho\b/gi, "hecho"],
    [/\baver\b/gi, "a ver"],
    [/\basido\b/gi, "ha sido"],
    [/\baver iguar\b/gi, "averiguar"],
    [/\bmr\b/gi, "mr"],
    [/\bseñor\b/gi, "señor"],
    [/\bpolicia\b/gi, "policía"],
    [/\bvehiculo\b/gi, "vehículo"],
    [/\brapido\b/gi, "rápido"],
    [/\bcamara\b/gi, "cámara"],
    [/\bcamaras\b/gi, "cámaras"],
    [/  +/g, " "]
  ];
  for (var i = 0; i < reglas.length; i++) {
    s = s.replace(reglas[i][0], reglas[i][1]);
  }
  // Mayúscula inicial en cada frase.
  s = s.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, function(m, p1, p2){ return p1 + p2.toUpperCase(); });
  return s.trim();
}

/* === clasificar (compatibilidad): delega en analizarIncidencia) === */
function clasificar(desc) {
  var r = analizarIncidencia(desc);
  return { categoria: r.categoria, gravedad: r.gravedad };
}


function guardarIncidencia(inc) {
  const hoja = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  hoja.appendRow([
    new Date(),
    inc.fecha,
    inc.hora,
    inc.gravedad,
    inc.categoria,
    inc.resumen,
    'Obert',
    inc.original,
    inc.enlace || ''
  ]);
}

/* === API WEB: devuelve las incidencias de la hoja en JSON ===
   Se publica como Web App (Implementar -> Nueva implementacion -> Aplicacion web).
   Soporta JSONP mediante el parametro ?callback= para lectura desde el panel. */

function formatearFecha(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return v == null ? '' : ('' + v);
}
function formatearHora(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  return v == null ? '' : ('' + v);
}

function doGet(e) {
  const hoja = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  // Se asume fila 0 = cabeceras. Columnas segun guardarIncidencia():
  // [marca, fecha, hora, gravedad, categoria, resumen, estado, original]
  // La cabecera solo existe si la primera celda de la fila 0 NO es una fecha.
  // Las filas de datos tienen un objeto Date (marca temporal) en la columna 0.
  var inicio = 0;
  if (datos.length > 0 && !(datos[0][0] instanceof Date)) {
    inicio = 1;
  }
  const incidencias = [];
  for (var i = inicio; i < datos.length; i++) {
    var f = datos[i];
    if (!f[1] && !f[5]) continue; // saltar filas vacias
    incidencias.push({
      fecha:     formatearFecha(f[1]),
      hora:      formatearHora(f[2]),
      gravedad:  f[3],
      categoria: f[4],
      resumen:   f[5],
      estat:     f[6] || 'Obert',
      original:  f[7] || '',
      enlace:    f[8] || ''
    });
  }
  const json = JSON.stringify(incidencias);
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
