/******************************************************************
 * Vilamarina - Clasificación automática de reportes de seguridad
 * Google Apps Script + Gemini (Google AI)
 *
 * La IA decide casi siempre la categoría y la gravedad. La única
 * excepción es una red de seguridad mínima con un puñado de palabras
 * clave sin ambigüedad (empresas de mantenimiento de ascensores,
 * rondas rutinarias, aperturas/puesta en marcha) que se comprueban
 * ANTES de llamar a la IA: en las pruebas, el modelo confundía justo
 * estos casos con "Incidencia leve" en vez de "Operativa". Todo lo
 * demás (robo, daños, accidentes) lo decide exclusivamente Gemini.
 *
 * NOTA: la clasificación se pide con "structured output" (responseSchema
 * con un enum de las categorías exactas), para que Gemini devuelva
 * siempre una de las categorías válidas en JSON, sin tener que parsear
 * texto libre ni depender de que el modelo "adivine" el formato.
 *
 * Si la IA no puede responder (clave no configurada, sin cuota, error
 * de red...), la incidencia se guarda como "Sin clasificar" para
 * revisarla a mano en la hoja, en vez de adivinar una categoría o
 * arriesgarse a perder el aviso.
 *
 * CONFIGURACIÓN (una sola vez):
 *  - Configuración del proyecto -> Propiedades del script:
 *      GEMINI_API_KEY = tu clave de la API de Gemini (Google AI Studio)
 *      SHEET_ID       = el ID de tu Google Sheet
 *      GEMINI_MODEL   = (opcional) modelo a usar, por defecto "gemini-2.5-flash"
 *  - Antes de activar el disparador automático, ejecuta
 *    testClasificacion() desde el editor y revisa
 *    Ver -> Registros de ejecución.
 *  - Disparador (trigger) de procesarReportes cada 10-15 min.
 ******************************************************************/

const PROPS = PropertiesService.getScriptProperties();
const SHEET_ID = PROPS.getProperty('SHEET_ID');
const GEMINI_API_KEY = PROPS.getProperty('GEMINI_API_KEY');
const GEMINI_MODEL = PROPS.getProperty('GEMINI_MODEL') || 'gemini-3.6-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

// Categoría de reserva cuando la IA no ha podido clasificar el aviso.
const CATEGORIA_SIN_CLASIFICAR = 'Sin clasificar';

// Red de seguridad ampliada a partir de ~590 partes reales de vigilancia
// que analizamos línea a línea (30/07/2026): cada patrón de aquí se
// comprobó contra esa muestra real y NO coincide con ningún incidente
// real (robo, daño, accidente, persona sospechosa...) de la muestra,
// solo con avisos rutinarios de apertura/cierre/mantenimiento. Deliberadamente
// NO se incluye la palabra suelta "ascensor" ni "mantenimiento" a secas:
// en la propia muestra hay accidentes reales de clientes que terminan
// mencionando "mantenimiento" o mencionan puertas de ascensor, y eso
// habría tapado el incidente real.
// Estas frases valen en cualquier posición del texto: son lo bastante
// específicas como para no aparecer nunca dentro de la descripción de un
// incidente real.
const OPERATIVA_KEYWORDS_CLARAS = [
  // Empresas de mantenimiento (ascensores, informática, walkies...).
  'schindler', 'schlinder', 'otis', 'kone', 'thyssenkrupp', 'thyssen',
  'sumtec', 'summtec',
  // Rondas y revisiones rutinarias.
  'ronda rutinaria', 'rondas rutinarias', 'ronda aleatoria', 'rondas aleatorias',
  'ronda exterior', 'ronda por baños', 'ronda por banos', 'ronda pk',
  'comprobación de cámaras', 'comprobacion de camaras',
  'revisión rutinaria', 'revision rutinaria',
  'revision de baños', 'revisión de baños', 'revision de banos',
  // Puesta en marcha de instalaciones (rampas, escaleras, ascensores):
  // frase idiomática muy específica, no aparece en descripciones de
  // incidentes reales en la muestra analizada.
  'en marcha',
  // Inicio/fin de turno y continuidad del parte (no son incidencias).
  'inicio del servicio', 'se inicia el servicio', 'inicio de servico', 'inicio el servicio',
  'continuedad del parte', 'continuo servicio',
  // Descansos y comidas del personal de vigilancia.
  'realiza descanso', 'descanso y cena', 'realiza cena',
  // Protocolo de carga/descarga de camiones (Mercadona, TMA, MGI...).
  'protocolo de camion', 'protocolo del camion', 'operativa descarga trailer',
  'operativa para descarga', 'descarga de camion de mercadona', 'descarga trailer mercadona',
  'recepcion de camion', 'recepción de camión', 'entra camion de compactadora', 'entra camión de compactadora',
  // Precierre/cierre progresivo del centro (jerga propia, sin ambigüedad).
  'precierre',
  // Bloqueo/desbloqueo de ascensores y escaleras por la noche (cubre
  // bloqueo/bloquean/bloquea/bloque, incluidas erratas como "acsensor").
  'bloque',
  // La propia palabra "operativa/operativo" (tarea operativa, sistema
  // operativo, puerta que "ya está operativa"...): en toda la muestra
  // real solo aparece en contextos de mantenimiento/logística, nunca
  // describiendo un incidente de seguridad.
  'operativ',
  // Fallo/salto de sistemas técnicos de seguridad sin incidencia real
  // confirmada (confirmado con el usuario: es Operativa, no Incidencia).
  'monitor de intrusion', 'monitor de intrusión',
  // Personas sin techo/en estado etílico: gestión rutinaria de vigilancia
  // (avisar, invitar a salir), confirmado con el usuario como Operativa.
  // RIESGO ACEPTADO: si alguna de estas personas protagonizara un
  // incidente real (agresión, hurto...), también se marcaría como
  // Operativa por esta palabra clave. En la muestra real revisada todos
  // los casos eran gestión rutinaria sin incidente asociado.
  'vagabundo', 'vagabundos', 'mendigo', 'mendigos', 'borracho', 'borrachos',
  // Objetos perdidos/encontrados: gestión rutinaria, confirmado con el
  // usuario como Operativa.
  'objetos perdidos', 'objeto perdido', 'armario de perdidos',
  // Basura/suciedad, confirmado con el usuario como Operativa incluso en
  // notas preventivas ("puede ocasionar algún incidente") o bolsas fuera
  // de sitio: mientras solo se describa suciedad/basura, sin que haya
  // pasado ya un incidente real, se gestiona como limpieza rutinaria.
  'basura', 'suciedad',
  // Recogida de carritos de Mercadona: frase concreta de logística, NO la
  // palabra suelta "carro/carrito" (confirmado con el usuario que "carro"
  // por sí solo no basta: si el aviso es sobre el COMPORTAMIENTO de
  // personas jugando con los carros, es Incidencia leve, no Operativa).
  'recoja carros', 'recojan carros', 'recoja los carros', 'recojan los carros',
  'recoger carros', 'recoger los carros', 'recogida de carritos', 'recogida de carros',
  'carritos por el exterior', 'mercadona de los carritos',
  // Mantenimiento rutinario de MUPIs (paneles publicitarios): se usa el
  // nombre del equipo ("mupi"), NO el nombre de la empresa que lo revisa
  // (ej. "Impacto"), porque "impacto" es una palabra peligrosa de usar
  // como clave suelta: también significa colisión en un accidente real.
  'mupi', 'mupis', 'muppis',
  // Peticiones de material administrativo a central, confirmado con el
  // usuario como Operativa.
  'hojas de control de llaves',
  // Caída/fallo de sistemas técnicos (cámaras, intrusión, control de
  // accesos), confirmado con el usuario como Operativa: es un fallo de
  // equipo, no un incidente causado por una persona.
  'vigiplus', 'caída del sistema', 'caida del sistema', 'caen los sistemas', 'cae el sistema',
  // Zona balizada retirada/movida durante la noche sin más contexto:
  // confirmado con el usuario como Operativa (organización de zona, no
  // vandalismo). Cubre baliza/balizada/balizado/balizan y la errata
  // "valizado".
  'baliza', 'valizado',
  // Acotar una zona con carteles/vallas: mismo tema que balizar, Operativa.
  'acotar',
  // Inicio del cierre del centro (variante de "cierre" que no abre la
  // frase con la palabra "cierre" en sí).
  'se inicia el cierre',
  // "Ronda" a secas: en toda la muestra revisada, esta palabra solo
  // aparece en frases de patrulla/vigilancia rutinaria (rondas por
  // galerías, ronda exterior, ronda aleatoria...), nunca describiendo un
  // incidente real. Sustituye a la lista de frases sueltas de más arriba
  // (que se mantienen por claridad, aunque ya sean redundantes).
  'ronda',
  // Coches aparcados sin más incidencia real (zona muelle, compactadoras,
  // conductor perdido...): confirmado con el usuario como Operativa.
  'coche aparcado',
  // Grabaciones/visitas de imágenes coordinadas de antemano con el
  // servicio: gestión administrativa, confirmado con el usuario como
  // Operativa.
  'imagenes ya acordadas', 'imágenes ya acordadas', 'grabacion de imagenes ya acordadas', 'grabación de imágenes ya acordadas',
  // Retirada de motos/vehículos mal aparcados con policía local/grúa: es
  // un aviso de normativa de aparcamiento, no un robo (aunque el modelo
  // de IA lo confundía con "un robo o hurto").
  'retirar las motos', 'retirar motos', 'retirada de motos',
  // Alguien grabando con el móvil sin más incidencia (se le habla y se
  // marcha): confirmado con el usuario como Operativa.
  'grabacion con movil', 'grabación con móvil',
  // Vehículo bloqueando una entrada, resuelto retirándolo: gestión de
  // acceso/tráfico, confirmado con el usuario como Operativa.
  'tapando la entrada', 'bloqueando la entrada', 'bloquea la entrada'
];

// Palabras/frases de acción operativa que solo son seguras como Operativa
// si ABREN la frase, tal como se ven en los partes reales: "APERTURA
// BARRERA SIGLO XXI", "SE ABRE MUELLE...", "SE CIERRAN COMPACTADORAS",
// "SE REALIZA EL CIERRE DE...", "RETIRADA DE PIES DE PROTOCOLO"... Si
// aparecieran a mitad de frase ("...tras la apertura de la puerta del
// coche") NO deben contar como Operativa, porque ahí sí podría formar
// parte de la descripción de un accidente real.
const OPERATIVA_PREFIJOS_CLAROS = [
  'apertura', 'cierre',
  'se abre', 'se abren', 'se cierra', 'se cierran',
  'se realiza el cierre', 'se realiza la apertura', 'se realiza cierre', 'se realiza apertura',
  'se efectua el cierre', 'se efectua la apertura', 'se efectua cierre', 'se efectua apertura',
  'se efectúa el cierre', 'se efectúa la apertura',
  'realiza el cierre', 'realiza la apertura', 'realiza cierre', 'realiza apertura',
  'se procede a realizar el cierre',
  'descanso',
  'retirada de pies de protocolo', 'retirada pies de protocolo',
  'coloco pies de protocolo', 'se coloca pies de protocolo'
];

// Palabras que, si aparecen junto a "jabonera(s)", indican que NO es una
// revisión rutinaria sino un daño o hurto real (ej. "HAN ROTO DOS
// JABONERAS...", "SUSTRACCION DE LA JABONERA..."). Sin esta excepción,
// tratar "jabonera" como palabra clave escondería esos incidentes reales.
var JABONERA_PALABRAS_RIESGO = ['roto', 'rota', 'rotas', 'rotos', 'falta', 'faltan', 'sustrac', 'hurto', 'robo'];

/**
 * Revisiones rutinarias de jaboneras/dispensadores de baño ("TODAS
 * JABONERAS DE LOS BAÑOS EN SU SITIO", "SE HACE REVISION DE LAS
 * JABONERAS Y ESTAN TODAS BIEN"): es Operativa salvo que el texto
 * indique rotura, falta o sustracción, en cuyo caso es un daño/hurto
 * real y debe seguir su camino normal (red de seguridad -> IA).
 */
function esRevisionJaboneras(t) {
  if (t.indexOf('jabonera') === -1) return false;
  return !JABONERA_PALABRAS_RIESGO.some(function (r) { return t.indexOf(r) !== -1; });
}

// Falsa alarma de un sistema técnico contra incendios (confirmado con el
// usuario: Operativa). OJO: NO es lo mismo que "falsa alarma" de una
// persona sospechosa (confirmado por separado como Incidencia leve), por
// eso se exige que aparezca junto a "alarma de incendio"/"alarma de los
// extintores" y no la palabra suelta "falsa alarma".
function esFalsaAlarmaTecnica(t) {
  var esAlarmaTecnica = t.indexOf('alarma de incendio') !== -1 || t.indexOf('alarma de los extintores') !== -1;
  return esAlarmaTecnica && t.indexOf('falsa alarma') !== -1;
}

// Regla general confirmada con el usuario: un aviso que SOLO describe la
// presencia de gente (sentados, etc.) sin mencionar ningún problema,
// riesgo o conducta problemática, es ronda/observación rutinaria
// (Operativa), no una incidencia de seguridad. Si aparece cualquier
// palabra de riesgo, esta regla NO se aplica y el texto sigue su camino
// normal (red de seguridad -> IA), porque entonces sí puede ser una
// incidencia real.
var PALABRAS_PRESENCIA_SIN_RIESGO = ['sentado', 'sentados', 'sentada', 'sentadas'];
var PALABRAS_RIESGO_PERSONA = [
  'peligro', 'peligroso', 'peligrosa', 'sospech', 'robo', 'roban', 'hurto',
  'agres', 'insult', 'amenaz', 'pelea', 'golpe', 'molest', 'increp',
  'discusion', 'discusión', 'conflicto', 'droga', 'vandal', 'daño', 'expulsa'
];
function esObservacionSinRiesgo(t) {
  var hayPresencia = PALABRAS_PRESENCIA_SIN_RIESGO.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayPresencia) return false;
  return !PALABRAS_RIESGO_PERSONA.some(function (p) { return t.indexOf(p) !== -1; });
}

// Rampa/escalera mecánica parada o averiada, sin ninguna persona
// afectada: confirmado con el usuario como Operativa.
var PALABRAS_EQUIPO_MOVIL = ['rampa', 'escalera mecanica', 'escalera mecánica', 'escaleras mecanicas', 'escaleras mecánicas'];
var PALABRAS_EQUIPO_PARADO = ['se ha parado', 'esta parada', 'está parada', 'esta parado', 'está parado'];
function esEquipoParado(t) {
  var hayEquipo = PALABRAS_EQUIPO_MOVIL.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayEquipo) return false;
  return PALABRAS_EQUIPO_PARADO.some(function (p) { return t.indexOf(p) !== -1; });
}

function esOperativaClara(desc) {
  var t = (desc || '').trim().toLowerCase();
  if (OPERATIVA_KEYWORDS_CLARAS.some(function (k) { return t.indexOf(k) !== -1; })) return true;
  if (esRevisionJaboneras(t)) return true;
  if (esFalsaAlarmaTecnica(t)) return true;
  if (esEquipoParado(t)) return true;
  if (esObservacionSinRiesgo(t)) return true;
  if (esRevisionBanosCorrecta(t)) return true;
  return OPERATIVA_PREFIJOS_CLAROS.some(function (p) { return t.indexOf(p) === 0; });
}

// Red de seguridad para accidentes REALES de persona (confirmado con el
// usuario): si el texto describe claramente que alguien se ha caído/
// resbalado Y hay señal de lesión, se decide la categoría exacta por
// contexto en vez de dejarlo solo en manos de la IA, que confundía estos
// casos con "Danys" (ver caso del ascensor). Si no hay señal de lesión
// clara, se deja pasar a la IA (puede ser una caída sin consecuencia,
// mejor que decida ella con más matices).
var PALABRAS_CAIDA_PERSONA = [
  'se ha caído', 'se ha caido', 'se cae', 'resbala', 'tropieza',
  'sufre una caída', 'sufre una caida', 'se ha mareado', 'se marea'
];
var PALABRAS_LESION = [
  'golpe', 'golpead', 'herid', 'sangr', 'lesion', 'lesión', 'dolor',
  'raspadura', 'raspaduras', 'ambulancia'
];
var PALABRAS_EMPLEADO_CENTRO = [
  'empleado', 'empleada', 'trabajador', 'trabajadora',
  'personal de limpieza', 'operario', 'operaria'
];
var PALABRAS_LUGAR_PARKING = ['parking', 'aparcamiento', 'parkin', 'pk-', 'pk '];

/**
 * Devuelve la categoría si el texto describe con claridad un accidente
 * real de persona, o null si no hay señal suficiente y debe decidir la IA.
 * Confirmado con el usuario: si la caída es de un CLIENTE en el parking,
 * cuenta como Accident Parking aunque no se mencione lesión explícita
 * (la propia caída en esa zona ya es motivo suficiente). Para empleados o
 * para el resto del centro (Accident CC) sí hace falta una señal de
 * lesión clara, porque ahí una mención de caída sin más contexto es
 * demasiado ambigua.
 */
function categoriaAccidentePersonaClaro(desc) {
  var t = (desc || '').toLowerCase();
  var hayCaida = PALABRAS_CAIDA_PERSONA.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayCaida) return null;
  var hayLesion = PALABRAS_LESION.some(function (p) { return t.indexOf(p) !== -1; });
  if (PALABRAS_EMPLEADO_CENTRO.some(function (p) { return t.indexOf(p) !== -1; })) {
    return hayLesion ? 'Accident CC' : null;
  }
  if (PALABRAS_LUGAR_PARKING.some(function (p) { return t.indexOf(p) !== -1; })) return 'Accident Parking';
  return hayLesion ? 'Accident CC' : null;
}

// Robo en grado de tentativa/intención (confirmado con el usuario: cuenta
// como Robatori aunque no se llegue a consumar el hurto).
var PALABRAS_INTENTO_ROBO = [
  'intentan hurtar', 'intentando robar', 'intentan robar',
  'intento de robo', 'intento de hurto', 'intenciones de robar',
  'intenciones de cometer un robo', 'intenciones de cometer algun robo',
  'intenciones de cometer algún robo'
];
function esIntentoRoboClaro(desc) {
  var t = (desc || '').toLowerCase();
  return PALABRAS_INTENTO_ROBO.some(function (p) { return t.indexOf(p) !== -1; });
}

// Hurto ya consumado (no solo intento): el cliente se lleva algo sin
// pagar, se confirma la sustracción, etc. Confirmado con el usuario:
// cuenta como Robatori en vez de caer en el catch-all "Accident CC" de
// la IA cuando el hurto ya se ha consumado.
var PALABRAS_HURTO_CONSUMADO = [
  'sin pagar', 'se van sin pagar', 'se va sin pagar', 'se marcha sin pagar',
  'han hurtado', 'ha hurtado', 'le han robado', 'le ha robado', 'han robado',
  'ha robado', 'hurtan', 'hurta', 'roban', 'sustraen', 'sustrae',
  'sustraccion', 'sustracción', 'ladrona', 'ladron', 'ladrón', 'carterista',
  'carteristas'
];
function esHurtoConsumadoClaro(desc) {
  var t = (desc || '').toLowerCase();
  return PALABRAS_HURTO_CONSUMADO.some(function (p) { return t.indexOf(p) !== -1; });
}

// Daño a un vehículo (propio o de un cliente), confirmado con el usuario
// como Accident Parking en vez de Danys, aunque el coche sea la víctima
// del daño (ej. "les han roto un vidrio del coche") y no la causa.
var PALABRAS_VEHICULO = ['vehículo', 'vehiculo', 'coche', 'coches'];
var PALABRAS_ROTURA_VEHICULO = ['roto', 'rota', 'rotas', 'rotos', 'romper', 'rompen', 'dañado', 'dañada'];
function esDanyVehiculoClaro(desc) {
  var t = (desc || '').toLowerCase();
  var hayVehiculo = PALABRAS_VEHICULO.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayVehiculo) return false;
  return PALABRAS_ROTURA_VEHICULO.some(function (p) { return t.indexOf(p) !== -1; });
}

// Bullying/acoso a un menor: confirmado con el usuario como Incidència
// Baixa pero con gravedad Alta (no la gravedad estándar de esa
// categoría), por tratarse de una víctima especialmente vulnerable.
var PALABRAS_BULLYING = ['bullying', 'buling', 'bulling', 'acoso'];
function esBullyingClaro(desc) {
  var t = (desc || '').toLowerCase();
  return PALABRAS_BULLYING.some(function (p) { return t.indexOf(p) !== -1; });
}

// Accidente en el Karting (atracción DENTRO del centro comercial, no en
// el parking): confirmado con el usuario como Accident CC siempre que se
// mencione una ambulancia o un accidente, para no depender de que la IA
// acierte la sub-categoría correcta (parking vs CC).
function esAccidenteKartingClaro(desc) {
  var t = (desc || '').toLowerCase();
  if (t.indexOf('karting') === -1) return false;
  return t.indexOf('ambulancia') !== -1 || t.indexOf('accidente') !== -1;
}

// Cartel/cartelería caída avisada a la empresa responsable, sin mención
// de ninguna persona afectada: confirmado con el usuario como Operativa
// (mantenimiento), no Danys. Se comprueba DESPUÉS de
// categoriaAccidentePersonaClaro (no aquí en esOperativaClara) para que,
// si el texto también describe una persona real cayéndose/lesionada por
// culpa del cartel, gane esa regla primero y esta no la tape.
function esCartelCaidoClaro(desc) {
  var t = (desc || '').toLowerCase();
  if (t.indexOf('cartel') === -1) return false; // cubre cartel/cartelera/cartelería
  return t.indexOf('caid') !== -1 || t.indexOf('caíd') !== -1; // caido/caida/caídos/caídas
}

// Revisión de baños/lavabos/aseos con resultado "todo correcto": mismo
// espíritu que las jaboneras, confirmado con el usuario como Operativa.
// Requiere la palabra "correcto" para no afectar a incidentes reales que
// ocurren en un baño sin ser sobre su estado (ej. el mirón en el baño de
// mujeres), que no mencionan ese resultado de revisión.
var PALABRAS_BANOS = ['baño', 'baños', 'lavabo', 'lavabos', 'aseo', 'aseos'];
function esRevisionBanosCorrecta(desc) {
  var t = (desc || '').toLowerCase();
  var hayBano = PALABRAS_BANOS.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayBano) return false;
  return t.indexOf('correcto') !== -1;
}

/**
 * Punto de entrada único de clasificación: primero la red de seguridad
 * por palabras clave (Operativa), luego el patrón de accidente real de
 * persona, luego la IA, y si la IA falla, "Sin clasificar". La usan tanto
 * procesarReportes() como testClasificacion(), para que lo que se prueba
 * manualmente sea exactamente lo que se ejecuta de verdad.
 */

/* --- REGLAS ADICIONALES (revision completa 2026-08-17, a peticion del
 * usuario tras detectar errores sistematicos de categorizacion) ---
 * Se revisaron a mano las incidencias "relevantes" (Robatori, Danys,
 * Accident CC, Accident Parking) ya guardadas y se detectaron patrones
 * repetidos que la IA zero-shot clasificaba mal: caidas/accidentes con
 * erratas no cubiertas por las listas existentes, notas administrativas
 * o de mantenimiento que se confundian con Danys/Accident Parking/CC,
 * comportamiento incivico sin incidente real que caia en Accident CC, y
 * danos a vehiculos que a veces caian en Accident Parking en vez de
 * Danys. Mismo criterio que el resto del fichero: solo decide una regla
 * lo que es inequivoco; el resto sigue su camino normal (reglas -> IA).
 */

var PALABRAS_ACCIDENTE_AMPLIADO = [
  'se a caido', 'se a caído', 'se accidenta', 'se accidento', 'se accidentó',
  'accidentada', 'accidentado', 'cae al suelo', 'se desploma', 'pierde el equilibrio'
];
var PALABRAS_LESION_AMPLIADO = [
  'mareada', 'mariada', 'mareado', 'con dolores', 'raspaduras', 'contusion', 'contusión',
  'se golpea la cabeza', 'golpe en la cara'
];
function esAccidentePersonaAmpliado(desc) {
  var t = (desc || '').toLowerCase();
  var hayCaida = PALABRAS_CAIDA_PERSONA.some(function (p) { return t.indexOf(p) !== -1; }) ||
    PALABRAS_ACCIDENTE_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; });
  if (!hayCaida) return null;
  var hayLesion = PALABRAS_LESION.some(function (p) { return t.indexOf(p) !== -1; }) ||
    PALABRAS_LESION_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; }) ||
    t.indexOf('ambulancia') !== -1;
  if (!hayLesion) return null;
  if (PALABRAS_LUGAR_PARKING.some(function (p) { return t.indexOf(p) !== -1; })) return 'Accident Parking';
  return 'Accident CC';
}

var PALABRAS_HURTO_AMPLIADO = [
  'cogen algo y se van', 'cogido algo y se van', 'se llevan sin abonar',
  'se llevan la mercancia', 'se llevan la mercancía'
];
function esHurtoAmpliadoClaro(desc) {
  var t = (desc || '').toLowerCase();
  return PALABRAS_HURTO_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; });
}

var PALABRAS_VEHICULO_AMPLIADO = ['vehiculo', 'vehículo', 'coche', 'furgoneta', 'moto', 'motocicleta', 'camion', 'camión'];
var PALABRAS_ROTURA_VEHICULO_AMPLIADO = [
  'roto', 'rota', 'rompen', 'rompe', 'rompio', 'rompió', 'rompieron',
  'golpe en la columna', 'ha dado un golpe', 'golpe en el', 'cristal roto', 'ventanilla', 'vidrio'
];
var PALABRAS_LESION_PERSONA_ESTRICTA = ['herid', 'sangr', 'lesion', 'lesión', 'dolor', 'raspadura', 'raspaduras', 'ambulancia'];
function esDanyVehiculoAmpliado(desc) {
  var t = (desc || '').toLowerCase();
  if (!PALABRAS_VEHICULO_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  if (!PALABRAS_ROTURA_VEHICULO_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  if (PALABRAS_LESION_PERSONA_ESTRICTA.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  if (PALABRAS_ACCIDENTE_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  return true;
}

var PALABRAS_ROTURA_OBJETO_CLARA = [
  'han roto', 'ha roto', 'rompen', 'rompe la', 'rompio', 'rompió',
  'roto un cristal', 'roto una', 'rotura de', 'pinchan', 'pincha',
  'vandalizan', 'vandalizado', 'destrozan', 'destrozado'
];
function esRoturaObjetoClara(desc) {
  var t = (desc || '').toLowerCase();
  if (!PALABRAS_ROTURA_OBJETO_CLARA.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  return !PALABRAS_HURTO_CONSUMADO.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_LESION_PERSONA_ESTRICTA.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_ACCIDENTE_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_CAIDA_PERSONA.some(function (p) { return t.indexOf(p) !== -1; });
}

var PALABRAS_ALTERCADO_CLARO = [
  'peleandose', 'peleándose', 'pelea entre', 'se pelean', 'se estan pegando', 'se están pegando'
];
function esAltercadoSinLesionClaro(desc) {
  var t = (desc || '').toLowerCase();
  if (!PALABRAS_ALTERCADO_CLARO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  return !PALABRAS_LESION.some(function (p) { return t.indexOf(p) !== -1; });
}

var PALABRAS_INCIVICO_CLARO = [
  'vapeando', 'vapear', 'vapeo', 'jugando con los carros', 'jugando con carros',
  'corriendo por el centro', 'pidiendo limosna', 'mendigando', 'ocupando todo el pasillo',
  'impidiendo el paso', 'toqueteando', 'molestando a los clientes'
];
function esComportamientoIncivicoClaro(desc) {
  var t = (desc || '').toLowerCase();
  if (!PALABRAS_INCIVICO_CLARO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  return !PALABRAS_LESION.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_HURTO_CONSUMADO.some(function (p) { return t.indexOf(p) !== -1; }) &&
    t.indexOf('roto') === -1 && t.indexOf('rota') === -1 && t.indexOf('dañ') === -1 && t.indexOf('dany') === -1;
}

var PALABRAS_OPERATIVA_AMPLIADO = [
  'termina de reparar', 'acaba de reparar', 'ya reparado', 'reparado correctamente',
  'bajada de persiana', 'subida de persiana', 'desconecto', 'desconecta',
  'pongo vallas', 'coloco vallas', 'colocamos vallas', 'pone vallas',
  'hay carros por todo el centro', 'entran operarios', 'entro dos operarios',
  'entran dos operarios', 'operarios con escaleras', 'trabajando en la sala',
  'montando unas estanterias', 'montando unas estanterías', 'informo a gerencia',
  'se informa a gerencia', 'realizo via baja', 'realiza via baja', 'no hay plazas',
  'excremento'
];
function esOperativaAmpliada(desc) {
  var t = (desc || '').toLowerCase();
  if (!PALABRAS_OPERATIVA_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; })) return false;
  return !PALABRAS_RIESGO_PERSONA.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_HURTO_CONSUMADO.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_CAIDA_PERSONA.some(function (p) { return t.indexOf(p) !== -1; }) &&
    !PALABRAS_ACCIDENTE_AMPLIADO.some(function (p) { return t.indexOf(p) !== -1; });
}

function clasificarIncidencia(desc) {
  if (esOperativaClara(desc)) {
    Logger.log('Red de seguridad: coincide con palabra clave operativa -> Operativa');
    return { categoria: 'Operativa', gravedad: 'Baja' };
  }
    if (esOperativaAmpliada(desc)) {
    Logger.log('Red de seguridad (ampliada): nota administrativa/mantenimiento -> Operativa');
    return { categoria: 'Operativa', gravedad: 'Baja' };
  }
  var categoriaAccidenteAmpliado = esAccidentePersonaAmpliado(desc);
  if (categoriaAccidenteAmpliado) {
    Logger.log('Red de seguridad (ampliada): patron de accidente de persona -> ' + categoriaAccidenteAmpliado);
    return { categoria: categoriaAccidenteAmpliado, gravedad: CATEGORIA_A_GRAVEDAD[categoriaAccidenteAmpliado] };
  }
  if (esHurtoAmpliadoClaro(desc)) {
    Logger.log('Red de seguridad (ampliada): patron de hurto -> Robatori');
    return { categoria: 'Robatori', gravedad: CATEGORIA_A_GRAVEDAD['Robatori'] };
  }
  if (esDanyVehiculoAmpliado(desc)) {
    Logger.log('Red de seguridad (ampliada): dano a vehiculo -> Danys');
    return { categoria: 'Danys', gravedad: CATEGORIA_A_GRAVEDAD['Danys'] };
  }
  if (esRoturaObjetoClara(desc)) {
    Logger.log('Red de seguridad (ampliada): objeto dañado/roto -> Danys');
    return { categoria: 'Danys', gravedad: CATEGORIA_A_GRAVEDAD['Danys'] };
  }
  if (esAltercadoSinLesionClaro(desc)) {
    Logger.log('Red de seguridad (ampliada): altercado sin lesion -> Incidencia leve (Alta)');
    return { categoria: 'Incidència Baixa', gravedad: 'Alta' };
  }
  if (esComportamientoIncivicoClaro(desc)) {
    Logger.log('Red de seguridad (ampliada): comportamiento incivico sin incidente real -> Incidencia leve');
    return { categoria: 'Incidència Baixa', gravedad: CATEGORIA_A_GRAVEDAD['Incidència Baixa'] };
  }
  var categoriaAccidente = categoriaAccidentePersonaClaro(desc);
  if (categoriaAccidente) {
    Logger.log('Red de seguridad: coincide con patrón de accidente de persona -> ' + categoriaAccidente);
    return { categoria: categoriaAccidente, gravedad: CATEGORIA_A_GRAVEDAD[categoriaAccidente] };
  }
  if (esIntentoRoboClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patrón de intento de robo -> Robatori');
    return { categoria: 'Robatori', gravedad: CATEGORIA_A_GRAVEDAD['Robatori'] };
  }
  if (esHurtoConsumadoClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patron de hurto consumado -> Robatori');
    return { categoria: 'Robatori', gravedad: CATEGORIA_A_GRAVEDAD['Robatori'] };
  }
  if (esDanyVehiculoClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patrón de daño a vehículo -> Accident Parking');
    return { categoria: 'Accident Parking', gravedad: CATEGORIA_A_GRAVEDAD['Accident Parking'] };
  }
  if (esBullyingClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patrón de bullying/acoso -> Incidència Baixa (Alta)');
    return { categoria: 'Incidència Baixa', gravedad: 'Alta' };
  }
  if (esAccidenteKartingClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patrón de accidente en el Karting -> Accident CC');
    return { categoria: 'Accident CC', gravedad: CATEGORIA_A_GRAVEDAD['Accident CC'] };
  }
  if (esCartelCaidoClaro(desc)) {
    Logger.log('Red de seguridad: coincide con patrón de cartel caído -> Operativa');
    return { categoria: 'Operativa', gravedad: 'Baja' };
  }
  var resultado = clasificarConIA(desc);
  if (resultado) return resultado;
  return { categoria: CATEGORIA_SIN_CLASIFICAR, gravedad: 'Media' };
}

/* === CLASIFICACIÓN (Google Gemini) =================== */

// Categorías reales que usa la web (js/app.js) y su descripción para el
// prompt de Gemini. Mismo criterio que con el modelo anterior: frases
// cortas y sin ejemplos incrustados, para no liar al modelo con casos
// límite que ya cubre la red de palabras clave (sobre todo Operativa).
// OJO: "Incidència Baixa" lleva tilde en la "è" (grafía catalana) — la
// web compara este valor de forma exacta en varios sitios.
// IMPORTANTE: NO se incluye "Accident Laboral" como categoría de la IA.
// Se decide EXCLUSIVAMENTE por la regla de palabras clave
// (categoriaAccidentePersonaClaro), nunca por la IA.
var CATEGORIAS_GEMINI = [
  { categoria: 'Robatori', descripcion: 'un robo o hurto, consumado o en grado de tentativa' },
  { categoria: 'Danys', descripcion: 'daños materiales o vandalismo, sin ninguna persona herida' },
  { categoria: 'Accident Parking', descripcion: 'un accidente sufrido por una persona dentro del parking o aparcamiento' },
  { categoria: 'Accident CC', descripcion: 'un accidente sufrido por una persona dentro del centro comercial, fuera del parking' },
  { categoria: 'Incidència Baixa', descripcion: 'una incidencia de seguridad leve: conducta problemática, altercado, persona sospechosa, etc.' },
  { categoria: 'Operativa', descripcion: 'una tarea operativa o de mantenimiento rutinaria del centro' }
];
var CATEGORIA_A_GRAVEDAD = {
  'Robatori': 'Alta',
  'Danys': 'Media',
  'Accident Parking': 'Media',
  'Accident CC': 'Media',
  'Incidència Baixa': 'Media',
  'Operativa': 'Baja'
};

/**
 * Clasifica un texto llamando exclusivamente a Gemini. Devuelve
 * {categoria, gravedad} o null si la IA no ha podido clasificar (quien
 * llame decide qué hacer; no hay respaldo por reglas).
 */
function clasificarConIA(desc) {
  if (!GEMINI_API_KEY) {
    Logger.log('GEMINI_API_KEY no configurada en Propiedades del script.');
    return null;
  }
  try {
    var nombresCategorias = CATEGORIAS_GEMINI.map(function (c) { return c.categoria; });
    var descripcionCategorias = CATEGORIAS_GEMINI.map(function (c) {
      return '- ' + c.categoria + ': ' + c.descripcion;
    }).join('\n');

    var prompt = 'Eres un clasificador de partes de seguridad de un centro comercial. ' +
      'Lee el siguiente aviso y elige EXACTAMENTE una categoría de esta lista:\n' +
      descripcionCategorias +
      '\n\nAviso:\n"' + desc + '"';

    var payloadObj = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            categoria: { type: 'STRING', enum: nombresCategorias }
          },
          required: ['categoria']
        }
      }
    };
    var payloadStr = JSON.stringify(payloadObj);
    Logger.log('Enviando a Gemini: ' + payloadStr.slice(0, 300));

    // Reintentos con backoff para errores temporales de Gemini (429 = límite
    // de peticiones, 503 = modelo con mucha demanda): ambos suelen resolverse
    // solos en pocos segundos, así que merece la pena reintentar antes de
    // rendirse y marcar la incidencia como "Sin clasificar". Otros códigos
    // (401, 404...) no son temporales y no tiene sentido reintentarlos.
    var codigo, cuerpo;
    var intentosMax = 3;
    var esperaMs = 1000;
    for (var intento = 1; intento <= intentosMax; intento++) {
      var respuesta = UrlFetchApp.fetch(GEMINI_URL + '?key=' + GEMINI_API_KEY, {
        method: 'post',
        contentType: 'application/json',
        payload: payloadStr,
        muteHttpExceptions: true
      });
      codigo = respuesta.getResponseCode();
      cuerpo = respuesta.getContentText();
      Logger.log('Gemini respondió (' + codigo + '): ' + cuerpo.slice(0, 500));
      var esErrorTemporal = codigo === 429 || codigo === 503;
      if (!esErrorTemporal || intento === intentosMax) break;
      Logger.log('Error temporal de Gemini (' + codigo + '), reintentando en ' + esperaMs +
        'ms (intento ' + (intento + 1) + '/' + intentosMax + ')...');
      Utilities.sleep(esperaMs);
      esperaMs *= 2;
    }
    if (codigo !== 200) {
      return null;
    }

    var datos = JSON.parse(cuerpo);
    var texto = datos && datos.candidates && datos.candidates[0] &&
      datos.candidates[0].content && datos.candidates[0].content.parts &&
      datos.candidates[0].content.parts[0] && datos.candidates[0].content.parts[0].text;
    if (!texto) {
      Logger.log('Respuesta de Gemini sin contenido reconocible (posible bloqueo por safety o corte por longitud).');
      return null;
    }

    var resultado = JSON.parse(texto);
    var categoria = resultado && resultado.categoria;
    if (!CATEGORIA_A_GRAVEDAD.hasOwnProperty(categoria)) {
      Logger.log('Categoría de Gemini no reconocida: ' + categoria);
      return null;
    }
    Logger.log('IA (Gemini): "' + categoria + '"');
    return { categoria: categoria, gravedad: CATEGORIA_A_GRAVEDAD[categoria] };
  } catch (e) {
    Logger.log('Excepción llamando a Gemini: ' + e);
    return null;
  }
}

// Ejecuta esto manualmente (▶ Ejecutar -> testClasificacion) y revisa
// Ver -> Registros de ejecución antes de activar el disparador automático.
// Prueba clasificarIncidencia() (red de seguridad + IA), el mismo camino
// que sigue procesarReportes() con avisos reales.
function testClasificacion() {
  var ejemplos = [
    'Se avisa a Schindler porque el ascensor de la zona norte no funciona correctamente',
    'Un cliente ha robado varias prendas de la tienda sin pagar',
    'Se ha roto una farola en el aparcamiento tras el golpe de un vehículo',
    'Un cliente se ha caído dentro del ascensor de la planta 1 y se ha golpeado',
    'Ronda rutinaria de comprobación de cámaras',
    'La empleada de limpieza se ha mareado y caído, con raspaduras en manos y codos'
  ];
  ejemplos.forEach(function (desc) {
    Logger.log(desc + '  =>  ' + JSON.stringify(clasificarIncidencia(desc)));
  });
}

// A diferencia de testClasificacion(), este texto no coincide con ninguna
// palabra clave de la red de seguridad, así que fuerza a que se llame de
// verdad a clasificarConIA() (Gemini) en vez de que lo resuelva la red de
// palabras clave. Útil para comprobar que GEMINI_API_KEY/GEMINI_MODEL
// están bien configurados tras un despliegue nuevo.
function testGemini() {
  var texto = 'Un cliente comenta que ha visto una situación que le ha resultado extraña en la tienda de la planta baja.';
  Logger.log(JSON.stringify(clasificarConIA(texto)));
}

/* === CORRECCIÓN ORTOGRÁFICA BÁSICA (no clasifica, solo limpia texto) === */

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
    [/\bhechar\b/gi, "echar"],
    [/\baver\b/gi, "a ver"],
    [/\basido\b/gi, "ha sido"],
    [/\bpolicia\b/gi, "policía"],
    [/\bvehiculo\b/gi, "vehículo"],
    [/\brapido\b/gi, "rápido"],
    [/\bcamara\b/gi, "cámara"],
    [/\bcamaras\b/gi, "cámaras"],
    // Erratas recurrentes detectadas en los partes reales.
    [/\bimprisa\b/gi, "empresa"],
    [/\bocacionar\b/gi, "ocasionar"],
    [/\bpelegro\b/gi, "peligro"],
    [/\brevicion\b/gi, "revisión"],
    [/\bpercianas\b/gi, "persianas"],
    [/\bperciana\b/gi, "persiana"],
    [/\bsierre\b/gi, "cierre"],
    [/\bacsensor\b/gi, "ascensor"],
    [/\basensor\b/gi, "ascensor"],
    [/\bhambulancia\b/gi, "ambulancia"],
    [/\bmenosres\b/gi, "menores"],
    [/\bopcupando\b/gi, "ocupando"],
    [/\bimpedindo\b/gi, "impidiendo"],
    [/\bbulnerable\b/gi, "vulnerable"],
    [/\bindibiduo\b/gi, "individuo"],
    [/\bexcluxivos\b/gi, "exclusivos"],
    [/\bresibe\b/gi, "recibe"],
    [/  +/g, " "]
  ];
  for (var i = 0; i < reglas.length; i++) {
    s = s.replace(reglas[i][0], reglas[i][1]);
  }
  s = s.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, function (m, p1, p2) { return p1 + p2.toUpperCase(); });
  return s.trim();
}

/* === LECTURA Y GUARDADO DE REPORTES ============================= */

function procesarReportes() {
  // Los asuntos reales observados son variados: "RV: Comunicat al servei
  // #NNNNNN - CBRE CENTRE COMERCIAL VILAMARINA-VS" (catalán) e
  // "RV: Incidencias de Servicios #NNNNNN - CBRE CENTRE COMERCIAL
  // VILAMARINA-VS" (castellano). Ni "Comunicado en el servicio" ni
  // "serviap.cat" aparecen como texto visible en estos, así que
  // GmailApp.search no los encontraba y se quedaban sin procesar para
  // siempre. Lo único común a todos los asuntos vistos hasta ahora es
  // "VILAMARINA-VS", así que se busca por ahí. El enlace del informe
  // (serviap.cat) que no lleven se descarta más abajo igualmente
  // (si (!um) continue), así que ampliar la búsqueda no añade riesgo.
  var msgs = GmailApp.search('is:unread subject:"VILAMARINA-VS"', 0, 50);
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
      if (!texto) { Logger.log('Reporte ' + (procesados + 1) + ': no se pudo extraer texto'); continue; }
      var idxDes = texto.toUpperCase().indexOf("DESARROLLO");
      var cuerpo = (idxDes >= 0) ? texto.slice(idxDes + "DESARROLLO".length) : texto;
      // Cada entrada empieza con fecha (dd/mm/yyyy) + hora (hh:mm) + autor,
      // y su descripción va hasta la siguiente cabecera fecha-hora o el final.
      var re = /(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})[^\n]*\n([\s\S]*?)(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}|$)/g;
      var mm, count = 0;
      while ((mm = re.exec(cuerpo)) !== null) {
        var fecha = mm[1];
        var hora = mm[2];
        var desc = (mm[3] || "").replace(/\s+/g, " ").trim();
        desc = desc.replace(/\s*(Enviar a e-?mail|Imprimir|Descargar PDF)\s*/gi, " ").trim();
        if (!desc) continue;
        var up = desc.toUpperCase();
        // Descartar líneas de control de servicio/jornada (no son incidencias).
        if (/(INICI|FINALIZ|FIN|TERMIN|ACABA)\w*\s+(DE\s+)?(SERVICIO|JORNADA|TURNO)/.test(up) ||
            up.indexOf("INICIO SERVICIO") !== -1 || up.indexOf("FINALIZO SERVICIO") !== -1 ||
            up.indexOf("FINALIZ") !== -1) continue;

        var textoFinal = corregirOrtografia(desc);
        var analisis = clasificarIncidencia(textoFinal);

        guardarIncidencia({
          fecha: fecha,
          hora: hora,
          gravedad: analisis.gravedad,
          categoria: analisis.categoria,
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
    const html = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true }).getContentText();
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<br\s*\/?>/gi, '\n')
               .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
               .replace(/<[^>]+>/g, ' ')
               .replace(/&nbsp;/g, ' ')
               .replace(/[ \t\f\v]+/g, ' ')
               .replace(/ *\n */g, '\n')
               .replace(/\n{2,}/g, '\n')
               .trim();
  } catch (e) {
    Logger.log('Error extrayendo reporte: ' + e);
    return null;
  }
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

/* === LIMPIEZA ÚNICA: reclasificar filas ya guardadas =============
   Vuelve a pasar cada fila existente por clasificarIncidencia() (la
   misma red de seguridad + IA que usa procesarReportes) y actualiza
   categoría y gravedad donde cambien. Pensado para corregir avisos
   antiguos clasificados con la versión anterior del script.

   Ejecútala manualmente (▶ Ejecutar -> reclasificarHistorico). Como
   Apps Script corta cualquier ejecución a los 6 minutos, la función
   procesa filas hasta acercarse a ese límite (margen de seguridad:
   TIEMPO_LIMITE_MS) y recuerda por dónde se quedó (en Propiedades del
   script), en vez de parar en un número fijo de filas. Si tu hoja
   tiene pocos cientos de filas, normalmente basta con un solo clic;
   si el log dice "Quedan filas por procesar", vuelve a pulsar
   Ejecutar y continuará donde lo dejó. Si quieres volver a repasar
   todo desde el principio, ejecuta antes
   reiniciarReclasificacionHistorico(). */

var TIEMPO_LIMITE_MS = 5 * 60 * 1000; // margen de seguridad bajo el límite de 6 min de Apps Script
var PROP_ULTIMA_FILA_RECLASIFICADA = 'RECLASIFICAR_ULTIMA_FILA';

function reclasificarHistorico() {
  var inicioEjecucion = new Date().getTime();
  var hoja = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var datos = hoja.getDataRange().getValues();
  var inicio = 0;
  if (datos.length > 0 && !(datos[0][0] instanceof Date)) {
    inicio = 1; // fila 0 es cabecera
  }
  if (datos.length <= inicio) {
    Logger.log('No hay filas de datos que reclasificar.');
    return;
  }

  var ultimaFila = parseInt(PROPS.getProperty(PROP_ULTIMA_FILA_RECLASIFICADA) || String(inicio - 1), 10);
  var desde = Math.max(ultimaFila + 1, inicio);
  if (desde > datos.length - 1) {
    Logger.log('Reclasificación histórica: no quedan filas por procesar. Si quieres repetirlo, ejecuta reiniciarReclasificacionHistorico().');
    return;
  }

  var actualizadas = 0, sinCambios = 0, vacias = 0;
  var i = desde;
  var agotado = false;
  for (; i <= datos.length - 1; i++) {
    if (new Date().getTime() - inicioEjecucion > TIEMPO_LIMITE_MS) {
      agotado = true;
      break;
    }
    var f = datos[i];
    // Columnas (según guardarIncidencia): 0 marca, 1 fecha, 2 hora,
    // 3 gravedad, 4 categoria, 5 resumen, 6 estado, 7 original, 8 enlace.
    var textoOriginal = f[7] || f[5];
    if (!textoOriginal) { vacias++; continue; }

    // Se corrige la ortografía ANTES de clasificar (mismo orden que
    // procesarReportes): así "IMPRISA IMPACTO" se convierte en "EMPRESA
    // IMPACTO" antes de que la IA/red de palabras clave la vea, en vez de
    // clasificar sobre el texto con la errata.
    var textoCorregido = corregirOrtografia(textoOriginal);
    var categoriaActual = f[4];
    var gravedadActual = f[3];
    var resultado = clasificarIncidencia(textoCorregido);

    var huboCambioCategoria = resultado.categoria !== categoriaActual || resultado.gravedad !== gravedadActual;
    var huboCorreccionTexto = textoCorregido !== textoOriginal;
    if (huboCambioCategoria) {
      hoja.getRange(i + 1, 5).setValue(resultado.categoria); // columna E
      hoja.getRange(i + 1, 4).setValue(resultado.gravedad);  // columna D
    }
    if (huboCorreccionTexto) {
      hoja.getRange(i + 1, 6).setValue(textoCorregido.slice(0, 250));  // columna F (resumen)
      hoja.getRange(i + 1, 8).setValue(textoCorregido.slice(0, 1000)); // columna H (original)
    }
    if (huboCambioCategoria || huboCorreccionTexto) {
      actualizadas++;
      Logger.log('Fila ' + (i + 1) + ': "' + categoriaActual + '/' + gravedadActual + '" -> "' +
        resultado.categoria + '/' + resultado.gravedad + '"' + (huboCorreccionTexto ? ' (texto corregido)' : ''));
    } else {
      sinCambios++;
    }
    Utilities.sleep(300);
  }
  var hasta = agotado ? i - 1 : datos.length - 1;

  PROPS.setProperty(PROP_ULTIMA_FILA_RECLASIFICADA, String(hasta));
  Logger.log('Filas ' + (desde + 1) + ' a ' + (hasta + 1) + ' de ' + datos.length + ' procesadas. ' +
    'Actualizadas: ' + actualizadas + ' · Sin cambios: ' + sinCambios + ' · Vacías: ' + vacias + '.');
  if (hasta < datos.length - 1) {
    Logger.log('Quedan filas por procesar (se acabó el tiempo de esta ejecución): vuelve a ejecutar reclasificarHistorico() para continuar.');
  } else {
    Logger.log('Reclasificación histórica completa: no quedan más filas.');
  }
}

// Ejecútala una vez si quieres que reclasificarHistorico() vuelva a
// revisar todas las filas desde el principio (por ejemplo, tras cambiar
// las palabras clave o el modelo de IA).
function reiniciarReclasificacionHistorico() {
  PROPS.deleteProperty(PROP_ULTIMA_FILA_RECLASIFICADA);
  Logger.log('Progreso reiniciado. La próxima ejecución de reclasificarHistorico() empezará desde la primera fila.');
}

/* === API WEB: devuelve las incidencias de la hoja en JSON ========
   Se publica como Web App (Implementar -> Nueva implementación -> Aplicación web).
   Soporta JSONP mediante el parámetro ?callback= para lectura desde el panel. */

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

// Guarda un cambio de categoria/gravedad hecho desde la tabla (edicion en
// linea) directamente en la fila real de la Google Sheet. Protegido con
// una clave compartida simple (Propiedades del script -> WRITE_SECRET):
// no es un sistema de login, solo evita ediciones accidentales o de quien
// encuentre la URL publica sin conocer la clave.
function manejarGuardarCampo(e) {
  var resultado;
  try {
    var claveEsperada = PROPS.getProperty('WRITE_SECRET') || '';
    if (!claveEsperada) throw new Error('WRITE_SECRET no configurado en Propiedades del script');
    if ((e.parameter.clave || '') !== claveEsperada) throw new Error('Clave incorrecta');
    var fila = parseInt(e.parameter.fila, 10);
    if (!fila || fila < 2) throw new Error('Fila invalida');
    var columnas = { gravedad: 4, categoria: 5 };
    var col = columnas[e.parameter.campo];
    if (!col) throw new Error('Campo no editable: ' + e.parameter.campo);
    var valor = e.parameter.valor || '';
    if (!valor) throw new Error('Valor vacio');
    var hoja = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    hoja.getRange(fila, col).setValue(valor);
    resultado = { ok: true };
  } catch (err) {
    resultado = { ok: false, error: String(err) };
  }
  var json = JSON.stringify(resultado);
  var callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'guardar') {
    return manejarGuardarCampo(e);
  }

  const hoja = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  // Se asume fila 0 = cabeceras. Columnas según guardarIncidencia():
  // [marca, fecha, hora, gravedad, categoria, resumen, estado, original, enlace]
  var inicio = 0;
  if (datos.length > 0 && !(datos[0][0] instanceof Date)) {
    inicio = 1;
  }
  const incidencias = [];
  for (var i = inicio; i < datos.length; i++) {
    var f = datos[i];
    if (!f[1] && !f[5]) continue; // saltar filas vacías
    incidencias.push({
      fila: i + 1,
      fecha: formatearFecha(f[1]),
      hora: formatearHora(f[2]),
      gravedad: f[3],
      categoria: f[4],
      resumen: f[5],
      estat: f[6] || 'Obert',
      original: f[7] || '',
      enlace: f[8] || ''
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
