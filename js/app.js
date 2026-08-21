
let incidencies = [];
let afectats = [];
let nextId = 1;
let nextAfectatId = 1;
let incidenciaDetallActual = null;
let afectatDetallActual = null;

// jsPDF + jsPDF-autotable (~450 KB) solo hacen falta al generar un PDF, así
// que no se cargan en el <head>/</body> de index.html: se inyectan la
// primera vez que se necesitan (o antes, en un rato muerto del navegador),
// para no retrasar la carga inicial de la página.
let _pdfLibsPromise = null;
function asegurarLibreriasPDF() {
  if (_pdfLibsPromise) return _pdfLibsPromise;
  _pdfLibsPromise = new Promise(function (resolve, reject) {
    if (window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
    var s1 = document.createElement("script");
    s1.src = "js/vendor/jspdf.umd.min.js";
    s1.onload = function () {
      var s2 = document.createElement("script");
      s2.src = "js/vendor/jspdf.plugin.autotable.min.js";
      s2.onload = function () { resolve(); };
      s2.onerror = function () { reject(new Error("No se pudo cargar jspdf-autotable")); };
      document.body.appendChild(s2);
    };
    s1.onerror = function () { reject(new Error("No se pudo cargar jsPDF")); };
    document.body.appendChild(s1);
  });
  return _pdfLibsPromise;
}
(function precargarPDFEnRatoMuerto() {
  var precargar = function () { asegurarLibreriasPDF().catch(function () {}); };
  if ("requestIdleCallback" in window) requestIdleCallback(precargar, { timeout: 4000 });
  else setTimeout(precargar, 2000);
})();

function formatData(f) { return f ? f.split("-").reverse().join("/") : "—"; }
function getMesActual() { return new Date().toISOString().slice(0,7); }
function badgeGravClass(g) { return {"Crítica":"badge-critica","Alta":"badge-alta","Media":"badge-media","Baja":"badge-baja"}[g]||""; }
function badgeGravLabel(g) { return {"Crítica":"Crítica","Alta":"Alta","Media":"Media","Baja":"Baja"}[g]||g; }
function rowClass(g) { return {"Crítica":"row-crithica","Alta":"row-alta","Media":"row-media","Baja":"row-baja"}[g]||""; }

var CATEGORIAS_NO_INCIDENCIA = { "Operativa": 1, "Mantenimiento": 1 };
function esCategoriaOperativa(cat) { return !!CATEGORIAS_NO_INCIDENCIA[cat]; }

var PALABRAS_MANTENIMIENTO = ["schindler", "ascensor", "elevador", "montacargas"];
function esTextoMantenimiento(d) {
  var texto = ((d.resum||"") + " " + (d.descripcion||"") + " " + (d.correo||"")).toLowerCase();
  return PALABRAS_MANTENIMIENTO.some(function(p){ return texto.indexOf(p) !== -1; });
}
function categoriaEfectiva(d) {
  if (d.categoria === "Incidència Baixa" && esTextoMantenimiento(d)) return "Mantenimiento";
  return d.categoria;
}

function canviarVista(vista, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + vista).classList.add('active');
  btn.classList.add('active');
  if (vista === 'afectats') renderAfectats();
  if (vista === 'backup') renderBackup();
  if (vista === 'informes') renderInformes();
  if (vista === 'mantenimiento') renderMantenimiento();
}

// Las incidencias de la Sheet traen la fecha como "DD/MM/YYYY" (así la
// formatea el Apps Script), mientras que las creadas a mano en la web usan
// "YYYY-MM-DD" (el formato nativo de <input type="date">). Esta función
// normaliza cualquiera de los dos a la clave "YYYY-MM" usada por el
// filtro de meses.
function mesDeFecha(fecha) {
  var f = fecha || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f.slice(0,7);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) { var p = f.split("/"); return p[2] + "-" + p[1]; }
  return "";
}

function omplirFiltresMesos() {
  const mesos = [...new Set(incidencies.filter(i => !esCategoriaOperativa(i.categoria)).map(i => mesDeFecha(i.fecha)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById("f-mes");
  sel.innerHTML = '<option value="">Todos los meses</option>';
  const noms = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  mesos.forEach(m => {
    const [y, mo] = m.split("-");
    sel.innerHTML += `<option value="${m}">${noms[parseInt(mo)-1]} ${y}</option>`;
  });
}

function filtrar() {
  var el = function(id){ var e=document.getElementById(id); return e?e.value:""; };
  var buscar = (el("f-buscar")||"").toLowerCase();
  var grav = el("f-gravedad")||""; var cat = el("f-categoria")||"";
  var est = el("f-estat")||""; var mes = el("f-mes")||"";
  var res = incidencies.filter(function(d){
    if (esCategoriaOperativa(d.categoria)) return false;
    if (grav && d.gravedad !== grav) return false;
    if (cat && d.categoria !== cat) return false;
    if (est && d.estat !== est) return false;
    if (mes && mesDeFecha(d.fecha) !== mes) return false;
    if (buscar){ var hay=((d.resum||"")+" "+(d.descripcion||"")+" "+(d.ubicacion||"")+" "+(d.categoria||"")).toLowerCase(); if(hay.indexOf(buscar)===-1) return false; }
    return true;
  });
  return res;
}

var ordenTabla = { campo: "fecha", direccion: -1 };
var GRAVEDADES_EDITABLES = ["Crítica", "Alta", "Media", "Baja"];
var CATEGORIAS_EDITABLES = ["Robatori", "Danys", "Accident Parking", "Accident CC", "Accident Laboral", "Incidència Baixa", "Operativa", "Mantenimiento"];

function valorOrden(d, campo) {
  if (campo === "fecha") return (d.fecha || "") + " " + (d.hora || "");
  if (campo === "hora") return d.hora || "";
  if (campo === "gravedad") return { "Crítica": 4, "Alta": 3, "Media": 2, "Baja": 1 }[d.gravedad] || 0;
  if (campo === "categoria") return catEs(d.categoria) || "";
  if (campo === "estat") return d.estat || "";
  return "";
}

function ordenarPor(campo) {
  if (ordenTabla.campo === campo) { ordenTabla.direccion = -ordenTabla.direccion; }
  else { ordenTabla.campo = campo; ordenTabla.direccion = 1; }
  renderTabla();
}

// Atajo para el seguimiento de incidencias: filtra la tabla de Incidencias
// para mostrar solo las que siguen abiertas. Se llama desde el botón "Solo
// abiertas" y desde la propia métrica "Abiertas" del panel.
function verSoloAbiertas() {
  var sel = document.getElementById("f-estat");
  if (sel) sel.value = "Obert";
  renderTabla();
  var panel = document.querySelector("#view-incidencies .panel");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function actualizarIndicadoresOrden() {
  ["fecha", "hora", "gravedad", "categoria", "estat"].forEach(function (campo) {
    var icono = document.getElementById("orden-" + campo);
    if (!icono) return;
    icono.textContent = campo === ordenTabla.campo ? (ordenTabla.direccion === 1 ? "▲" : "▼") : "";
  });
}

function editarCampo(ev, id, campo) {
  ev.stopPropagation();
  var td = ev.currentTarget.closest("td");
  if (!td) return;
  var d = incidencies.find(function (i) { return String(i.id) === String(id); });
  if (!d) return;
  var opciones = campo === "gravedad" ? GRAVEDADES_EDITABLES : CATEGORIAS_EDITABLES;
  var valorActual = d[campo];
  var html = '<select onchange="guardarCampoEditado(this,\'' + id + '\',\'' + campo + '\')" onblur="renderTabla()" style="font-size:12px;padding:2px 4px;border-radius:6px;border:1px solid #D1D9E0">';
  opciones.forEach(function (op) {
    var etiqueta = campo === "gravedad" ? op : catEs(op);
    html += '<option value="' + op + '"' + (op === valorActual ? " selected" : "") + ">" + etiqueta + "</option>";
  });
  html += "</select>";
  td.innerHTML = html;
  var sel = td.querySelector("select");
  if (sel) { sel.focus(); if (sel.showPicker) { try { sel.showPicker(); } catch (e) {} } }
}

function vilaJSONP(url) {
  return new Promise(function (resolve) {
    var cbName = "__vilaCbW" + Date.now();
    var s = document.createElement("script");
    var terminado = false;
    window[cbName] = function (data) {
      terminado = true; delete window[cbName]; if (s.parentNode) s.parentNode.removeChild(s);
      resolve(data);
    };
    s.onerror = function () {
      if (!terminado) { terminado = true; delete window[cbName]; if (s.parentNode) s.parentNode.removeChild(s); resolve(null); }
    };
    s.src = url + (url.indexOf("?") !== -1 ? "&" : "?") + "callback=" + cbName;
    document.body.appendChild(s);
    setTimeout(function () {
      if (!terminado) { terminado = true; delete window[cbName]; if (s.parentNode) s.parentNode.removeChild(s); resolve(null); }
    }, 15000);
  });
}

// Guarda un campo (gravedad/categoria) de una incidencia, tanto en memoria
// como en la Sheet remota. Devuelve una promesa con true/false según si se
// guardó bien, para que quien llame decida qué hacer (revertir, avisar,
// encadenar el siguiente paso...). La usan tanto la edición en línea de la
// tabla (guardarCampoEditado) como la pantalla de revisión rápida.
function guardarCampoValor(id, campo, valorNuevo) {
  var d = incidencies.find(function (i) { return String(i.id) === String(id); });
  if (!d) return Promise.resolve(false);
  var valorAnterior = d[campo];
  d[campo] = valorNuevo;
  actualitzarMetriques();
  if (typeof window.renderKPIs === "function") window.renderKPIs();
  renderTabla();
  if (!d.filaSheet) return Promise.resolve(true); // incidencia local (no viene de la Sheet): no hay fila que actualizar
  var url = VILAMARINA_WEBAPP_URL + "?action=guardar&fila=" + encodeURIComponent(d.filaSheet) +
    "&campo=" + encodeURIComponent(campo) + "&valor=" + encodeURIComponent(valorNuevo) +
    "&clave=" + encodeURIComponent(VILAMARINA_WRITE_SECRET);
  return vilaJSONP(url).then(function (res) {
    if (res && res.ok) return true;
    console.warn("[Vilamarina] No se pudo guardar el cambio:", res && res.error);
    d[campo] = valorAnterior;
    actualitzarMetriques();
    if (typeof window.renderKPIs === "function") window.renderKPIs();
    renderTabla();
    return false;
  });
}

function guardarCampoEditado(selectEl, id, campo) {
  guardarCampoValor(id, campo, selectEl.value).then(function (ok) {
    if (!ok) alert("No se ha podido guardar el cambio en la hoja. Se revierte.");
  });
}

/* === REVISIÓN RÁPIDA DE INCIDENCIAS "SIN CLASIFICAR" =====================
   Cola de incidencias que la IA no pudo clasificar, mostradas de una en una
   en un modal con botones grandes: un clic en la categoría y otro en la
   gravedad guardan la incidencia y pasan automáticamente a la siguiente. */
var CATEGORIAS_REVISION = CATEGORIAS_EDITABLES.filter(function (c) { return c !== "Mantenimiento"; });
var revisarCola = [];
var revisarIndex = 0;
var revisarSeleccion = { categoria: null, gravedad: null };

function contarSinClasificar() {
  return incidencies.filter(function (d) { return d.categoria === "Sin clasificar"; }).length;
}

function actualizarBotonRevisar() {
  var n = contarSinClasificar();
  var btn = document.getElementById("btn-revisar");
  var badge = document.getElementById("btn-revisar-count");
  if (!btn || !badge) return;
  badge.textContent = n;
  btn.style.display = n > 0 ? "" : "none";
}

function abrirRevisionSinClasificar() {
  revisarCola = incidencies.filter(function (d) { return d.categoria === "Sin clasificar"; }).map(function (d) { return d.id; });
  if (!revisarCola.length) { alert("No hay incidencias sin clasificar ahora mismo."); return; }
  revisarIndex = 0;
  document.getElementById("modal-revisar").classList.add("open");
  renderRevisionActual();
}

function revisionSiguiente() {
  revisarIndex++;
  renderRevisionActual();
}

function renderRevisionActual() {
  var body = document.getElementById("revisar-body");
  var progreso = document.getElementById("revisar-progreso");
  if (!body || !progreso) return;
  if (revisarIndex >= revisarCola.length) {
    progreso.textContent = "";
    body.innerHTML = '<div style="text-align:center;padding:30px 10px">' +
      '<div style="font-size:36px;margin-bottom:10px">✅</div>' +
      '<div style="font-size:15px;color:#0F1B2D;margin-bottom:18px">Todo revisado.</div>' +
      '<button class="btn btn-primary" onclick="tancarModal(\'modal-revisar\')">Cerrar</button>' +
      '</div>';
    return;
  }
  var d = incidencies.find(function (i) { return String(i.id) === String(revisarCola[revisarIndex]); });
  if (!d || d.categoria !== "Sin clasificar") { revisionSiguiente(); return; }
  revisarSeleccion = { categoria: null, gravedad: null };
  progreso.textContent = "(" + (revisarIndex + 1) + " de " + revisarCola.length + ")";
  body.innerHTML =
    '<div style="font-size:12px;color:#7A8FA6;margin-bottom:6px">' + formatData(d.fecha) + ' · ' + (d.hora || "") + 'h · ' + (d.ubicacion || "") + '</div>' +
    '<div style="font-size:15px;line-height:1.5;color:#0F1B2D;background:#F8F9FA;border:1px solid #E2E6EA;border-radius:10px;padding:14px;margin-bottom:22px">' +
      (d.resum || d.descripcion || "") +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;color:#5A6B7B;margin-bottom:8px;letter-spacing:.03em">CATEGORÍA</div>' +
    '<div id="revisar-categorias" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px">' +
      CATEGORIAS_REVISION.map(function (c) {
        return '<button type="button" class="btn btn-outline" data-valor="' + c + '" style="font-size:13px" onclick="revisarElegirCategoria(\'' + c + '\')">' + catEs(c) + '</button>';
      }).join("") +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;color:#5A6B7B;margin-bottom:8px;letter-spacing:.03em">GRAVEDAD</div>' +
    '<div id="revisar-gravedades" style="display:flex;flex-wrap:wrap;gap:8px">' +
      GRAVEDADES_EDITABLES.map(function (g) {
        return '<button type="button" class="btn btn-outline" data-valor="' + g + '" style="font-size:13px" onclick="revisarElegirGravedad(\'' + g + '\')">' + g + '</button>';
      }).join("") +
    '</div>';
}

function revisarActualizarBotones() {
  var contCat = document.getElementById("revisar-categorias");
  if (contCat) contCat.querySelectorAll("button").forEach(function (btn) {
    var activo = btn.dataset.valor === revisarSeleccion.categoria;
    btn.classList.toggle("btn-accent", activo);
    btn.classList.toggle("btn-outline", !activo);
  });
  var contGrav = document.getElementById("revisar-gravedades");
  if (contGrav) contGrav.querySelectorAll("button").forEach(function (btn) {
    var activo = btn.dataset.valor === revisarSeleccion.gravedad;
    btn.classList.toggle("btn-accent", activo);
    btn.classList.toggle("btn-outline", !activo);
  });
}

function revisarElegirCategoria(cat) {
  revisarSeleccion.categoria = cat;
  revisarActualizarBotones();
  revisarIntentarGuardar();
}

function revisarElegirGravedad(grav) {
  revisarSeleccion.gravedad = grav;
  revisarActualizarBotones();
  revisarIntentarGuardar();
}

function revisarIntentarGuardar() {
  if (!revisarSeleccion.categoria || !revisarSeleccion.gravedad) return;
  var id = revisarCola[revisarIndex];
  var body = document.getElementById("revisar-body");
  if (body) body.style.opacity = "0.5";
  Promise.all([
    guardarCampoValor(id, "categoria", revisarSeleccion.categoria),
    guardarCampoValor(id, "gravedad", revisarSeleccion.gravedad)
  ]).then(function (resultados) {
    if (body) body.style.opacity = "1";
    if (resultados.indexOf(false) !== -1) {
      alert("No se ha podido guardar la clasificación de esta incidencia. Inténtalo de nuevo.");
      renderRevisionActual();
      return;
    }
    revisionSiguiente();
  });
}

function renderTabla() {
  const filtrats = filtrar();
  filtrats.sort(function (a, b) {
    var va = valorOrden(a, ordenTabla.campo), vb = valorOrden(b, ordenTabla.campo);
    var cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return cmp * ordenTabla.direccion;
  });
  const tbody = document.getElementById("tbody");
  actualizarIndicadoresOrden();
  if (!filtrats.length) {
    const hayIncidencias = incidencies.some(d => !esCategoriaOperativa(d.categoria));
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-icon">📋</div>${!hayIncidencias ? "Aún no hay incidencias registradas.<br><small>Haz clic en <strong>Nueva incidencia</strong> para añadir una.</small>" : "Ninguna incidencia coincide con los filtros seleccionados."}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtrats.map(d => `
    <tr class="${rowClass(d.gravedad)}">
      <td class="td-muted">${formatData(d.fecha)}</td>
      <td class="td-muted">${d.hora}</td>
      <td><span class="badge ${badgeGravClass(d.gravedad)}" style="cursor:pointer" title="Haz clic para cambiar la gravedad" onclick="editarCampo(event,'${d.id}','gravedad')">${badgeGravLabel(d.gravedad)}</span></td>
      <td><span class="badge badge-cat" style="cursor:pointer" title="Haz clic para cambiar la categoría" onclick="editarCampo(event,'${d.id}','categoria')">${d.categoria}</span></td>
      <td class="td-muted" style="font-size:12px">${d.ubicacion}</td>
      <td style="font-size:12px;color:#4A5568;max-width:200px">${d.resum||d.descripcion}</td>
      <td><span class="badge ${d.estat==='Obert'?'badge-obert':'badge-tancat'}">${d.estat}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="verIncidencia('${d.id}')">Ver incidencia</button></td>
    </tr>`).join("");
}

function actualitzarMetriques() {
  const mes = getMesActual();
  const reales = incidencies.filter(d => !esCategoriaOperativa(d.categoria));
  document.getElementById("m-total").textContent = reales.length;
  document.getElementById("m-critica").textContent = reales.filter(d=>d.gravedad==="Crítica").length;
  document.getElementById("m-alta").textContent = reales.filter(d=>d.gravedad==="Alta").length;
  document.getElementById("m-obertes").textContent = reales.filter(d=>d.estat==="Obert").length;
  document.getElementById("m-mes").textContent = reales.filter(d=>mesDeFecha(d.fecha)===mes).length;
  actualizarBotonRevisar();
}

// Clic en los contadores de la cabecera: muestran el mismo modal de
// listado que el gráfico circular, con las incidencias detrás del número.
function verTotalIncidencias() {
  var reales = incidencies.filter(d => !esCategoriaOperativa(d.categoria));
  mostrarListadoIncidenciasModal("Total de incidencias", reales);
}
function verIncidenciasCriticas() {
  var reales = incidencies.filter(d => !esCategoriaOperativa(d.categoria) && d.gravedad === "Crítica");
  mostrarListadoIncidenciasModal("Incidencias críticas", reales);
}
function verIncidenciasAltas() {
  var reales = incidencies.filter(d => !esCategoriaOperativa(d.categoria) && d.gravedad === "Alta");
  mostrarListadoIncidenciasModal("Incidencias de gravedad alta", reales);
}
function verIncidenciasEsteMes() {
  var mes = getMesActual();
  var reales = incidencies.filter(d => !esCategoriaOperativa(d.categoria) && mesDeFecha(d.fecha) === mes);
  mostrarListadoIncidenciasModal("Incidencias de este mes", reales);
}

function obrirDetall(id) {
  const d = incidencies.find(i=>i.id===id);
  if (!d) return;
  incidenciaDetallActual = d;
  document.getElementById("detall-titol").textContent = `#${d.id} — ${catEs(d.categoria)}`;
  document.getElementById("btn-toggle-estat").textContent = d.estat==="Obert" ? "Marcar como cerrado" : "Reabrir";
  const af = afectats.filter(a=>a.incidenciaId===d.id);
  document.getElementById("detall-body").innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Datos generales</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Fecha y hora</div><div class="detail-value">${formatData(d.fecha)} a las ${d.hora}h</div></div>
        <div class="detail-item"><div class="detail-label">Vigilante</div><div class="detail-value">${d.vigilant||"—"}</div></div>
        <div class="detail-item"><div class="detail-label">Gravedad</div><div class="detail-value"><span class="badge ${badgeGravClass(d.gravedad)}">${badgeGravLabel(d.gravedad)}</span></div></div>
        <div class="detail-item"><div class="detail-label">Categoría</div><div class="detail-value"><span class="badge badge-cat">${d.categoria}</span></div></div>
        <div class="detail-item"><div class="detail-label">Ubicación</div><div class="detail-value">${d.ubicacion}</div></div>
        <div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value"><span class="badge ${d.estat==='Obert'?'badge-obert':'badge-tancat'}">${d.estat}</span></div></div>
        ${d.enlace?`<div class="detail-item"><div class="detail-label">Informe original</div><div class="detail-value"><a href="${d.enlace}" target="_blank" rel="noopener">Abrir informe ↗</a></div></div>`:""}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Descripción y resumen</div>
      <div class="detail-grid">
        <div class="detail-item detail-full"><div class="detail-label">Resumen</div><div class="detail-value">${d.resum||"—"}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Descripción completa</div><div class="detail-value" style="font-size:13px;color:#4A5568">${d.descripcion}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Medidas adoptadas</div><div class="detail-value">${d.accion||"—"}</div></div>
      </div>
    </div>
    ${d.imgCarpeta||d.imgRuta?`<div class="detail-section"><div class="detail-section-title">Imágenes / Vídeos de seguridad</div><div class="img-ref-box"><strong>Referencia de imágenes</strong>${d.imgCarpeta?`<div>📁 Carpeta: <strong>${d.imgCarpeta}</strong></div>`:""} ${d.imgRuta?`<div>📍 Ruta: <code style="font-size:11px">${d.imgRuta}</code></div>`:""} ${d.imgObs?`<div style="margin-top:4px">${d.imgObs}</div>`:""}</div></div>`:""}
    ${d.correo?`<div class="detail-section"><div class="detail-section-title">Correo original</div><div class="correo-box">${d.correo}</div></div>`:""}
    ${af.length?`<div class="detail-section"><div class="detail-section-title">Afectados vinculados (${af.length})</div>${af.map(a=>`<div style="font-size:13px;padding:8px 0;border-bottom:1px solid #F0F2F5">${a.nom} — ${a.tel}${a.medica==='Sí'?' · <span style="color:#922B21">Asistencia médica</span>':""}</div>`).join("")}</div>`:""}
  `;
  document.getElementById("modal-detall").classList.add("open");
}

function toggleEstat() {
  if (!incidenciaDetallActual) return;
  const d = incidencies.find(i=>i.id===incidenciaDetallActual.id);
  if (!d) return;
  const nuevo = d.estat==="Obert" ? "Tancat" : "Obert";
  guardarCampoValor(d.id, "estat", nuevo).then(function (ok) {
    if (!ok) { alert("No se ha podido guardar el cambio de estado en la hoja. Se revierte."); return; }
    tancarModal("modal-detall");
  });
}

// Borra una incidencia por completo (fila de la Sheet incluida). Pensado
// para quitar duplicados: pide confirmación porque no se puede deshacer.
// Tras borrar en la Sheet, se recarga todo desde Google Sheets en vez de
// quitar la fila solo en memoria, porque al borrar una fila las demás se
// desplazan hacia arriba y sus números de fila (filaSheet) guardados en
// memoria quedarían desactualizados para cualquier edición posterior.
function eliminarIncidenciaActual() {
  if (!incidenciaDetallActual) return;
  const d = incidencies.find(i => i.id === incidenciaDetallActual.id);
  if (!d) return;
  if (!confirm("¿Seguro que quieres eliminar esta incidencia? Esta acción no se puede deshacer.")) return;

  if (!d.filaSheet) {
    incidencies = incidencies.filter(i => i.id !== d.id);
    tancarModal("modal-detall");
    actualitzarMetriques();
    renderTabla();
    if (typeof window.renderKPIs === "function") window.renderKPIs();
    return;
  }

  const url = VILAMARINA_WEBAPP_URL + "?action=eliminar&fila=" + encodeURIComponent(d.filaSheet) +
    "&clave=" + encodeURIComponent(VILAMARINA_WRITE_SECRET);
  vilaJSONP(url).then(function (res) {
    if (!res || !res.ok) {
      alert("No se ha podido eliminar la incidencia: " + (res && res.error || "error desconocido"));
      return;
    }
    tancarModal("modal-detall");
    cargarDesdeSheets();
  });
}

function descarregarCorreo() {
  if (!incidenciaDetallActual?.correo) { alert("Esta incidencia no tiene correo original registrado."); return; }
  const d = incidenciaDetallActual;
  const blob = new Blob([d.correo], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`correo_inc${d.id}_${d.fecha}.txt`; a.click();
  URL.revokeObjectURL(url);
}

function obrirModalNova(categoriaDefecto) {
  const hoy = new Date().toISOString().slice(0,10);
  const hora = new Date().toTimeString().slice(0,5);
  ["n-ubicacion","n-vigilant","n-descripcion","n-resum","n-accion","n-correo","n-img-carpeta","n-img-ruta","n-img-obs"].forEach(id => document.getElementById(id).value="");
  document.getElementById("n-fecha").value = hoy;
  document.getElementById("n-hora").value = hora;
  document.getElementById("n-gravedad").value = "Media";
  document.getElementById("n-categoria").value = categoriaDefecto || "Incidència Baixa";
  document.querySelector('input[name="n-estat"][value="Obert"]').checked = true;
  const titulo = document.getElementById("modal-nova-titol");
  if (titulo) titulo.textContent = categoriaDefecto === "Mantenimiento" ? "Nuevo aviso de mantenimiento" : "Nueva incidencia";
  document.getElementById("modal-nova").classList.add("open");
}

function generarResum() {
  const desc = document.getElementById("n-descripcion").value.trim();
  if (!desc) { alert("Escribe primero la descripción de la incidencia."); return; }
  const ubi = document.getElementById("n-ubicacion").value||"ubicación no especificada";
  const frases = desc.split(/[.!?]/).filter(f=>f.trim().length>10);
  const resum = frases.length>0 ? frases.slice(0,2).map(f=>f.trim()).join(". ")+"." : desc.slice(0,120)+(desc.length>120?"...":"");
  document.getElementById("n-resum").value = `${ubi}. ${resum}`;
}

function guardarIncidencia() {
  const fecha = document.getElementById("n-fecha").value;
  const hora = document.getElementById("n-hora").value;
  const ubicacion = document.getElementById("n-ubicacion").value.trim();
  const descripcion = document.getElementById("n-descripcion").value.trim();
  if (!fecha||!hora||!ubicacion||!descripcion) { alert("Rellena los campos obligatorios: fecha, hora, ubicación y descripción."); return; }
  const nueva = {
    id: nextId++, fecha, hora,
    gravedad: document.getElementById("n-gravedad").value,
    categoria: document.getElementById("n-categoria").value,
    ubicacion,
    descripcion,
    resum: document.getElementById("n-resum").value.trim()||descripcion.slice(0,100),
    accion: document.getElementById("n-accion").value.trim(),
    correo: document.getElementById("n-correo").value.trim(),
    vigilant: document.getElementById("n-vigilant").value.trim(),
    imgCarpeta: document.getElementById("n-img-carpeta").value.trim(),
    imgRuta: document.getElementById("n-img-ruta").value.trim(),
    imgObs: document.getElementById("n-img-obs").value.trim(),
    estat: document.querySelector('input[name="n-estat"]:checked').value,
  };
  nueva.categoria = categoriaEfectiva(nueva);
  incidencies.unshift(nueva);
  tancarModal("modal-nova");
  actualitzarMetriques();
  omplirFiltresMesos();
  renderTabla();
  renderMantenimiento();
  if (typeof window.renderKPIs === "function") window.renderKPIs();
}

// Exportador PDF genérico para una tabla de datos (usado por Incidencias,
// Operativa y Afectados): mismo estilo visual que los informes PDF, con
// cabecera oscura repetida en cada página y numeración de páginas.
async function exportarTablaPDF(titulo, columnas, filas, nombreArchivo) {
  if (!filas.length) { alert("No hay datos para exportar."); return; }
  try { await asegurarLibreriasPDF(); } catch (e) { alert("No se ha podido cargar el generador de PDF."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("No se ha podido cargar el generador de PDF."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  var margenIzq = 10;
  var anchoPagina = doc.internal.pageSize.getWidth();
  var altoPagina = doc.internal.pageSize.getHeight();

  function encabezado() {
    doc.setFillColor(15,27,45);
    doc.rect(0, 0, anchoPagina, 20, "F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold"); doc.setFontSize(13);
    doc.text(titulo, margenIzq, 10);
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.setTextColor(232,237,242);
    doc.text("Vilamarina · Oficina de Gerencia · Generado: " + new Date().toLocaleString("es-ES"), margenIzq, 16);
  }
  encabezado();

  doc.autoTable({
    startY: 24,
    margin: { top: 22, left: margenIzq, right: margenIzq },
    head: [columnas],
    body: filas,
    theme: "striped",
    headStyles: { fillColor: [15,27,45], textColor: 255, fontSize: 8, halign: "center" },
    bodyStyles: { fontSize: 7.5 },
    styles: { cellPadding: 1.5, overflow: "linebreak" },
    didDrawPage: function () { encabezado(); }
  });

  var paginas = doc.internal.getNumberOfPages();
  for (var p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(122,143,166);
    doc.text("Página " + p + " de " + paginas, anchoPagina - margenIzq, altoPagina - 6, { align: "right" });
  }

  doc.save(nombreArchivo);
}

async function exportarPDF() {
  const filtrats = filtrar();
  if (!filtrats.length) { alert("No hay incidencias para exportar."); return; }
  const columnas = ["ID","Fecha","Hora","Gravedad","Categoría","Ubicación","Resumen","Estado","Vigilante"];
  const filas = filtrats.map(d=>[d.id,formatData(d.fecha),d.hora,d.gravedad,catEs(d.categoria),d.ubicacion,d.resum||d.descripcion,estadoEs(d.estat),d.vigilant||"—"]);
  await exportarTablaPDF("Incidencias de Seguridad", columnas, filas, `incidencias_vilamarina_${new Date().toISOString().slice(0,10)}.pdf`);
}

// MANTENIMENT
function filtrarMantenimiento() {
  var el = function(id){ var e=document.getElementById(id); return e?e.value:""; };
  var buscar = (el("mt-buscar")||"").toLowerCase();
  var cat = el("mt-categoria")||""; var est = el("mt-estat")||"";
  return incidencies.filter(function(d){
    if (!esCategoriaOperativa(d.categoria)) return false;
    if (cat && d.categoria !== cat) return false;
    if (est && d.estat !== est) return false;
    if (buscar) {
      var hay = ((d.resum||"")+" "+(d.descripcion||"")+" "+(d.ubicacion||"")+" "+(d.categoria||"")).toLowerCase();
      if (hay.indexOf(buscar)===-1) return false;
    }
    return true;
  });
}

async function exportarMantenimientoPDF() {
  const lista = filtrarMantenimiento();
  if (!lista.length) { alert("No hay avisos de mantenimiento/operativa para exportar."); return; }
  const columnas = ["Fecha","Hora","Categoría","Ubicación","Resumen","Estado"];
  const filas = lista.map(d=>[formatData(d.fecha),d.hora,catEs(d.categoria),d.ubicacion,d.resum||d.descripcion,estadoEs(d.estat)]);
  await exportarTablaPDF("Mantenimiento y Operativa", columnas, filas, `mantenimiento_vilamarina_${new Date().toISOString().slice(0,10)}.pdf`);
}

function renderMantenimiento() {
  var tbody = document.getElementById("tbody-mantenimiento");
  if (!tbody) return;
  var todos = incidencies.filter(function(d){ return esCategoriaOperativa(d.categoria); });
  var mesActual = getMesActual();
  var totalEl = document.getElementById("mt-total"); if (totalEl) totalEl.textContent = todos.length;
  var abEl = document.getElementById("mt-abiertas"); if (abEl) abEl.textContent = todos.filter(function(d){ return d.estat==="Obert"; }).length;
  var ceEl = document.getElementById("mt-cerradas"); if (ceEl) ceEl.textContent = todos.filter(function(d){ return d.estat==="Tancat"; }).length;
  var mesEl = document.getElementById("mt-mes"); if (mesEl) mesEl.textContent = todos.filter(function(d){ return (d.fecha||"").startsWith(mesActual); }).length;

  var lista = filtrarMantenimiento();
  if (!lista.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="empty-icon">🔧</div>'+
      (todos.length===0 ? "Aún no hay avisos de mantenimiento registrados." : "Ningún aviso coincide con los filtros seleccionados.")+
      '</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(function(d){
    return '<tr>'+
      '<td class="td-muted">'+formatData(d.fecha)+'</td>'+
      '<td class="td-muted">'+d.hora+'</td>'+
      '<td><span class="badge badge-cat">'+catEs(d.categoria)+'</span></td>'+
      '<td class="td-muted" style="font-size:12px">'+d.ubicacion+'</td>'+
      '<td style="font-size:12px;color:#4A5568;max-width:200px">'+(d.resum||d.descripcion)+'</td>'+
      '<td><span class="badge '+(d.estat==='Obert'?'badge-obert':'badge-tancat')+'">'+estadoEs(d.estat)+'</span></td>'+
      '<td><button class="btn btn-outline btn-sm" onclick="verIncidencia(\''+d.id+'\')">Ver</button></td>'+
      '</tr>';
  }).join("");
}

// INFORMES
var INF_COLORS = {
  "Robatori": "#ef4444",
  "Danys": "#f59e0b",
  "Accident Parking": "#8b5cf6",
  "Accident CC": "#3b82f6",
  "Accident Laboral": "#06b6d4",
  "Incidència Baixa": "#10b981"
};
var INF_CATEGORIAS = ["Robatori","Danys","Accident Parking","Accident CC","Accident Laboral","Incidència Baixa"];
var INF_MESOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
var INF_CATEGORIA_ES = {
  "Robatori": "Robo",
  "Danys": "Daños",
  "Accident Parking": "Accidente Parking",
  "Accident CC": "Accidente CC",
  "Accident Laboral": "Accidente laboral",
  "Incidència Baixa": "Incidencia leve"
};
function catEs(cat) { return INF_CATEGORIA_ES[cat] || cat; }
var ESTADO_ES = { "Obert": "Abierto", "Tancat": "Cerrado" };
function estadoEs(e) { return ESTADO_ES[e] || e; }
var INF_MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function nombreMesCorto(m) {
  var partes = m.split("-");
  return INF_MESES_CORTOS[parseInt(partes[1],10)-1] + " " + partes[0].slice(2);
}
// Etiqueta corta "día/mes" para la gráfica cuando se agrupa por días (rango
// dentro de un mismo mes, como MTD) en vez de por meses.
function diaCorto(f) {
  var partes = f.split("-");
  return partes[2] + "/" + partes[1];
}

var INF_FECHAS_INICIALIZADAS = false;
function inicializarFechasInformes() {
  if (INF_FECHAS_INICIALIZADAS) return;
  var inputDesde = document.getElementById("inf-desde");
  var inputHasta = document.getElementById("inf-hasta");
  if (!inputDesde || !inputHasta) return;
  INF_FECHAS_INICIALIZADAS = true;
  if (!inputDesde.value && !inputHasta.value) {
    var hoy = new Date().toISOString().slice(0,10);
    inputDesde.value = hoy.slice(0,4) + "-01-01";
    inputHasta.value = hoy;
  }
}

function getRangoInformes() {
  var el = function(id){ var e=document.getElementById(id); return e?e.value:""; };
  return { desde: el("inf-desde"), hasta: el("inf-hasta") };
}

function incidenciesEnRango(desde, hasta) {
  return incidencies.filter(function(d){
    if (!d.fecha) return false;
    if (esCategoriaOperativa(d.categoria)) return false;
    if (desde && d.fecha < desde) return false;
    if (hasta && d.fecha > hasta) return false;
    return true;
  });
}

function aplicarRangoInformes() { renderInformes(); }

function establecerRangoYTD() {
  var hoy = new Date().toISOString().slice(0,10);
  document.getElementById("inf-desde").value = hoy.slice(0,4) + "-01-01";
  document.getElementById("inf-hasta").value = hoy;
  renderInformes();
}

function establecerRangoTodo() {
  document.getElementById("inf-desde").value = "";
  document.getElementById("inf-hasta").value = "";
  renderInformes();
}

function nombreMes(m) {
  var partes = m.split("-");
  return INF_MESOS[parseInt(partes[1],10)-1] + " " + partes[0];
}

function datosGraficoTema(lista) {
  var conteo = {};
  lista.forEach(function(d){
    conteo[d.categoria] = (conteo[d.categoria]||0)+1;
  });
  return Object.keys(conteo).map(function(cat){
    return { label: cat, value: conteo[cat], color: INF_COLORS[cat] || "#6b7280" };
  }).sort(function(a,b){ return b.value-a.value; });
}

function construirGraficoCircular(datos) {
  var total = datos.reduce(function(s,d){ return s+d.value; }, 0);
  if (!total) return '<div style="color:#7A8FA6;font-size:13px;padding:12px">No hay incidencias en el rango seleccionado.</div>';
  var size = 180, cx = 90, cy = 90, radius = 62, sw = 26;
  var circ = 2*Math.PI*radius;
  var acumulado = 0;
  var svg = '<svg viewBox="0 0 '+size+' '+size+'" style="width:100%;height:auto;max-width:190px;overflow:visible">';
  var etiquetas = '';
  datos.forEach(function(d){
    if (!d.value) return;
    var frac = d.value/total;
    var dash = frac*circ;
    var onclick = 'mostrarIncidenciasCategoria(\''+d.label+'\')';
    svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+radius+'" fill="none" stroke="'+d.color+'" stroke-width="'+sw+'" ' +
      'stroke-dasharray="'+dash.toFixed(2)+' '+(circ-dash).toFixed(2)+'" stroke-dashoffset="'+(-acumulado).toFixed(2)+'" ' +
      'transform="rotate(-90 '+cx+' '+cy+')" style="cursor:pointer" onclick="'+onclick+'"><title>'+catEs(d.label)+': '+d.value+'</title></circle>';
    var pct = Math.round(frac*100);
    if (pct >= 6) {
      var midFrac = (acumulado/circ) + frac/2;
      var ang = (-90 + midFrac*360) * Math.PI/180;
      var lx = cx + radius*Math.cos(ang);
      var ly = cy + radius*Math.sin(ang);
      etiquetas += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="#fff" style="cursor:pointer" onclick="'+onclick+'">'+pct+'%</text>';
    }
    acumulado += dash;
  });
  svg += etiquetas;
  svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+(radius-sw/2-2)+'" fill="#fff"></circle>';
  svg += '<text x="'+cx+'" y="'+(cy+6)+'" text-anchor="middle" font-size="22" font-weight="700" fill="#0F1B2D">'+total+'</text>';
  svg += '</svg>';
  var leyenda = '<div style="display:flex;flex-direction:column;gap:8px;min-width:160px">' + datos.filter(function(d){ return d.value>0; }).map(function(d){
    var pct = Math.round(d.value/total*100);
    return '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#2C3E50;cursor:pointer" onclick="mostrarIncidenciasCategoria(\''+d.label+'\')">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:'+d.color+';display:inline-block;flex-shrink:0"></span>' +
      '<span>'+catEs(d.label)+'</span>' +
      '<span style="margin-left:auto;color:#7A8FA6;font-size:12px">'+d.value+' · '+pct+'%</span></div>';
  }).join('') + '</div>';
  return svg + leyenda;
}

var INF_COLOR_LINEA = "#14b8a6";

// Muestra/oculta el tooltip flotante de la gráfica de barras de Informes.
// Se llama desde onmouseover/onmousemove/onmouseout puestos directamente en
// cada <rect> generado por construirGraficoLineal() (onmouseenter/leave NO
// están garantizados como atributos inline en SVG, a diferencia de HTML;
// onmouseover/onmouseout sí lo están desde SVG 1.1).
function mostrarTooltipInforme(ev, etiqueta, total) {
  var tip = document.getElementById("inf-tooltip");
  if (!tip) return;
  tip.textContent = etiqueta + ": " + total + (total===1?" incidencia":" incidencias");
  tip.style.left = (ev.clientX + 12) + "px";
  tip.style.top = (ev.clientY - 10) + "px";
  tip.style.display = "block";
}
function ocultarTooltipInforme() {
  var tip = document.getElementById("inf-tooltip");
  if (tip) tip.style.display = "none";
}

function construirGraficoLineal(filasMes, esDiario) {
  if (!filasMes.length) return '<div style="color:#7A8FA6;font-size:13px;padding:12px">No hay incidencias en el rango seleccionado.</div>';
  var etiquetar = esDiario ? diaCorto : nombreMesCorto;
  var width = 760, height = 200, padding = { left: 26, right: 16, top: 16, bottom: 28 };
  var plotW = width - padding.left - padding.right, plotH = height - padding.top - padding.bottom;
  var maxV = Math.max.apply(null, filasMes.map(function(f){ return f.total; }).concat([1]));
  var n = filasMes.length;
  var gap = n > 45 ? 1 : (n > 20 ? 2 : 4);
  var barW = Math.max(1, (plotW - gap*(n-1)) / n);
  function xAt(i) { return padding.left + i*(barW+gap); }
  function hAt(v) { return maxV>0 ? (v/maxV)*plotH : 0; }
  var etiquetaCada = Math.ceil(n/10) || 1;
  var svg = '<svg viewBox="0 0 '+width+' '+height+'" style="width:100%;height:auto;max-width:100%">';
  svg += '<text x="8" y="'+(padding.top+plotH/2)+'" font-size="10" fill="#9AA6B2" text-anchor="middle" transform="rotate(-90 8 '+(padding.top+plotH/2)+')">Incidencias</text>';
  filasMes.forEach(function(f,i){
    var h = Math.max(hAt(f.total), f.total>0 ? 1.5 : 0);
    var x = xAt(i), y = padding.top + plotH - h;
    var etiqueta = etiquetar(f.mes).replace(/'/g, "&#39;");
    svg += '<rect x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+barW.toFixed(2)+'" height="'+h.toFixed(2)+'" rx="1.5" ' +
      'fill="'+INF_COLOR_LINEA+'" style="cursor:pointer;transition:opacity .1s" ' +
      'onmouseover="this.style.opacity=0.65;mostrarTooltipInforme(event,\''+etiqueta+'\','+f.total+')" ' +
      'onmousemove="mostrarTooltipInforme(event,\''+etiqueta+'\','+f.total+')" ' +
      'onmouseout="this.style.opacity=1;ocultarTooltipInforme()"></rect>';
    if (i % etiquetaCada === 0 || i === n-1) {
      svg += '<text x="'+(x+barW/2).toFixed(2)+'" y="'+(height-8)+'" font-size="10" fill="#9AA6B2" text-anchor="middle">'+etiqueta+'</text>';
    }
  });
  svg += '</svg>';
  return svg;
}

function generarImagenGraficoCircularCanvas(datos, cssW, cssH) {
  var dpr = 3;
  var canvas = document.createElement("canvas");
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  var ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  var total = datos.reduce(function(s,d){ return s+d.value; }, 0);
  var cx = cssW/2, cy = cssH/2;
  var halfCanvas = Math.min(cssW,cssH)/2;
  var margen = 4, proporcionTrazo = 0.32;
  var radius = (halfCanvas - margen) / (1 + proporcionTrazo/2);
  var sw = radius*proporcionTrazo;
  if (total) {
    var start = -Math.PI/2;
    datos.forEach(function(d){
      if (!d.value) return;
      var ang = (d.value/total)*Math.PI*2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start+ang);
      ctx.lineWidth = sw;
      ctx.strokeStyle = d.color;
      ctx.stroke();
      var pct = Math.round((d.value/total)*100);
      if (pct >= 6) {
        var midAng = start + ang/2;
        var lx = cx + radius*Math.cos(midAng);
        var ly = cy + radius*Math.sin(midAng);
        ctx.fillStyle = "#fff";
        ctx.font = "bold " + Math.round(cssH*0.055) + "px Helvetica, Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(pct + "%", lx, ly);
      }
      start += ang;
    });
  }
  ctx.fillStyle = "#0F1B2D";
  ctx.font = "bold " + Math.round(cssH*0.16) + "px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy);
  return canvas;
}

function generarImagenGraficoLinealCanvas(filasMes, cssW, cssH, esDiario) {
  var etiquetar = esDiario ? diaCorto : nombreMesCorto;
  var dpr = 3;
  var canvas = document.createElement("canvas");
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  var ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  var padding = { left: 20, right: 20, top: 10, bottom: 20 };
  var plotW = cssW-padding.left-padding.right, plotH = cssH-padding.top-padding.bottom;
  if (!filasMes.length) return canvas;
  var maxV = Math.max.apply(null, filasMes.map(function(f){ return f.total; }).concat([1]));
  var n = filasMes.length;
  var gap = n > 45 ? 0.5 : (n > 20 ? 1 : 2);
  var barW = Math.max(0.5, (plotW - gap*(n-1)) / n);
  function xAt(i) { return padding.left + i*(barW+gap); }
  function hAt(v) { return maxV>0 ? (v/maxV)*plotH : 0; }
  ctx.fillStyle = INF_COLOR_LINEA;
  filasMes.forEach(function(f,i){
    var h = Math.max(hAt(f.total), f.total>0 ? 1 : 0);
    ctx.fillRect(xAt(i), padding.top+plotH-h, barW, h);
  });
  var etiquetaCada = Math.ceil(n/7) || 1;
  ctx.fillStyle = "#9AA6B2"; ctx.textAlign = "center"; ctx.font = "8px Helvetica, Arial, sans-serif";
  filasMes.forEach(function(f,i){
    if (i % etiquetaCada !== 0 && i !== n-1) return;
    ctx.fillText(etiquetar(f.mes), xAt(i)+barW/2, cssH-6);
  });
  return canvas;
}

function resumenMensualCompleto(lista) {
  var porMes = {};
  lista.forEach(function(d){
    var m = (d.fecha||"").slice(0,7);
    if (!m) return;
    if (!porMes[m]) {
      porMes[m] = { mes:m, total:0, criticas:0, altas:0, medias:0, bajas:0, abiertas:0, cerradas:0, categorias:{} };
      INF_CATEGORIAS.forEach(function(c){ porMes[m].categorias[c] = 0; });
    }
    var f = porMes[m];
    f.total++;
    if (d.gravedad==="Crítica") f.criticas++;
    else if (d.gravedad==="Alta") f.altas++;
    else if (d.gravedad==="Media") f.medias++;
    else if (d.gravedad==="Baja") f.bajas++;
    if (d.estat==="Obert") f.abiertas++; else f.cerradas++;
    if (f.categorias[d.categoria] !== undefined) f.categorias[d.categoria]++;
  });
  return Object.keys(porMes).sort().map(function(m){ return porMes[m]; });
}

// Igual que resumenMensualCompleto() pero agrupado por día en vez de por
// mes, para cuando el rango cae dentro de un único mes (p. ej. MTD): un
// solo punto por mes no sirve para ver una tendencia. Rellena TODOS los
// días entre desde/hasta (con total 0 si no hubo incidencias ese día), no
// solo los días con datos, para que el eje X represente el calendario real
// sin huecos que distorsionen la gráfica.
function resumenDiarioCompleto(lista, desde, hasta) {
  var porDia = {};
  lista.forEach(function(d){
    var f = d.fecha || "";
    if (!f) return;
    if (!porDia[f]) {
      porDia[f] = { total:0, criticas:0, altas:0, medias:0, bajas:0, abiertas:0, cerradas:0, categorias:{} };
      INF_CATEGORIAS.forEach(function(c){ porDia[f].categorias[c] = 0; });
    }
    var fila = porDia[f];
    fila.total++;
    if (d.gravedad==="Crítica") fila.criticas++;
    else if (d.gravedad==="Alta") fila.altas++;
    else if (d.gravedad==="Media") fila.medias++;
    else if (d.gravedad==="Baja") fila.bajas++;
    if (d.estat==="Obert") fila.abiertas++; else fila.cerradas++;
    if (fila.categorias[d.categoria] !== undefined) fila.categorias[d.categoria]++;
  });
  if (!desde || !hasta) return Object.keys(porDia).sort().map(function(f){ return Object.assign({ mes: f }, porDia[f]); });
  function filaVacia() {
    var v = { total:0, criticas:0, altas:0, medias:0, bajas:0, abiertas:0, cerradas:0, categorias:{} };
    INF_CATEGORIAS.forEach(function(c){ v.categorias[c] = 0; });
    return v;
  }
  var filas = [];
  var actual = new Date(desde + "T00:00:00");
  var fin = new Date(hasta + "T00:00:00");
  while (actual <= fin) {
    var clave = actual.toISOString().slice(0,10);
    filas.push(Object.assign({ mes: clave }, porDia[clave] || filaVacia()));
    actual.setDate(actual.getDate()+1);
  }
  return filas;
}

// Abre un modal con las incidencias de una categoría concreta dentro del
// rango de fechas actualmente seleccionado en Informes. Se llama al hacer
// clic en un porcentaje/segmento del gráfico circular o en su leyenda.
// Fila de una incidencia dentro del modal de listado genérico (ver
// mostrarListadoIncidenciasModal). Al hacer clic se cierra el modal y se
// abre el detalle completo de esa incidencia.
function filaListadoIncidencia(d) {
  return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F0F2F5;cursor:pointer" ' +
    'onclick="tancarModal(\'modal-categoria-informe\');obrirDetall(\''+d.id+'\')">' +
    '<span class="badge '+badgeGravClass(d.gravedad)+'" style="flex-shrink:0">'+badgeGravLabel(d.gravedad)+'</span>' +
    '<div style="flex:1;min-width:0">' +
    '<div style="font-size:12px;color:#7A8FA6">'+formatData(d.fecha)+' · '+d.hora+'h · '+(d.ubicacion||"")+' · '+
    '<span class="badge badge-cat" style="font-size:10px;padding:1px 6px">'+catEs(d.categoria)+'</span></div>' +
    '<div style="font-size:13px;color:#2C3E50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(d.resum||d.descripcion||"")+'</div>' +
    '</div>' +
    '<span class="badge '+(d.estat==="Obert"?"badge-obert":"badge-tancat")+'" style="flex-shrink:0">'+estadoEs(d.estat)+'</span>' +
    '</div>';
}

// Modal genérico de listado: usado por el gráfico circular de Informes y
// por los contadores (Total, Críticas, Altas, Abiertas, Este mes, y los
// del panel de KPIs) para mostrar de un vistazo las incidencias detrás de
// un número, con acceso directo al detalle de cada una.
function mostrarListadoIncidenciasModal(titulo, lista) {
  var listaOrdenada = lista.slice().sort(function(a,b){ return (b.fecha+b.hora).localeCompare(a.fecha+a.hora); });
  var tituloEl = document.getElementById("categoria-informe-titulo");
  if (tituloEl) tituloEl.textContent = titulo + " (" + listaOrdenada.length + ")";
  var body = document.getElementById("categoria-informe-body");
  if (body) {
    body.innerHTML = listaOrdenada.length ? listaOrdenada.map(filaListadoIncidencia).join("") :
      '<div style="color:#7A8FA6;font-size:13px;padding:12px">No hay incidencias que coincidan.</div>';
  }
  document.getElementById("modal-categoria-informe").classList.add("open");
}
window.mostrarListadoIncidenciasModal = mostrarListadoIncidenciasModal;

function mostrarIncidenciasCategoria(categoria) {
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta).filter(function(d){ return d.categoria === categoria; });
  mostrarListadoIncidenciasModal(catEs(categoria), lista);
}

function renderInformes() {
  inicializarFechasInformes();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  var grafico = document.getElementById("inf-grafico");
  if (grafico) grafico.innerHTML = construirGraficoCircular(datosGraficoTema(lista));
  var filasAsc = resumenMensualCompleto(lista);
  // Si el rango cae dentro de un único mes (como MTD), un solo punto
  // mensual no sirve para ver tendencia: se agrupa por días en su lugar.
  var esRangoDiario = !!(rango.desde && rango.hasta && rango.desde.slice(0,7) === rango.hasta.slice(0,7));
  var filasGrafico = esRangoDiario ? resumenDiarioCompleto(lista, rango.desde, rango.hasta) : filasAsc;
  var graficoLineal = document.getElementById("inf-grafico-lineal");
  if (graficoLineal) graficoLineal.innerHTML = construirGraficoLineal(filasGrafico, esRangoDiario);
  var actualizado = document.getElementById("inf-lineal-actualizado");
  if (actualizado) actualizado.textContent = "Última actualización " + new Date().toLocaleTimeString("es-ES");
  var filas = filasAsc.slice().reverse();
  var tbody = document.getElementById("inf-tbody-mensual");
  if (tbody) {
    tbody.innerHTML = filas.length ? filas.map(function(f){
      return '<tr><td>'+nombreMes(f.mes)+'</td><td>'+f.total+'</td><td>'+f.criticas+'</td><td>'+f.altas+'</td><td>'+f.abiertas+'</td></tr>';
    }).join("") : '<tr class="empty-row"><td colspan="5">No hay incidencias en el rango seleccionado.</td></tr>';
  }
}

function establecerRangoMTD() {
  var hoy = new Date().toISOString().slice(0,10);
  document.getElementById("inf-desde").value = hoy.slice(0,7) + "-01";
  document.getElementById("inf-hasta").value = hoy;
  renderInformes();
}

function tituloRangoInforme(rango) {
  if (!rango.desde && !rango.hasta) return "Todo el histórico";
  return (rango.desde?formatData(rango.desde):"inicio") + "  —  " + (rango.hasta?formatData(rango.hasta):"actualidad");
}

async function generarPDFInforme(lista, rango, sufijo) {
  if (!lista.length) { alert("No hay incidencias en el rango seleccionado."); return; }
  try { await asegurarLibreriasPDF(); } catch (e) { alert("No se ha podido cargar el generador de PDF."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("No se ha podido cargar el generador de PDF."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  var margenIzq = 14, anchoUtil = 182;
  var temas = datosGraficoTema(lista);
  var totalTemas = temas.reduce(function(s,d){ return s+d.value; }, 0);
  var filasMes = resumenMensualCompleto(lista);
  // Igual que en la web: si el rango cae dentro de un único mes (MTD), la
  // gráfica de evolución se agrupa por días en vez de por meses -- el
  // "Resumen mensual" de la tabla de abajo sigue siendo mensual.
  var esRangoDiario = !!(rango.desde && rango.hasta && rango.desde.slice(0,7) === rango.hasta.slice(0,7));
  var filasGrafico = esRangoDiario ? resumenDiarioCompleto(lista, rango.desde, rango.hasta) : filasMes;
  var criticas = lista.filter(function(d){ return d.gravedad==="Crítica"; }).length;
  var altas = lista.filter(function(d){ return d.gravedad==="Alta"; }).length;
  var abiertas = lista.filter(function(d){ return d.estat==="Obert"; }).length;
  var cerradas = lista.length - abiertas;

  function encabezado() {
    doc.setFillColor(15,27,45);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold"); doc.setFontSize(15);
    doc.text("Informe de Incidencias de Seguridad", margenIzq, 12);
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.setTextColor(232,237,242);
    doc.text("Vilamarina · Oficina de Gerencia", margenIzq, 18);
    doc.setTextColor(74,85,104); doc.setFontSize(9);
    doc.text("Periodo: " + tituloRangoInforme(rango), margenIzq, 31);
    doc.text("Generado: " + new Date().toLocaleString("es-ES"), 210-margenIzq, 31, { align: "right" });
    doc.setDrawColor(226,230,234);
    doc.line(margenIzq, 34, 210-margenIzq, 34);
  }
  encabezado();

  doc.autoTable({
    startY: 40,
    margin: { top: 38, left: margenIzq, right: margenIzq },
    head: [["Total","Críticas","Altas","Abiertas","Cerradas"]],
    body: [[lista.length, criticas, altas, abiertas, cerradas]],
    theme: "grid",
    headStyles: { fillColor: [15,27,45], textColor: 255, halign: "center", fontStyle: "bold" },
    bodyStyles: { halign: "center", fontSize: 12, fontStyle: "bold", textColor: [15,27,45] },
    styles: { cellPadding: 4 }
  });

  var y = doc.lastAutoTable.finalY + 10;
  doc.setTextColor(15,27,45); doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text("Incidencias por tema", margenIzq, y);
  doc.text("Evolución mensual de incidencias", margenIzq + 70, y);
  var pieW = 62, pieH = 62, lineW = 110, lineH = 57;
  var pieCanvas = generarImagenGraficoCircularCanvas(temas, 240, 240);
  doc.addImage(pieCanvas.toDataURL("image/png"), "PNG", margenIzq, y + 4, pieW, pieH);
  var lineCanvas = generarImagenGraficoLinealCanvas(filasGrafico, 460, 240, esRangoDiario);
  doc.addImage(lineCanvas.toDataURL("image/png"), "PNG", margenIzq + 70, y + 4, lineW, lineH);
  y = y + 4 + Math.max(pieH, lineH) + 8;

  doc.setTextColor(15,27,45); doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text("Detalle por categoría", margenIzq, y);
  doc.autoTable({
    startY: y + 4,
    margin: { top: 38, left: margenIzq, right: margenIzq },
    head: [["Categoría","Cantidad","% del total"]],
    body: temas.map(function(t){ return [catEs(t.label), t.value, (totalTemas?Math.round(t.value/totalTemas*100):0) + "%"]; }),
    theme: "striped",
    headStyles: { fillColor: [245,158,11], textColor: [15,27,45], fontStyle: "bold" },
    styles: { fontSize: 10 }
  });

  y = doc.lastAutoTable.finalY + 10;
  if (y > 250) { doc.addPage(); encabezado(); y = 42; }
  doc.setTextColor(15,27,45); doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text("Resumen mensual", margenIzq, y);
  doc.autoTable({
    startY: y + 4,
    margin: { top: 38, left: margenIzq, right: margenIzq },
    head: [["Mes","Total","Críticas","Altas","Medias","Bajas",catEs("Robatori"),catEs("Danys"),catEs("Accident Parking"),catEs("Accident CC"),catEs("Accident Laboral"),catEs("Incidència Baixa"),"Abiertas","Cerradas"]],
    body: filasMes.map(function(f){
      return [nombreMes(f.mes), f.total, f.criticas, f.altas, f.medias, f.bajas,
        f.categorias["Robatori"], f.categorias["Danys"], f.categorias["Accident Parking"], f.categorias["Accident CC"], f.categorias["Accident Laboral"], f.categorias["Incidència Baixa"],
        f.abiertas, f.cerradas];
    }),
    foot: [["TOTAL", lista.length,
      filasMes.reduce(function(s,f){return s+f.criticas;},0), filasMes.reduce(function(s,f){return s+f.altas;},0),
      filasMes.reduce(function(s,f){return s+f.medias;},0), filasMes.reduce(function(s,f){return s+f.bajas;},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Robatori"];},0), filasMes.reduce(function(s,f){return s+f.categorias["Danys"];},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Accident Parking"];},0), filasMes.reduce(function(s,f){return s+f.categorias["Accident CC"];},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Accident Laboral"];},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Incidència Baixa"];},0),
      filasMes.reduce(function(s,f){return s+f.abiertas;},0), filasMes.reduce(function(s,f){return s+f.cerradas;},0)]],
    theme: "grid",
    showFoot: "lastPage",
    headStyles: { fillColor: [15,27,45], textColor: 255, fontSize: 7.5, halign: "center" },
    footStyles: { fillColor: [240,242,245], textColor: [15,27,45], fontSize: 7.5, halign: "center", fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, halign: "center" },
    styles: { cellPadding: 2 },
    didDrawPage: function () { encabezado(); }
  });

  var paginas = doc.internal.getNumberOfPages();
  for (var p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(122,143,166);
    doc.text("Página " + p + " de " + paginas, 210-margenIzq, 290, { align: "right" });
    doc.text("Documento generado automáticamente por el sistema de gestión de incidencias.", margenIzq, 290);
  }

  doc.save("informe_incidencias_" + sufijo + "_vilamarina.pdf");
}

function descargarInformeMensualPDF() {
  inicializarFechasInformes();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  var sufijo = (rango.desde||"inicio") + "_a_" + (rango.hasta||"actual");
  generarPDFInforme(lista, rango, sufijo);
}

function descargarInformeYTDPDF() {
  establecerRangoYTD();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  generarPDFInforme(lista, rango, "YTD_" + rango.hasta.slice(0,4));
}

function descargarInformeMTDPDF() {
  establecerRangoMTD();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  generarPDFInforme(lista, rango, "MTD_" + rango.hasta.slice(0,7));
}

// AFECTATS
async function exportarAfectatsPDF() {
  if (!afectats.length) { alert("No hay afectados para exportar."); return; }
  const columnas = ["Nombre","DNI/NIE","Teléfono","Incidencia vinculada","Asist. médica","Consentimiento"];
  const filas = afectats.map(a => {
    const inc = incidencies.find(i=>i.id===a.incidenciaId);
    return [a.nom, a.dni, a.tel, inc?`#${inc.id} ${catEs(inc.categoria)} (${formatData(inc.fecha)})`:"—", a.medica, a.consentiment];
  });
  await exportarTablaPDF("Afectados / Clientes", columnas, filas, `afectados_vilamarina_${new Date().toISOString().slice(0,10)}.pdf`);
}

function renderAfectats() {
  const tbody = document.getElementById("tbody-afectats");
  if (!afectats.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="empty-icon">👤</div>Aún no hay afectados registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = afectats.map(a => {
    const inc = incidencies.find(i=>i.id===a.incidenciaId);
    return `<tr>
      <td>${a.nom}</td>
      <td class="td-muted">${a.dni}</td>
      <td class="td-muted">${a.tel}</td>
      <td class="td-muted" style="font-size:12px">${inc?`#${inc.id} ${catEs(inc.categoria)} (${formatData(inc.fecha)})`:"—"}</td>
      <td><span class="badge ${a.medica==='Sí'?'badge-critica':'badge-baja'}">${a.medica}</span></td>
      <td><span class="badge ${a.consentiment==='Sí'?'badge-baja':'badge-alta'}">${a.consentiment}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="obrirDetallAfectat(${a.id})">Ver incidencia</button></td>
    </tr>`;
  }).join("");
}

function obrirModalAfectat() {
  ["a-nom","a-dni","a-tel","a-email","a-adreca","a-hospital","a-part-medic","a-matricula","a-num-ambulancia","a-tecnico","a-declaracio","a-test-nom","a-test-tel"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("a-naix").value="";
  document.getElementById("a-medica").value="No";
  document.getElementById("a-consentiment").value="Sí";
  document.getElementById("a-testimonis").value="No";
  document.getElementById("bloc-testimoni").style.display="none";
  const sel = document.getElementById("a-incidencia");
  sel.innerHTML = '<option value="">Sin vincular</option>'+incidencies.map(i=>`<option value="${i.id}">#${i.id} — ${catEs(i.categoria)} (${formatData(i.fecha)})</option>`).join("");
  document.getElementById("modal-afectat").classList.add("open");
}

function toggleTestimoni() {
  document.getElementById("bloc-testimoni").style.display = document.getElementById("a-testimonis").value==="Sí"?"grid":"none";
}

function guardarAfectat() {
  const nom = document.getElementById("a-nom").value.trim();
  const dni = document.getElementById("a-dni").value.trim();
  const tel = document.getElementById("a-tel").value.trim();
  if (!nom||!dni||!tel) { alert("Rellena los campos obligatorios: nombre, DNI y teléfono."); return; }
  afectats.push({
    id: nextAfectatId++, nom, dni, tel,
    naix: document.getElementById("a-naix").value,
    email: document.getElementById("a-email").value.trim(),
    adreca: document.getElementById("a-adreca").value.trim(),
    incidenciaId: parseInt(document.getElementById("a-incidencia").value)||null,
    medica: document.getElementById("a-medica").value,
    hospital: document.getElementById("a-hospital").value.trim(),
    partMedic: document.getElementById("a-part-medic").value.trim(),
    matricula: document.getElementById("a-matricula").value.trim(),
    numAmbulancia: document.getElementById("a-num-ambulancia").value.trim(),
    tecnico: document.getElementById("a-tecnico").value.trim(),
    declaracio: document.getElementById("a-declaracio").value.trim(),
    consentiment: document.getElementById("a-consentiment").value,
    testimonis: document.getElementById("a-testimonis").value,
    testNom: document.getElementById("a-test-nom").value.trim(),
    testTel: document.getElementById("a-test-tel").value.trim(),
  });
  tancarModal("modal-afectat");
  renderAfectats();
}

function obrirDetallAfectat(id) {
  const a = afectats.find(x=>x.id===id);
  if (!a) return;
  afectatDetallActual = a;
  const inc = incidencies.find(i=>i.id===a.incidenciaId);
  document.getElementById("da-titol").textContent = a.nom;
  document.getElementById("da-body").innerHTML = `
    <div class="detail-section"><div class="detail-section-title">Datos personales</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Nombre completo</div><div class="detail-value">${a.nom}</div></div>
      <div class="detail-item"><div class="detail-label">DNI/NIE/Pasaporte</div><div class="detail-value">${a.dni}</div></div>
      <div class="detail-item"><div class="detail-label">Fecha de nacimiento</div><div class="detail-value">${formatData(a.naix)}</div></div>
      <div class="detail-item"><div class="detail-label">Teléfono</div><div class="detail-value">${a.tel}</div></div>
      <div class="detail-item"><div class="detail-label">Correo</div><div class="detail-value">${a.email||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Dirección</div><div class="detail-value">${a.adreca||"—"}</div></div>
    </div></div>
    <div class="detail-section"><div class="detail-section-title">Incidencia y asistencia médica</div>
    <div class="detail-grid">
      <div class="detail-item detail-full"><div class="detail-label">Incidencia vinculada</div><div class="detail-value">${inc?`#${inc.id} — ${catEs(inc.categoria)} (${formatData(inc.fecha)}) · ${inc.ubicacion}`:"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Asistencia médica</div><div class="detail-value">${a.medica}</div></div>
      <div class="detail-item"><div class="detail-label">Centro médico</div><div class="detail-value">${a.hospital||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Nº parte médico</div><div class="detail-value">${a.partMedic||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Número de matrícula</div><div class="detail-value">${a.matricula||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Nº identificativo ambulancia</div><div class="detail-value">${a.numAmbulancia||"—"}</div></div>
      <div class="detail-item detail-full"><div class="detail-label">Técnico responsable / médico</div><div class="detail-value">${a.tecnico||"—"}</div></div>
    </div></div>
    <div class="detail-section"><div class="detail-section-title">Declaración y testigos</div>
    <div class="detail-grid">
      <div class="detail-item detail-full"><div class="detail-label">Declaración del afectado</div><div class="detail-value" style="font-size:13px;color:#4A5568">${a.declaracio||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Consentimiento</div><div class="detail-value"><span class="badge ${a.consentiment==='Sí'?'badge-baja':'badge-alta'}">${a.consentiment}</span></div></div>
      <div class="detail-item"><div class="detail-label">Testigos</div><div class="detail-value">${a.testimonis}</div></div>
      ${a.testimonis==="Sí"?`<div class="detail-item"><div class="detail-label">Nombre del testigo</div><div class="detail-value">${a.testNom||"—"}</div></div><div class="detail-item"><div class="detail-label">Tel. testigo</div><div class="detail-value">${a.testTel||"—"}</div></div>`:""}
    </div></div>`;
  document.getElementById("modal-detall-afectat").classList.add("open");
}

async function generarFichaAfectadoPDF(a, inc) {
  try { await asegurarLibreriasPDF(); } catch (e) { alert("No se ha podido cargar el generador de PDF."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("No se ha podido cargar el generador de PDF."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  var margenIzq = 14, anchoUtil = 182;
  var cursor = 38;

  // Cabecera
  if (window.VILAMARINA_LOGO_B64) {
    var logoW = 34, logoH = logoW / (163/77);
    doc.addImage(window.VILAMARINA_LOGO_B64, "PNG", 210-margenIzq-logoW, 10, logoW, logoH);
  }
  doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(15,27,45);
  doc.text("FICHA DE AFECTADO / CLIENTE", margenIzq, 20);
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(90,107,123);
  doc.text("Centre Comercial Vilamarina", margenIzq, 27);
  doc.setDrawColor(226,230,234); doc.line(margenIzq, 32, 210-margenIzq, 32);

  function campo(x, y, w, h, label, valor) {
    doc.setDrawColor(209,217,224); doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1, 1);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(122,143,166);
    doc.text(label, x+3, y+4.5);
    if (valor) {
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(15,27,45);
      var lineas = doc.splitTextToSize(String(valor), w-6);
      doc.text(lineas.slice(0,2), x+3, y+9.5);
    }
  }

  function filaCampos(campos, h) {
    var n = campos.length;
    var w = (anchoUtil - 4*(n-1)) / n;
    var x = margenIzq;
    campos.forEach(function(c){ campo(x, cursor, w, h, c.label, c.valor); x += w+4; });
    cursor += h + 4;
  }

  function tituloSeccion(numero, titulo) {
    doc.setFillColor(15,27,45);
    doc.rect(margenIzq, cursor, anchoUtil, 6, "F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text(numero + ". " + titulo, margenIzq+3, cursor+4.3);
    cursor += 6 + 4;
  }

  function filaCheckbox(label, marcado) {
    var y = cursor + 4;
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(15,27,45);
    doc.text(label, margenIzq, y);
    var x = margenIzq + doc.getTextWidth(label) + 8;
    ["Sí","No"].forEach(function(opt){
      doc.setDrawColor(15,27,45); doc.setLineWidth(0.35);
      doc.rect(x, y-3.2, 3.6, 3.6);
      if (marcado === opt) {
        doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(15,27,45);
        doc.text("X", x+0.7, y-0.5);
      }
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(15,27,45);
      doc.text(opt, x+5, y);
      x += 5 + doc.getTextWidth(opt) + 10;
    });
    cursor += 8;
  }

  function bloqueTexto(label, texto, alto, lineasGuia) {
    doc.setDrawColor(209,217,224); doc.setLineWidth(0.2);
    doc.roundedRect(margenIzq, cursor, anchoUtil, alto, 1, 1);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(122,143,166);
    doc.text(label, margenIzq+3, cursor+5);
    if (texto) {
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(26,26,46);
      doc.text(doc.splitTextToSize(texto, anchoUtil-6), margenIzq+3, cursor+11);
    } else {
      doc.setDrawColor(230,232,236);
      for (var i=1; i<=(lineasGuia||3); i++) {
        var ly = cursor + 8 + i*6;
        if (ly < cursor+alto-3) doc.line(margenIzq+3, ly, margenIzq+anchoUtil-3, ly);
      }
    }
    cursor += alto + 4;
  }

  function filaTestigos(nombre, telefono, alto) {
    var w = (anchoUtil-4)/2;
    [{label:"Nombre de los testigos", valor:nombre, x:margenIzq}, {label:"Teléfono de los testigos", valor:telefono, x:margenIzq+w+4}].forEach(function(c){
      doc.setDrawColor(209,217,224); doc.setLineWidth(0.2);
      doc.roundedRect(c.x, cursor, w, alto, 1, 1);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(122,143,166);
      doc.text(c.label, c.x+3, cursor+5);
      if (c.valor) {
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(15,27,45);
        doc.text(doc.splitTextToSize(String(c.valor), w-6).slice(0,2), c.x+3, cursor+11);
      } else {
        doc.setDrawColor(230,232,236);
        for (var i=1; i<=2; i++) {
          var ly = cursor + 8 + i*6;
          if (ly < cursor+alto-3) doc.line(c.x+3, ly, c.x+w-3, ly);
        }
      }
    });
    cursor += alto + 4;
  }

  function textoLegal() {
    doc.setFont("helvetica","normal"); doc.setFontSize(7.3); doc.setTextColor(90,107,123);
    var texto = "De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos, los datos recogidos en este formulario se utilizarán exclusivamente para la gestión de la incidencia y, en su caso, la tramitación del correspondiente parte de seguro. No serán cedidos a terceros sin consentimiento expreso, salvo obligación legal. Tiene derecho de acceso, rectificación, supresión y portabilidad de sus datos.";
    var lineas = doc.splitTextToSize(texto, anchoUtil);
    doc.text(lineas, margenIzq, cursor);
    cursor += lineas.length*3.2 + 3;
  }

  // Fila superior
  filaCampos([
    { label: "Nº Incidencia", valor: inc ? ("#"+inc.id) : "" },
    { label: "Fecha", valor: inc ? formatData(inc.fecha) : "" },
    { label: "Hora", valor: inc ? inc.hora : "" }
  ], 11);

  // 1. Datos personales del afectado
  tituloSeccion(1, "DATOS PERSONALES DEL AFECTADO");
  filaCampos([
    { label: "Nombre completo *", valor: a ? a.nom : "" },
    { label: "DNI / NIE / Pasaporte *", valor: a ? a.dni : "" }
  ], 11);
  filaCampos([
    { label: "Fecha de nacimiento", valor: a ? formatData(a.naix) : "" },
    { label: "Teléfono de contacto *", valor: a ? a.tel : "" },
    { label: "Correo electrónico", valor: a ? a.email : "" }
  ], 11);

  // 2. Datos de la incidencia
  tituloSeccion(2, "DATOS DE LA INCIDENCIA");
  filaCampos([
    { label: "Ubicación dentro del CC (zona, planta, tienda...)", valor: inc ? inc.ubicacion : "" },
    { label: "Vigilante responsable", valor: inc ? inc.vigilant : "" }
  ], 11);
  filaCheckbox("¿Requirió asistencia médica? *", a ? a.medica : undefined);
  filaCampos([
    { label: "Centro médico / Hospital donde fue atendido", valor: a ? a.hospital : "" },
    { label: "Nº parte médico / referencia asistencia", valor: a ? a.partMedic : "" }
  ], 11);
  filaCampos([
    { label: "Número de matrícula", valor: a ? a.matricula : "" },
    { label: "Número identificativo de la ambulancia", valor: a ? a.numAmbulancia : "" },
    { label: "Nombre del técnico responsable / médico", valor: a ? a.tecnico : "" }
  ], 11);

  // 3. Declaración del afectado
  tituloSeccion(3, "DECLARACIÓN DEL AFECTADO");
  bloqueTexto("Descripción de los hechos según el afectado:", a ? a.declaracio : "", 26, 3);

  // 4. Testigos
  tituloSeccion(4, "TESTIGOS");
  filaCheckbox("¿Hay testigos del hecho? *", a ? a.testimonis : undefined);
  var hayTestigos = a && a.testimonis === "Sí";
  filaTestigos(hayTestigos ? a.testNom : "", hayTestigos ? a.testTel : "", 16);

  // 5. Consentimiento y firma
  tituloSeccion(5, "CONSENTIMIENTO Y FIRMA");
  textoLegal();
  filaCampos([
    { label: "Fecha y lugar", valor: inc ? (formatData(inc.fecha) + " · " + inc.ubicacion) : "" },
    { label: "Firma del afectado", valor: "" }
  ], 13);

  doc.setFontSize(8); doc.setTextColor(122,143,166);
  doc.text("Documento generado el " + new Date().toLocaleString("es-ES") + " · Sistema de gestión de incidencias Vilamarina", margenIzq, 292);

  return doc;
}

async function descarregarFitxaAfectat() {
  if (!afectatDetallActual) return;
  const a = afectatDetallActual;
  const inc = incidencies.find(i=>i.id===a.incidenciaId);
  const doc = await generarFichaAfectadoPDF(a, inc);
  if (doc) doc.save(`ficha_afectado_${a.nom.replace(/ /g,"_")}.pdf`);
}

async function descarregarPlantillaPDF() {
  const doc = await generarFichaAfectadoPDF(null, null);
  if (doc) doc.save("plantilla_ficha_afectado_vilamarina.pdf");
}

// BACKUP
function renderBackup() {
  const mesos = [...new Set(incidencies.map(i=>i.fecha.slice(0,7)))].sort().reverse();
  const noms = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const container = document.getElementById("backup-months");
  if (!mesos.length) { container.innerHTML='<div style="color:#7A8FA6;font-size:13px;padding:12px">Aún no hay incidencias registradas.</div>'; return; }
  container.innerHTML = mesos.map(m=>{
    const [y,mo]=m.split("-");
    const count=incidencies.filter(i=>i.fecha.startsWith(m)).length;
    return `<div class="month-card"><div class="month-card-info"><strong>${noms[parseInt(mo)-1]} ${y}</strong><span>${count} incidencia${count!==1?"s":""}</span></div><button class="btn btn-primary btn-sm" onclick="exportarBackupMes('${m}')"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Descargar</button></div>`;
  }).join("");
}

function generarContingutBackup(llista) {
  let txt = `BACKUP INCIDENCIAS — VILAMARINA\nBarna Porters S.L. · Oficina de Gerencia\nGenerado: ${new Date().toLocaleString("es-ES")}\n${"=".repeat(60)}\n\n`;
  llista.forEach(d=>{
    const af=afectats.filter(a=>a.incidenciaId===d.id);
    txt+=`INCIDENCIA #${d.id}\n${"-".repeat(40)}\nFecha: ${formatData(d.fecha)} ${d.hora}h\nGravedad: ${d.gravedad}\nCategoría: ${catEs(d.categoria)}\nUbicación: ${d.ubicacion}\nEstado: ${estadoEs(d.estat)}\nVigilante: ${d.vigilant||"—"}\n\nResumen: ${d.resum||"—"}\nDescripción: ${d.descripcion}\nMedidas adoptadas: ${d.accion||"—"}\n`;
    if(d.imgCarpeta||d.imgRuta) txt+=`\nIMÁGENES/VÍDEOS:\n  Carpeta: ${d.imgCarpeta||"—"}\n  Ruta: ${d.imgRuta||"—"}\n  Obs: ${d.imgObs||"—"}\n`;
    if(d.correo) txt+=`\nCORREO ORIGINAL:\n${d.correo}\n`;
    if(af.length){txt+=`\nAFECTADOS (${af.length}):\n`;af.forEach(a=>{txt+=`  - ${a.nom} | DNI: ${a.dni} | Tel: ${a.tel} | Médica: ${a.medica} | Consentimiento: ${a.consentiment}\n`;});}
    txt+=`\n${"=".repeat(60)}\n\n`;
  });
  return txt;
}

function exportarBackupMes(mes) {
  const [y,mo]=mes.split("-");
  const noms=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const llista=incidencies.filter(i=>i.fecha.startsWith(mes));
  const txt=generarContingutBackup(llista);
  const blob=new Blob([txt],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`backup_${noms[parseInt(mo)-1]}_${y}_vilamarina.txt`; a.click();
  URL.revokeObjectURL(url);
}

function exportarBackupComplet() {
  if(!incidencies.length){alert("No hay incidencias para exportar.");return;}
  const txt=generarContingutBackup(incidencies);
  const blob=new Blob([txt],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`backup_completo_vilamarina_${new Date().toISOString().slice(0,10)}.txt`; a.click();
  URL.revokeObjectURL(url);
}

function tancarModal(id){document.getElementById(id).classList.remove("open");}
function tancarModalFons(e,id){if(e.target===document.getElementById(id))tancarModal(id);}

// INIT
actualitzarMetriques();
renderTabla();


/* === Capa de visualización en castellano (añadida) ===
   Traduce SOLO las etiquetas visibles de categoría y estado que aún
   se muestran con su clave interna (Robatori, Danys, Obert, etc.),
   sin modificar los valores guardados. */
(function(){
  const LABELS = {
    'Robatori':'Robo',
    'Danys':'Daños',
    'Accident Parking':'Accidente Parking',
    'Accident CC':'Accidente CC',
    'Accident Laboral':'Accidente laboral',
    'Incidència Baixa':'Incidencia leve',
    'Obert':'Abierto',
    'Tancat':'Cerrado'
  };
  function traducirNodo(nodo){
    if (nodo.nodeType === Node.TEXT_NODE) {
      const t = nodo.nodeValue.trim();
      if (LABELS[t]) nodo.nodeValue = nodo.nodeValue.replace(t, LABELS[t]);
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT);
    let n;
    while((n = walker.nextNode())){
      const t = n.nodeValue.trim();
      if(LABELS[t]) n.nodeValue = n.nodeValue.replace(t, LABELS[t]);
    }
  }
  // Solo recorre los nodos que se acaban de añadir en cada tanda de cambios,
  // no la página entera: con la tabla de incidencias creciendo y el panel de
  // KPIs repintándose, escanear todo el <body> en cada mutación era caro.
  const obs = new MutationObserver((mutaciones)=>{
    mutaciones.forEach((m)=>{
      m.addedNodes.forEach(traducirNodo);
    });
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    traducirNodo(document.body);
    obs.observe(document.body, {childList:true, subtree:true});
  });
})();


/* ============================================================
   CONEXIÓN CON GOOGLE SHEETS (Web App) — Vilamarina
   Carga automáticamente las incidencias clasificadas por la IA.
   Añadido automáticamente. No borrar.
   ============================================================ */
const VILAMARINA_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwhgSbeZUEA5aSLEA_O80OsLGVeFn-CLaQuX3rP14TNRQgN8ZSsvij-TWGIREvPBwD0/exec";
const VILAMARINA_WRITE_SECRET = "227d8184e0f48ea7e5be0691de9601c7e56a72183a97189a";

function mapearFilaSheet(f, i) {
  var obj = {
    id: "sheet-" + (f.fecha || "") + "-" + (f.hora || "") + "-" + i,
    filaSheet: f.fila || null,
    fecha: f.fecha || "",
    hora: f.hora || "",
    gravedad: f.gravedad || "",
    categoria: f.categoria || "",
    resum: f.resumen || "",
    descripcion: f.original || f.resumen || "",
    ubicacion: "Vilamarina",
    vigilant: "",
    accion: "",
    estat: f.estat || (f.gravedad === "Crítica" ? "Obert" : "Tancat"),
    correo: "",
    enlace: f.enlace || "",
    origen: "sheets"
  };
  obj.categoria = categoriaEfectiva(obj);
  return obj;
}

function verIncidencia(id) {
  var d = incidencies.find(function(i){ return String(i.id)===String(id); });
  if (!d) return;
  obrirDetall(d.id);
}

// Caché local de la última respuesta de la Sheet: se pinta al instante al
// abrir la página (sin esperar la petición a Apps Script, que puede tardar
// varios segundos) y se sustituye en segundo plano en cuanto llega la
// respuesta real. Mejora la velocidad PERCIBIDA de carga; no evita la
// petición de red, solo evita que la página se quede vacía mientras tanto.
var VILA_CACHE_KEY = "vilamarina_cache_incidencias_v1";

function guardarCacheIncidencias(filas) {
  try {
    localStorage.setItem(VILA_CACHE_KEY, JSON.stringify({ filas: filas, guardado: Date.now() }));
  } catch (e) { /* localStorage lleno o no disponible: seguimos sin caché */ }
}

function mostrarCacheIncidencias() {
  try {
    var raw = localStorage.getItem(VILA_CACHE_KEY);
    if (!raw) return;
    var datos = JSON.parse(raw);
    if (!datos || !Array.isArray(datos.filas) || !datos.filas.length) return;
    incidencies = incidencies.filter(function (x) { return x.origen !== "sheets"; });
    var nuevas = datos.filas.map(mapearFilaSheet);
    incidencies = nuevas.concat(incidencies);
    omplirFiltresMesos();
    if (typeof renderTabla === "function") renderTabla();
    if (typeof actualitzarMetriques === "function") actualitzarMetriques();
    if (typeof renderMantenimiento === "function") renderMantenimiento();
    if (typeof window.renderKPIs === "function") window.renderKPIs();
    console.log("[Vilamarina] Mostrando " + nuevas.length + " incidencias desde caché local mientras se actualiza.");
  } catch (e) { console.warn("[Vilamarina] No se pudo leer la caché local:", e.message); }
}

async function cargarDesdeSheets() {
  return new Promise(function (resolve) {
    var cbName = "__vilaCb" + Date.now();
    var s = document.createElement("script");
    var terminado = false;
    window[cbName] = function (filas) {
      terminado = true; window.__vilaRetries = 0;
      try {
        if (Array.isArray(filas)) {
          incidencies = incidencies.filter(function (x) { return x.origen !== "sheets"; });
          var nuevas = filas.map(mapearFilaSheet);
          incidencies = nuevas.concat(incidencies);
          omplirFiltresMesos();
          if (typeof renderTabla === "function") renderTabla();
          if (typeof actualitzarMetriques === "function") actualitzarMetriques();
          if (typeof renderMantenimiento === "function") renderMantenimiento();
          if (typeof window.renderKPIs === "function") window.renderKPIs();
          console.log("[Vilamarina] Cargadas " + nuevas.length + " incidencias desde Google Sheets.");
          guardarCacheIncidencias(filas);
        }
      } catch (e) { console.warn("[Vilamarina] Error procesando datos:", e.message); }
      delete window[cbName];
      if (s.parentNode) s.parentNode.removeChild(s);
      resolve();
    };
    s.src = VILAMARINA_WEBAPP_URL + "?callback=" + cbName + "&t=" + Date.now();
    s.onerror = function () { if (!terminado) { terminado = true; delete window[cbName]; if (s.parentNode) s.parentNode.removeChild(s); if (window.__vilaRetries === undefined) window.__vilaRetries = 0; if (window.__vilaRetries < 4) { window.__vilaRetries++; console.warn("[Vilamarina] Reintentando carga (" + window.__vilaRetries + ")..."); setTimeout(function(){ cargarDesdeSheets().then(resolve); }, 1500); } else { console.warn("[Vilamarina] No se pudo cargar tras varios intentos."); resolve(); } } };
    document.body.appendChild(s);
    setTimeout(function () { if (!terminado) { terminado = true; delete window[cbName]; if (s.parentNode) s.parentNode.removeChild(s); if (window.__vilaRetries === undefined) window.__vilaRetries = 0; if (window.__vilaRetries < 4) { window.__vilaRetries++; console.warn("[Vilamarina] Timeout, reintentando (" + window.__vilaRetries + ")..."); cargarDesdeSheets().then(resolve); } else { console.warn("[Vilamarina] No se pudo cargar tras varios intentos."); resolve(); } } }, 15000);
  });
}

function actualizarAhora() {
  var btn = document.getElementById("btn-actualizar");
  var texto = document.getElementById("btn-actualizar-texto");
  if (btn) btn.disabled = true;
  if (texto) texto.textContent = "Actualizando...";
  cargarDesdeSheets().finally(function () {
    if (btn) btn.disabled = false;
    if (texto) texto.textContent = "Actualizar ahora";
  });
}

// Carga al abrir la página: primero se pinta al instante lo último que
// haya en caché local (si lo hay), y luego se lanza la petición real a
// Apps Script para sustituirlo por los datos actualizados.
mostrarCacheIncidencias();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cargarDesdeSheets);
} else {
  cargarDesdeSheets();
}

// Refresco automático cada 5 minutos
setInterval(cargarDesdeSheets, 5 * 60 * 1000);
