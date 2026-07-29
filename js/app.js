
let incidencies = [];
let afectats = [];
let nextId = 1;
let nextAfectatId = 1;
let incidenciaDetallActual = null;
let afectatDetallActual = null;

function formatData(f) { return f ? f.split("-").reverse().join("/") : "—"; }
function getMesActual() { return new Date().toISOString().slice(0,7); }
function badgeGravClass(g) { return {"Crítica":"badge-critica","Alta":"badge-alta","Media":"badge-media","Baja":"badge-baja"}[g]||""; }
function badgeGravLabel(g) { return {"Crítica":"Crítica","Alta":"Alta","Media":"Mitja","Baja":"Baixa"}[g]||g; }
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
  sel.innerHTML = '<option value="">Tots els mesos</option>';
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-icon">📋</div>${incidencies.length === 0 ? "Encara no hi ha incidències registrades.<br><small>Fes clic a <strong>Nova incidència</strong> per afegir-ne una.</small>" : "Cap incidència coincideix amb els filtres seleccionats."}</td></tr>`;
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
  document.getElementById("detall-titol").textContent = `Incidència #${d.id} — ${d.categoria}`;
  document.getElementById("btn-toggle-estat").textContent = d.estat==="Obert" ? "Marcar com a tancat" : "Reabrir incidencia";
  const af = afectats.filter(a=>a.incidenciaId===d.id);
  document.getElementById("detall-body").innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Dades generals</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Data i hora</div><div class="detail-value">${formatData(d.fecha)} a les ${d.hora}h</div></div>
        <div class="detail-item"><div class="detail-label">Vigilant</div><div class="detail-value">${d.vigilant||"—"}</div></div>
        <div class="detail-item"><div class="detail-label">Gravetat</div><div class="detail-value"><span class="badge ${badgeGravClass(d.gravedad)}">${badgeGravLabel(d.gravedad)}</span></div></div>
        <div class="detail-item"><div class="detail-label">Categoria</div><div class="detail-value"><span class="badge badge-cat">${d.categoria}</span></div></div>
        <div class="detail-item"><div class="detail-label">Ubicació</div><div class="detail-value">${d.ubicacion}</div></div>
        <div class="detail-item"><div class="detail-label">Estat</div><div class="detail-value"><span class="badge ${d.estat==='Obert'?'badge-obert':'badge-tancat'}">${d.estat}</span></div></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Descripció i resum</div>
      <div class="detail-grid">
        <div class="detail-item detail-full"><div class="detail-label">Resum</div><div class="detail-value">${d.resum||"—"}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Descripció completa</div><div class="detail-value" style="font-size:13px;color:#4A5568">${d.descripcion}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Mesures adoptades</div><div class="detail-value">${d.accion||"—"}</div></div>
      </div>
    </div>
    ${d.imgCarpeta||d.imgRuta?`<div class="detail-section"><div class="detail-section-title">Imatges / Vídeos de seguretat</div><div class="img-ref-box"><strong>Referència d'imatges</strong>${d.imgCarpeta?`<div>📁 Carpeta: <strong>${d.imgCarpeta}</strong></div>`:""} ${d.imgRuta?`<div>📍 Ruta: <code style="font-size:11px">${d.imgRuta}</code></div>`:""} ${d.imgObs?`<div style="margin-top:4px">${d.imgObs}</div>`:""}</div></div>`:""}
    ${d.correo?`<div class="detail-section"><div class="detail-section-title">Correu original</div><div class="correo-box">${d.correo}</div></div>`:""}
    ${af.length?`<div class="detail-section"><div class="detail-section-title">Afectats vinculats (${af.length})</div>${af.map(a=>`<div style="font-size:13px;padding:8px 0;border-bottom:1px solid #F0F2F5">${a.nom} — ${a.tel}${a.medica==='Sí'?' · <span style="color:#922B21">Asistencia médica</span>':""}</div>`).join("")}</div>`:""}
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
  const a = document.createElement("a"); a.href=url; a.download=`correu_inc${d.id}_${d.fecha}.txt`; a.click();
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
  const cap = ["ID","Data","Hora","Gravetat","Categoria","Ubicació","Resum","Descripció","Mesures","Vigilant","Estat","Carpeta Imatges","Ruta Imatges"];
  const files = filtrats.map(d=>[d.id,formatData(d.fecha),d.hora,d.gravedad,d.categoria,d.ubicacion,d.resum,d.descripcion,d.accion,d.vigilant,d.estat,d.imgCarpeta,d.imgRuta]);
  const csv = [cap,...files].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`incidencies_vilamarina_${new Date().toISOString().slice(0,10)}.csv`; a.click();
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
      '<span>'+d.label+'</span>' +
      '<span style="margin-left:auto;color:#7A8FA6;font-size:12px">'+d.value+' · '+pct+'%</span></div>';
  }).join('') + '</div>';
  return svg + leyenda;
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
  var filas = resumenMensualCompleto(lista).slice().reverse();
  var tbody = document.getElementById("inf-tbody-mensual");
  if (tbody) {
    tbody.innerHTML = filas.length ? filas.map(function(f){
      return '<tr><td>'+nombreMes(f.mes)+'</td><td>'+f.total+'</td><td>'+f.criticas+'</td><td>'+f.altas+'</td><td>'+f.abiertas+'</td></tr>';
    }).join("") : '<tr class="empty-row"><td colspan="5">No hay incidencias en el rango seleccionado.</td></tr>';
  }
}

function exportarInformeMensualCSV(lista, sufijo) {
  if (!lista.length) { alert("No hay incidencias en el rango seleccionado."); return; }
  var filas = resumenMensualCompleto(lista);
  var cap = ["Mes","Total","Críticas","Altas","Medias","Bajas",catEs("Robatori"),catEs("Danys"),catEs("Accident Parking"),catEs("Accident CC"),catEs("Incidència Baixa"),"Abiertas","Cerradas"];
  var datos = filas.map(function(f){
    return [nombreMes(f.mes), f.total, f.criticas, f.altas, f.medias, f.bajas,
      f.categorias["Robatori"], f.categorias["Danys"], f.categorias["Accident Parking"], f.categorias["Accident CC"], f.categorias["Incidència Baixa"],
      f.abiertas, f.cerradas];
  });
  var totalRow = ["TOTAL", lista.length,
    filas.reduce(function(s,f){return s+f.criticas;},0), filas.reduce(function(s,f){return s+f.altas;},0),
    filas.reduce(function(s,f){return s+f.medias;},0), filas.reduce(function(s,f){return s+f.bajas;},0),
    filas.reduce(function(s,f){return s+f.categorias["Robatori"];},0), filas.reduce(function(s,f){return s+f.categorias["Danys"];},0),
    filas.reduce(function(s,f){return s+f.categorias["Accident Parking"];},0), filas.reduce(function(s,f){return s+f.categorias["Accident CC"];},0),
    filas.reduce(function(s,f){return s+f.categorias["Incidència Baixa"];},0),
    filas.reduce(function(s,f){return s+f.abiertas;},0), filas.reduce(function(s,f){return s+f.cerradas;},0)];
  var csv = [cap].concat(datos).concat([totalRow]).map(function(r){
    return r.map(function(c){ return '"'+String(c==null?"":c).replace(/"/g,'""')+'"'; }).join(",");
  }).join("\n");
  var blob = new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href=url; a.download="informe_mensual_"+sufijo+"_vilamarina.csv"; a.click();
  URL.revokeObjectURL(url);
}

function descargarInformeMensual() {
  inicializarFechasInformes();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  var sufijo = (rango.desde||"inicio") + "_a_" + (rango.hasta||"actual");
  exportarInformeMensualCSV(lista, sufijo);
}

function descargarInformeYTD() {
  establecerRangoYTD();
  var rango = getRangoInformes();
  var lista = incidenciesEnRango(rango.desde, rango.hasta);
  exportarInformeMensualCSV(lista, "YTD_" + rango.hasta.slice(0,4));
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

// AFECTATS
function renderAfectats() {
  const tbody = document.getElementById("tbody-afectats");
  if (!afectats.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="empty-icon">👤</div>Encara no hi ha afectats registrats.</td></tr>';
    return;
  }
  tbody.innerHTML = afectats.map(a => {
    const inc = incidencies.find(i=>i.id===a.incidenciaId);
    return `<tr>
      <td>${a.nom}</td>
      <td class="td-muted">${a.dni}</td>
      <td class="td-muted">${a.tel}</td>
      <td class="td-muted" style="font-size:12px">${inc?`#${inc.id} ${inc.categoria} (${formatData(inc.fecha)})`:"—"}</td>
      <td><span class="badge ${a.medica==='Sí'?'badge-critica':'badge-baja'}">${a.medica}</span></td>
      <td><span class="badge ${a.consentiment==='Sí'?'badge-baja':'badge-alta'}">${a.consentiment}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="obrirDetallAfectat(${a.id})">Ver incidencia</button></td>
    </tr>`;
  }).join("");
}

function obrirModalAfectat() {
  ["a-nom","a-dni","a-tel","a-email","a-adreca","a-hospital","a-part-medic","a-declaracio","a-test-nom","a-test-tel"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("a-naix").value="";
  document.getElementById("a-medica").value="No";
  document.getElementById("a-consentiment").value="Sí";
  document.getElementById("a-testimonis").value="No";
  document.getElementById("bloc-testimoni").style.display="none";
  const sel = document.getElementById("a-incidencia");
  sel.innerHTML = '<option value="">Sense vincular</option>'+incidencies.map(i=>`<option value="${i.id}">#${i.id} — ${i.categoria} (${formatData(i.fecha)})</option>`).join("");
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
    <div class="detail-section"><div class="detail-section-title">Dades personals</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Nom complet</div><div class="detail-value">${a.nom}</div></div>
      <div class="detail-item"><div class="detail-label">DNI/NIE/Passaport</div><div class="detail-value">${a.dni}</div></div>
      <div class="detail-item"><div class="detail-label">Data de naixement</div><div class="detail-value">${formatData(a.naix)}</div></div>
      <div class="detail-item"><div class="detail-label">Telèfon</div><div class="detail-value">${a.tel}</div></div>
      <div class="detail-item"><div class="detail-label">Correu</div><div class="detail-value">${a.email||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Adreça</div><div class="detail-value">${a.adreca||"—"}</div></div>
    </div></div>
    <div class="detail-section"><div class="detail-section-title">Incidència i assistència mèdica</div>
    <div class="detail-grid">
      <div class="detail-item detail-full"><div class="detail-label">Incidència vinculada</div><div class="detail-value">${inc?`#${inc.id} — ${inc.categoria} (${formatData(inc.fecha)}) · ${inc.ubicacion}`:"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Asistencia médica</div><div class="detail-value">${a.medica}</div></div>
      <div class="detail-item"><div class="detail-label">Centre mèdic</div><div class="detail-value">${a.hospital||"—"}</div></div>
      <div class="detail-item detail-full"><div class="detail-label">Nº part mèdic</div><div class="detail-value">${a.partMedic||"—"}</div></div>
    </div></div>
    <div class="detail-section"><div class="detail-section-title">Declaració i testimonis</div>
    <div class="detail-grid">
      <div class="detail-item detail-full"><div class="detail-label">Declaració de l'afectat</div><div class="detail-value" style="font-size:13px;color:#4A5568">${a.declaracio||"—"}</div></div>
      <div class="detail-item"><div class="detail-label">Consentiment</div><div class="detail-value"><span class="badge ${a.consentiment==='Sí'?'badge-baja':'badge-alta'}">${a.consentiment}</span></div></div>
      <div class="detail-item"><div class="detail-label">Testimonis</div><div class="detail-value">${a.testimonis}</div></div>
      ${a.testimonis==="Sí"?`<div class="detail-item"><div class="detail-label">Nom testimoni</div><div class="detail-value">${a.testNom||"—"}</div></div><div class="detail-item"><div class="detail-label">Tel. testimoni</div><div class="detail-value">${a.testTel||"—"}</div></div>`:""}
    </div></div>`;
  document.getElementById("modal-detall-afectat").classList.add("open");
}

function descarregarFitxaAfectat() {
  if (!afectatDetallActual) return;
  const a = afectatDetallActual;
  const inc = incidencies.find(i=>i.id===a.incidenciaId);
  const txt = `FITXA D'AFECTAT — VILAMARINA\nBarna Porters S.L. · Oficina de Gerència\n${"=".repeat(50)}\n\nDADES PERSONALS\nNom complet: ${a.nom}\nDNI/NIE/Passaport: ${a.dni}\nData de naixement: ${formatData(a.naix)}\nTelèfon: ${a.tel}\nCorreu: ${a.email||"—"}\nAdreça: ${a.adreca||"—"}\n\nINCIDÈNCIA VINCULADA\n${inc?`#${inc.id} — ${inc.categoria} — ${formatData(inc.fecha)} a les ${inc.hora}h\nUbicació: ${inc.ubicacion}\nDescripció: ${inc.descripcion}`:"Cap incidència vinculada"}\n\nASSISTÈNCIA MÈDICA\nAssistència requerida: ${a.medica}\nCentre mèdic: ${a.hospital||"—"}\nNº part mèdic: ${a.partMedic||"—"}\n\nDECLARACIÓ\n${a.declaracio||"—"}\n\nCONSENTIMENT I TESTIMONIS\nConsentiment dades: ${a.consentiment}\nTestimonis: ${a.testimonis}${a.testimonis==="Sí"?`\nNom: ${a.testNom||"—"}\nTel: ${a.testTel||"—"}`:""}\n\n${"=".repeat(50)}\nDocument generat: ${new Date().toLocaleString("ca-ES")}\n`;
  const blob = new Blob([txt],{type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement("a"); a2.href=url; a2.download=`fitxa_afectat_${a.nom.replace(/ /g,"_")}.txt`; a2.click();
  URL.revokeObjectURL(url);
}

function descarregarPlantillaPDF() {
  alert("La plantilla PDF es descarrega des de l'arxiu 'plantilla_afectat_vilamarina.pdf' que trobaràs a la mateixa carpeta que aquest programa.");
}

// BACKUP
function renderBackup() {
  const mesos = [...new Set(incidencies.map(i=>i.fecha.slice(0,7)))].sort().reverse();
  const noms = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const container = document.getElementById("backup-months");
  if (!mesos.length) { container.innerHTML='<div style="color:#7A8FA6;font-size:13px;padding:12px">Encara no hi ha incidències registrades.</div>'; return; }
  container.innerHTML = mesos.map(m=>{
    const [y,mo]=m.split("-");
    const count=incidencies.filter(i=>i.fecha.startsWith(m)).length;
    return `<div class="month-card"><div class="month-card-info"><strong>${noms[parseInt(mo)-1]} ${y}</strong><span>${count} incidència${count!==1?"es":""}</span></div><button class="btn btn-primary btn-sm" onclick="exportarBackupMes('${m}')"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Baixar</button></div>`;
  }).join("");
}

function generarContingutBackup(llista) {
  let txt = `BACKUP INCIDÈNCIES — VILAMARINA\nBarna Porters S.L. · Oficina de Gerència\nGenerat: ${new Date().toLocaleString("ca-ES")}\n${"=".repeat(60)}\n\n`;
  llista.forEach(d=>{
    const af=afectats.filter(a=>a.incidenciaId===d.id);
    txt+=`INCIDÈNCIA #${d.id}\n${"-".repeat(40)}\nData: ${formatData(d.fecha)} ${d.hora}h\nGravetat: ${d.gravedad}\nCategoria: ${d.categoria}\nUbicació: ${d.ubicacion}\nEstat: ${d.estat}\nVigilant: ${d.vigilant||"—"}\n\nResum: ${d.resum||"—"}\nDescripció: ${d.descripcion}\nMesures adoptades: ${d.accion||"—"}\n`;
    if(d.imgCarpeta||d.imgRuta) txt+=`\nIMATGES/VÍDEOS:\n  Carpeta: ${d.imgCarpeta||"—"}\n  Ruta: ${d.imgRuta||"—"}\n  Obs: ${d.imgObs||"—"}\n`;
    if(d.correo) txt+=`\nCORREU ORIGINAL:\n${d.correo}\n`;
    if(af.length){txt+=`\nAFECTATS (${af.length}):\n`;af.forEach(a=>{txt+=`  - ${a.nom} | DNI: ${a.dni} | Tel: ${a.tel} | Mèdica: ${a.medica} | Consentiment: ${a.consentiment}\n`;});}
    txt+=`\n${"=".repeat(60)}\n\n`;
  });
  return txt;
}

function exportarBackupMes(mes) {
  const [y,mo]=mes.split("-");
  const noms=["gener","febrer","marc","abril","maig","juny","juliol","agost","setembre","octubre","novembre","desembre"];
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
  const a=document.createElement("a"); a.href=url; a.download=`backup_complet_vilamarina_${new Date().toISOString().slice(0,10)}.txt`; a.click();
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
  var d = incidencies.find(function(i){ return i.id===id; });
  if (!d) return;
  if (d.enlace) { window.open(d.enlace, "_blank"); }
  else { obrirDetall(id); }
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
