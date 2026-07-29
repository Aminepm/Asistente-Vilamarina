
let incidencies = [];
let afectats = [];
let nextId = 1;
let nextAfectatId = 1;
let incidenciaDetallActual = null;
let afectatDetallActual = null;

function formatData(f) { return f ? f.split("-").reverse().join("/") : "—"; }
function getMesActual() { return new Date().toISOString().slice(0,7); }
function badgeGravClass(g) { return {"Crítica":"badge-critica","Alta":"badge-alta","Media":"badge-media","Baja":"badge-baja"}[g]||""; }
function badgeGravLabel(g) { return {"Crítica":"Crítica","Alta":"Alta","Media":"Media","Baja":"Baja"}[g]||g; }
function rowClass(g) { return {"Crítica":"row-crithica","Alta":"row-alta","Media":"row-media","Baja":"row-baja"}[g]||""; }

function canviarVista(vista, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + vista).classList.add('active');
  btn.classList.add('active');
  if (vista === 'afectats') renderAfectats();
  if (vista === 'backup') renderBackup();
  if (vista === 'informes') renderInformes();
}

function omplirFiltresMesos() {
  const mesos = [...new Set(incidencies.map(i => i.fecha.slice(0,7)))].sort().reverse();
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
    if (grav && d.gravedad !== grav) return false;
    if (cat && d.categoria !== cat) return false;
    if (est && d.estat !== est) return false;
    if (mes && !((d.fecha||"").startsWith(mes) || (d.fecha||"").split("/").reverse().join("-").startsWith(mes))) return false;
    if (buscar){ var hay=((d.resum||"")+" "+(d.descripcion||"")+" "+(d.ubicacion||"")+" "+(d.categoria||"")).toLowerCase(); if(hay.indexOf(buscar)===-1) return false; }
    return true;
  });
  return res;
}

function renderTabla() {
  const filtrats = filtrar();
  const tbody = document.getElementById("tbody");
  if (!filtrats.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-icon">📋</div>${incidencies.length === 0 ? "Aún no hay incidencias registradas.<br><small>Haz clic en <strong>Nueva incidencia</strong> para añadir una.</small>" : "Ninguna incidencia coincide con los filtros seleccionados."}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtrats.map(d => `
    <tr class="${rowClass(d.gravedad)}">
      <td class="td-muted">${formatData(d.fecha)}</td>
      <td class="td-muted">${d.hora}</td>
      <td><span class="badge ${badgeGravClass(d.gravedad)}">${badgeGravLabel(d.gravedad)}</span></td>
      <td><span class="badge badge-cat">${d.categoria}</span></td>
      <td class="td-muted" style="font-size:12px">${d.ubicacion}</td>
      <td style="font-size:12px;color:#4A5568;max-width:200px">${d.resum||d.descripcion}</td>
      <td><span class="badge ${d.estat==='Obert'?'badge-obert':'badge-tancat'}">${d.estat}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="verIncidencia('${d.id}')">Ver incidencia</button></td>
    </tr>`).join("");
}

function actualitzarMetriques() {
  const mes = getMesActual();
  document.getElementById("m-total").textContent = incidencies.length;
  document.getElementById("m-critica").textContent = incidencies.filter(d=>d.gravedad==="Crítica").length;
  document.getElementById("m-alta").textContent = incidencies.filter(d=>d.gravedad==="Alta").length;
  document.getElementById("m-obertes").textContent = incidencies.filter(d=>d.estat==="Obert").length;
  document.getElementById("m-mes").textContent = incidencies.filter(d=>d.fecha.startsWith(mes)).length;
}

function obrirDetall(id) {
  const d = incidencies.find(i=>i.id===id);
  if (!d) return;
  incidenciaDetallActual = d;
  document.getElementById("detall-titol").textContent = `Incidencia #${d.id} — ${catEs(d.categoria)}`;
  document.getElementById("btn-toggle-estat").textContent = d.estat==="Obert" ? "Marcar como cerrado" : "Reabrir incidencia";
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
  d.estat = d.estat==="Obert" ? "Tancat" : "Obert";
  tancarModal("modal-detall");
  actualitzarMetriques();
  renderTabla();
}

function descarregarCorreo() {
  if (!incidenciaDetallActual?.correo) { alert("Esta incidencia no tiene correo original registrado."); return; }
  const d = incidenciaDetallActual;
  const blob = new Blob([d.correo], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`correo_inc${d.id}_${d.fecha}.txt`; a.click();
  URL.revokeObjectURL(url);
}

function obrirModalNova() {
  const hoy = new Date().toISOString().slice(0,10);
  const hora = new Date().toTimeString().slice(0,5);
  ["n-ubicacion","n-vigilant","n-descripcion","n-resum","n-accion","n-correo","n-img-carpeta","n-img-ruta","n-img-obs"].forEach(id => document.getElementById(id).value="");
  document.getElementById("n-fecha").value = hoy;
  document.getElementById("n-hora").value = hora;
  document.getElementById("n-gravedad").value = "Media";
  document.getElementById("n-categoria").value = "Incidència Baixa";
  document.querySelector('input[name="n-estat"][value="Obert"]').checked = true;
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
  incidencies.unshift({
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
  });
  tancarModal("modal-nova");
  actualitzarMetriques();
  omplirFiltresMesos();
  renderTabla();
}

function exportarCSV() {
  const filtrats = filtrar();
  if (!filtrats.length) { alert("No hay incidencias para exportar."); return; }
  const cap = ["ID","Fecha","Hora","Gravedad","Categoría","Ubicación","Resumen","Descripción","Medidas","Vigilante","Estado","Carpeta Imágenes","Ruta Imágenes"];
  const files = filtrats.map(d=>[d.id,formatData(d.fecha),d.hora,d.gravedad,catEs(d.categoria),d.ubicacion,d.resum,d.descripcion,d.accion,d.vigilant,estadoEs(d.estat),d.imgCarpeta,d.imgRuta]);
  const csv = [cap,...files].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`incidencias_vilamarina_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// INFORMES
var CATEGORIA_EXCLUIDA_INFORME = "Operativa";
var INF_COLORS = {
  "Robatori": "#ef4444",
  "Danys": "#f59e0b",
  "Accident Parking": "#8b5cf6",
  "Accident CC": "#3b82f6",
  "Incidència Baixa": "#10b981"
};
var INF_CATEGORIAS = ["Robatori","Danys","Accident Parking","Accident CC","Incidència Baixa"];
var INF_MESOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
var INF_CATEGORIA_ES = {
  "Robatori": "Robo",
  "Danys": "Daños",
  "Accident Parking": "Accidente Parking",
  "Accident CC": "Accidente CC",
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
    if (d.categoria === CATEGORIA_EXCLUIDA_INFORME) return;
    conteo[d.categoria] = (conteo[d.categoria]||0)+1;
  });
  return Object.keys(conteo).map(function(cat){
    return { label: cat, value: conteo[cat], color: INF_COLORS[cat] || "#6b7280" };
  }).sort(function(a,b){ return b.value-a.value; });
}

function construirGraficoCircular(datos) {
  var total = datos.reduce(function(s,d){ return s+d.value; }, 0);
  if (!total) return '<div style="color:#7A8FA6;font-size:13px;padding:12px">No hay incidencias en el rango seleccionado.</div>';
  var radius = 64, cx = 76, cy = 76, sw = 30;
  var circ = 2*Math.PI*radius;
  var acumulado = 0;
  var svg = '<svg width="152" height="152" viewBox="0 0 152 152">';
  datos.forEach(function(d){
    if (!d.value) return;
    var frac = d.value/total;
    var dash = frac*circ;
    svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+radius+'" fill="none" stroke="'+d.color+'" stroke-width="'+sw+'" ' +
      'stroke-dasharray="'+dash.toFixed(2)+' '+(circ-dash).toFixed(2)+'" stroke-dashoffset="'+(-acumulado).toFixed(2)+'" ' +
      'transform="rotate(-90 '+cx+' '+cy+')"></circle>';
    acumulado += dash;
  });
  svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+(radius-sw/2-2)+'" fill="#fff"></circle>';
  svg += '<text x="'+cx+'" y="'+(cy+6)+'" text-anchor="middle" font-size="22" font-weight="700" fill="#0F1B2D">'+total+'</text>';
  svg += '</svg>';
  var leyenda = '<div style="display:flex;flex-direction:column;gap:8px;min-width:160px">' + datos.filter(function(d){ return d.value>0; }).map(function(d){
    var pct = Math.round(d.value/total*100);
    return '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#2C3E50">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:'+d.color+';display:inline-block;flex-shrink:0"></span>' +
      '<span>'+catEs(d.label)+'</span>' +
      '<span style="margin-left:auto;color:#7A8FA6;font-size:12px">'+d.value+' · '+pct+'%</span></div>';
  }).join('') + '</div>';
  return svg + leyenda;
}

var INF_COLOR_LINEA = "#14b8a6";

function trazoSuave(pts) {
  var d = 'M'+pts[0].x+','+pts[0].y;
  for (var i=1; i<pts.length; i++) {
    var xc = (pts[i-1].x+pts[i].x)/2, yc = (pts[i-1].y+pts[i].y)/2;
    d += ' Q'+pts[i-1].x+','+pts[i-1].y+' '+xc+','+yc;
  }
  if (pts.length>1) d += ' L'+pts[pts.length-1].x+','+pts[pts.length-1].y;
  return d;
}

function construirGraficoLineal(filasMes) {
  if (!filasMes.length) return '<div style="color:#7A8FA6;font-size:13px;padding:12px">No hay incidencias en el rango seleccionado.</div>';
  var width = 760, height = 200, padding = { left: 26, right: 16, top: 16, bottom: 28 };
  var plotW = width - padding.left - padding.right, plotH = height - padding.top - padding.bottom;
  var maxV = Math.max.apply(null, filasMes.map(function(f){ return f.total; }).concat([1]));
  var stepX = filasMes.length > 1 ? plotW/(filasMes.length-1) : 0;
  function xAt(i) { return padding.left + (filasMes.length>1 ? stepX*i : plotW/2); }
  function yAt(v) { return padding.top + plotH - (maxV>0 ? (v/maxV)*plotH : 0); }
  var pts = filasMes.map(function(f,i){ return { x: xAt(i), y: yAt(f.total) }; });
  var svg = '<svg viewBox="0 0 '+width+' '+height+'" style="width:100%;height:auto;max-width:100%">';
  svg += '<text x="8" y="'+(padding.top+plotH/2)+'" font-size="10" fill="#9AA6B2" text-anchor="middle" transform="rotate(-90 8 '+(padding.top+plotH/2)+')">Incidencias</text>';
  svg += '<path d="'+trazoSuave(pts)+'" fill="none" stroke="'+INF_COLOR_LINEA+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"></path>';
  var etiquetaCada = Math.ceil(filasMes.length/10) || 1;
  filasMes.forEach(function(f,i){
    if (i % etiquetaCada === 0 || i === filasMes.length-1) {
      svg += '<text x="'+xAt(i)+'" y="'+(height-8)+'" font-size="10" fill="#9AA6B2" text-anchor="middle">'+nombreMesCorto(f.mes)+'</text>';
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
  var cx = cssW/2, cy = cssH/2, radius = Math.min(cssW,cssH)/2 - 4, sw = radius*0.42;
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
      start += ang;
    });
  }
  ctx.fillStyle = "#0F1B2D";
  ctx.font = "bold " + Math.round(cssH*0.16) + "px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy);
  return canvas;
}

function generarImagenGraficoLinealCanvas(filasMes, cssW, cssH) {
  var dpr = 3;
  var canvas = document.createElement("canvas");
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  var ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  var padding = { left: 20, right: 20, top: 10, bottom: 20 };
  var plotW = cssW-padding.left-padding.right, plotH = cssH-padding.top-padding.bottom;
  if (!filasMes.length) return canvas;
  var maxV = Math.max.apply(null, filasMes.map(function(f){ return f.total; }).concat([1]));
  var stepX = filasMes.length > 1 ? plotW/(filasMes.length-1) : 0;
  function xAt(i) { return padding.left + (filasMes.length>1 ? stepX*i : plotW/2); }
  function yAt(v) { return padding.top + plotH - (maxV>0 ? (v/maxV)*plotH : 0); }
  var pts = filasMes.map(function(f,i){ return { x: xAt(i), y: yAt(f.total) }; });
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var i=1; i<pts.length; i++) {
    var xc = (pts[i-1].x+pts[i].x)/2, yc = (pts[i-1].y+pts[i].y)/2;
    ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, xc, yc);
  }
  if (pts.length>1) ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  ctx.strokeStyle = INF_COLOR_LINEA; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  var etiquetaCada = Math.ceil(filasMes.length/7) || 1;
  ctx.fillStyle = "#9AA6B2"; ctx.textAlign = "center"; ctx.font = "8px Helvetica, Arial, sans-serif";
  filasMes.forEach(function(f,i){
    if (i % etiquetaCada !== 0 && i !== filasMes.length-1) return;
    ctx.fillText(nombreMesCorto(f.mes), xAt(i), cssH-6);
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

function renderInformes() {
  inicializarFechasInformes();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  var grafico = document.getElementById("inf-grafico");
  if (grafico) grafico.innerHTML = construirGraficoCircular(datosGraficoTema(lista));
  var filasAsc = resumenMensualCompleto(lista);
  var graficoLineal = document.getElementById("inf-grafico-lineal");
  if (graficoLineal) graficoLineal.innerHTML = construirGraficoLineal(filasAsc);
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

function generarPDFInforme(lista, rango, sufijo) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("No se ha podido cargar el generador de PDF."); return; }
  if (!lista.length) { alert("No hay incidencias en el rango seleccionado."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  var margenIzq = 14, anchoUtil = 182;
  var temas = datosGraficoTema(lista);
  var totalTemas = temas.reduce(function(s,d){ return s+d.value; }, 0);
  var filasMes = resumenMensualCompleto(lista);
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
  var lineCanvas = generarImagenGraficoLinealCanvas(filasMes, 460, 240);
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
    head: [["Mes","Total","Críticas","Altas","Medias","Bajas",catEs("Robatori"),catEs("Danys"),catEs("Accident Parking"),catEs("Accident CC"),catEs("Incidència Baixa"),"Abiertas","Cerradas"]],
    body: filasMes.map(function(f){
      return [nombreMes(f.mes), f.total, f.criticas, f.altas, f.medias, f.bajas,
        f.categorias["Robatori"], f.categorias["Danys"], f.categorias["Accident Parking"], f.categorias["Accident CC"], f.categorias["Incidència Baixa"],
        f.abiertas, f.cerradas];
    }),
    foot: [["TOTAL", lista.length,
      filasMes.reduce(function(s,f){return s+f.criticas;},0), filasMes.reduce(function(s,f){return s+f.altas;},0),
      filasMes.reduce(function(s,f){return s+f.medias;},0), filasMes.reduce(function(s,f){return s+f.bajas;},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Robatori"];},0), filasMes.reduce(function(s,f){return s+f.categorias["Danys"];},0),
      filasMes.reduce(function(s,f){return s+f.categorias["Accident Parking"];},0), filasMes.reduce(function(s,f){return s+f.categorias["Accident CC"];},0),
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

function generarFichaAfectadoPDF(a, inc) {
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

function descarregarFitxaAfectat() {
  if (!afectatDetallActual) return;
  const a = afectatDetallActual;
  const inc = incidencies.find(i=>i.id===a.incidenciaId);
  const doc = generarFichaAfectadoPDF(a, inc);
  if (doc) doc.save(`ficha_afectado_${a.nom.replace(/ /g,"_")}.pdf`);
}

function descarregarPlantillaPDF() {
  const doc = generarFichaAfectadoPDF(null, null);
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
    'Incidència Baixa':'Incidencia leve',
    'Obert':'Abierto',
    'Tancat':'Cerrado'
  };
  function traducir(root){
    const walker = document.createTreeWalker(root||document.body, NodeFilter.SHOW_TEXT);
    let n;
    while((n = walker.nextNode())){
      const t = n.nodeValue.trim();
      if(LABELS[t]) n.nodeValue = n.nodeValue.replace(t, LABELS[t]);
    }
  }
  const obs = new MutationObserver(()=>traducir(document.body));
  document.addEventListener('DOMContentLoaded', ()=>{
    traducir(document.body);
    obs.observe(document.body, {childList:true, subtree:true});
  });
})();


/* ============================================================
   CONEXIÓN CON GOOGLE SHEETS (Web App) — Vilamarina
   Carga automáticamente las incidencias clasificadas por la IA.
   Añadido automáticamente. No borrar.
   ============================================================ */
const VILAMARINA_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwhgSbeZUEA5aSLEA_O80OsLGVeFn-CLaQuX3rP14TNRQgN8ZSsvij-TWGIREvPBwD0/exec";

function mapearFilaSheet(f, i) {
  return {
    id: "sheet-" + (f.fecha || "") + "-" + (f.hora || "") + "-" + i,
    fecha: f.fecha || "",
    hora: f.hora || "",
    gravedad: f.gravedad || "",
    categoria: f.categoria || "",
    resum: f.resumen || "",
    descripcion: f.original || f.resumen || "",
    ubicacion: "Vilamarina",
    vigilant: "",
    accion: "",
    estat: (f.gravedad === "Crítica" ? "Obert" : "Tancat"),
    correo: "",
    enlace: f.enlace || "",
    origen: "sheets"
  };
}

function verIncidencia(id) {
  var d = incidencies.find(function(i){ return String(i.id)===String(id); });
  if (!d) return;
  if (d.enlace) { window.open(d.enlace, "_blank"); }
  else { obrirDetall(d.id); }
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
          if (typeof renderTabla === "function") renderTabla();
          if (typeof actualitzarMetriques === "function") actualitzarMetriques();
          console.log("[Vilamarina] Cargadas " + nuevas.length + " incidencias desde Google Sheets.");
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

// Carga al abrir la página
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cargarDesdeSheets);
} else {
  cargarDesdeSheets();
}

// Refresco automático cada 5 minutos
setInterval(cargarDesdeSheets, 5 * 60 * 1000);
