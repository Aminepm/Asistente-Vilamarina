
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
function rowClass(g) { return {"Crítica":"row-critica","Alta":"row-alta","Media":"row-media","Baja":"row-baja"}[g]||""; }

function canviarVista(vista, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + vista).classList.add('active');
  btn.classList.add('active');
  if (vista === 'afectats') renderAfectats();
  if (vista === 'backup') renderBackup();
}

function omplirFiltresMesos() {
  const mesos = [...new Set(incidencies.map(i => i.fecha.slice(0,7)))].sort().reverse();
  const sel = document.getElementById("f-mes");
  sel.innerHTML = '<option value="">Tots els mesos</option>';
  const noms = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
  mesos.forEach(m => {
    const [y, mo] = m.split("-");
    sel.innerHTML += `<option value="${m}">${noms[parseInt(mo)-1]} ${y}</option>`;
  });
}

function filtrar() {
  const buscar = document.getElementById("f-buscar").value.toLowerCase();
  const grav = document.getElementById("f-gravedad").value;
  const cat = document.getElementById("f-categoria").value;
  const estat = document.getElementById("f-estat").value;
  const mes = document.getElementById("f-mes").value;
  return incidencies.filter(d =>
    (!buscar || d.descripcion.toLowerCase().includes(buscar) || d.ubicacion.toLowerCase().includes(buscar) || (d.resum||"").toLowerCase().includes(buscar))
    && (!grav || d.gravedad === grav)
    && (!cat || d.categoria === cat)
    && (!estat || d.estat === estat)
    && (!mes || d.fecha.startsWith(mes))
  );
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
      <td><button class="btn btn-outline btn-sm" onclick="obrirDetall(${d.id})">Veure</button></td>
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
  document.getElementById("btn-toggle-estat").textContent = d.estat==="Obert" ? "Marcar com a tancat" : "Reobrir incidència";
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
    ${af.length?`<div class="detail-section"><div class="detail-section-title">Afectats vinculats (${af.length})</div>${af.map(a=>`<div style="font-size:13px;padding:8px 0;border-bottom:1px solid #F0F2F5">${a.nom} — ${a.tel}${a.medica==='Sí'?' · <span style="color:#922B21">Assistència mèdica</span>':""}</div>`).join("")}</div>`:""}
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
  if (!incidenciaDetallActual?.correo) { alert("Aquesta incidència no té correu original registrat."); return; }
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
  if (!desc) { alert("Escriu primer la descripció de la incidència."); return; }
  const ubi = document.getElementById("n-ubicacion").value||"ubicació no especificada";
  const frases = desc.split(/[.!?]/).filter(f=>f.trim().length>10);
  const resum = frases.length>0 ? frases.slice(0,2).map(f=>f.trim()).join(". ")+"." : desc.slice(0,120)+(desc.length>120?"...":"");
  document.getElementById("n-resum").value = `${ubi}. ${resum}`;
}

function guardarIncidencia() {
  const fecha = document.getElementById("n-fecha").value;
  const hora = document.getElementById("n-hora").value;
  const ubicacion = document.getElementById("n-ubicacion").value.trim();
  const descripcion = document.getElementById("n-descripcion").value.trim();
  if (!fecha||!hora||!ubicacion||!descripcion) { alert("Omple els camps obligatoris: data, hora, ubicació i descripció."); return; }
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
  if (!filtrats.length) { alert("No hi ha incidències per exportar."); return; }
  const cap = ["ID","Data","Hora","Gravetat","Categoria","Ubicació","Resum","Descripció","Mesures","Vigilant","Estat","Carpeta Imatges","Ruta Imatges"];
  const files = filtrats.map(d=>[d.id,formatData(d.fecha),d.hora,d.gravedad,d.categoria,d.ubicacion,d.resum,d.descripcion,d.accion,d.vigilant,d.estat,d.imgCarpeta,d.imgRuta]);
  const csv = [cap,...files].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`incidencies_vilamarina_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
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
      <td><button class="btn btn-outline btn-sm" onclick="obrirDetallAfectat(${a.id})">Veure</button></td>
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
  if (!nom||!dni||!tel) { alert("Omple els camps obligatoris: nom, DNI i telèfon."); return; }
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
      <div class="detail-item"><div class="detail-label">Assistència mèdica</div><div class="detail-value">${a.medica}</div></div>
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
  const noms = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
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
  if(!incidencies.length){alert("No hi ha incidències per exportar.");return;}
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
