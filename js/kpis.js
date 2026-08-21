/* ============================================================
   KPIs de Seguridad — Vilamarina
   Módulo autocontenido. Calcula y muestra los KPIs de seguridad
   dinámicamente a partir del array global "incidencies".
   No requiere modificar app.js: crea su propio panel y se
   redibuja automáticamente.
   ============================================================ */
(function () {
  'use strict';

  var EXCLUIR = { 'Operativa': 1, 'Incidència Baixa': 1, 'Mantenimiento': 1 };

  function esNocturno(hora) {
    var hh = parseInt(String(hora || '').split(':')[0], 10);
    return hh >= 23 || hh < 9;
  }

  // La hoja no tiene columna de ubicación estructurada (el campo
  // "ubicacion" del frontend viene fijo a "Vilamarina" para las
  // incidencias que llegan de la Sheet), así que la única forma de
  // aproximar "qué zona concentra más incidentes" es buscar nombres de
  // zona conocidos en el texto libre (resum/descripcion) — igual que la
  // red de palabras clave de clasificación del Apps Script. Es una
  // aproximación: si el texto no menciona ninguna zona reconocida, esa
  // incidencia simplemente no cuenta para ninguna zona.
  var ZONAS = [
    { nombre: 'Gimnasio / aparcabicis', patrones: ['gimnasio', 'aparcabicis', 'aparca bicis', 'aparcabicicletas'] },
    { nombre: 'Parking / aparcamiento', patrones: ['parking', 'párking', 'aparcamiento'] },
    { nombre: 'Zona Renfe / accesos exteriores', patrones: ['renfe', 'estación', 'estacion'] },
    { nombre: 'Muelles de carga', patrones: ['muelle'] },
    { nombre: 'Mercadona', patrones: ['mercadona'] },
    { nombre: 'Zona de restauración', patrones: ['restauracion', 'restauración', 'foodcourt', 'food court'] },
    { nombre: 'Ascensores', patrones: ['ascensor'] },
    { nombre: 'Escaleras mecánicas', patrones: ['escalera mecanica', 'escalera mecánica', 'escaleras mecanicas', 'escaleras mecánicas'] },
    { nombre: 'Aseos / lavabos', patrones: ['baño', 'baños', 'lavabo', 'lavabos', 'aseo', 'aseos'] }
  ];
  function detectarZona(texto) {
    var t = (texto || '').toLowerCase();
    for (var i = 0; i < ZONAS.length; i++) {
      if (ZONAS[i].patrones.some(function (p) { return t.indexOf(p) !== -1; })) return ZONAS[i].nombre;
    }
    return null;
  }

  // Consejo de prevención asociado a cada categoría, usado por la
  // categoría que resulte ser realmente la más frecuente (antes estaba
  // fijo en "Daños" sin comprobar los datos).
  var CONSEJO_CATEGORIA = {
    'Robatori': 'Reforzar la vigilancia en sala y la coordinación con el personal de los locales durante la apertura, y el CCTV con visión nocturna en accesos exteriores fuera de horario.',
    'Danys': 'Revisar mantenimiento y protección del mobiliario y las zonas más afectadas.',
    'Accident CC': 'Revisar señalización y estado del suelo en las zonas con más accidentes dentro del centro.',
    'Accident Parking': 'Revisar señalización, iluminación y estado del pavimento del parking.'
  };

  function computeKPIs() {
    var inc = (typeof incidencies !== 'undefined' && incidencies) ? incidencies : [];
    var rel = inc.filter(function (i) { return !EXCLUIR[i.categoria]; });
    var robosArr = rel.filter(function (i) { return i.categoria === 'Robatori'; });
    var robos = robosArr.length;
    var robosNoct = robosArr.filter(function (i) { return esNocturno(i.hora); }).length;
    var danys = rel.filter(function (i) { return i.categoria === 'Danys'; }).length;
    var accCC = rel.filter(function (i) { return i.categoria === 'Accident CC'; }).length;
    var accParking = rel.filter(function (i) { return i.categoria === 'Accident Parking'; }).length;

    var zonaConteo = {};
    rel.forEach(function (i) {
      var zona = detectarZona((i.resum || '') + ' ' + (i.descripcion || ''));
      if (zona) zonaConteo[zona] = (zonaConteo[zona] || 0) + 1;
    });
    var zonaTop = null, zonaTopCount = 0;
    Object.keys(zonaConteo).forEach(function (z) {
      if (zonaConteo[z] > zonaTopCount) { zonaTop = z; zonaTopCount = zonaConteo[z]; }
    });

    var categorias = [
      { nombre: 'Robatori', label: 'Robos', val: robos },
      { nombre: 'Danys', label: 'Daños', val: danys },
      { nombre: 'Accident CC', label: 'Accidentes en el centro', val: accCC },
      { nombre: 'Accident Parking', label: 'Accidentes en el parking', val: accParking }
    ];
    var categoriaTop = categorias.reduce(function (a, b) { return b.val > a.val ? b : a; });

    return {
      total: rel.length,
      gravAlta: inc.filter(function (i) { return i.gravedad === 'Alta'; }).length,
      robos: robos,
      danys: danys,
      accCC: accCC,
      accParking: accParking,
      robosNoct: robosNoct,
      robosCom: robos - robosNoct,
      zonaTop: zonaTop,
      zonaTopCount: zonaTopCount,
      categoriaTop: categoriaTop
    };
  }

  function card(label, val, onclick) {
    var clickAttr = onclick ? ' onclick="' + onclick + '" style="flex:1;min-width:110px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:pointer"' :
      ' style="flex:1;min-width:110px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04)"';
    return '<div' + clickAttr + '>' +
      '<div style="font-size:11px;letter-spacing:.05em;color:#6b7280;text-transform:uppercase">' + label + '</div>' +
      '<div style="font-size:28px;font-weight:700;color:#111827;margin-top:4px">' + val + '</div></div>';
  }

  // Devuelve la lista de incidencias detrás de cada tarjeta de KPI,
  // usando exactamente el mismo filtro que computeKPIs(), y abre el modal
  // genérico de listado que expone app.js (window.mostrarListadoIncidenciasModal).
  function verListaKPI(tipo) {
    var inc = (typeof incidencies !== 'undefined' && incidencies) ? incidencies : [];
    var rel = inc.filter(function (i) { return !EXCLUIR[i.categoria]; });
    var titulos = {
      total: 'Total relevantes',
      gravAlta: 'Gravedad alta',
      robos: 'Robos',
      danys: 'Daños',
      accCC: 'Accidentes en el centro',
      accParking: 'Accidentes en el parking'
    };
    var listas = {
      total: rel,
      gravAlta: inc.filter(function (i) { return i.gravedad === 'Alta'; }),
      robos: rel.filter(function (i) { return i.categoria === 'Robatori'; }),
      danys: rel.filter(function (i) { return i.categoria === 'Danys'; }),
      accCC: rel.filter(function (i) { return i.categoria === 'Accident CC'; }),
      accParking: rel.filter(function (i) { return i.categoria === 'Accident Parking'; })
    };
    if (typeof window.mostrarListadoIncidenciasModal === 'function') {
      window.mostrarListadoIncidenciasModal(titulos[tipo] || 'Incidencias', listas[tipo] || []);
    }
  }
  window.verListaKPI = verListaKPI;

  function bar(label, val, max, color) {
    var w = max > 0 ? Math.round(val / max * 100) : 0;
    return '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px;color:#374151">' +
      '<span>' + label + '</span><span>' + val + '</span></div>' +
      '<div style="background:#f3f4f6;border-radius:6px;height:10px;margin-top:3px">' +
      '<div style="width:' + w + '%;background:' + color + ';height:100%;border-radius:6px"></div></div></div>';
  }

  function bodyHTML(k) {
    var catMax = Math.max(k.danys, k.robos, k.accCC, k.accParking, 1);
    var ctxMax = Math.max(k.robosCom, k.robosNoct, 1);
    var puntoCaliente = k.zonaTop
      ? '<li style="margin-bottom:6px"><strong>Puntos calientes:</strong> la zona de <strong>' + k.zonaTop + '</strong> concentra el mayor número de incidencias detectadas por texto (' + k.zonaTopCount + '). Reforzar CCTV y rondas específicas ahí.</li>'
      : '<li style="margin-bottom:6px"><strong>Puntos calientes:</strong> no se ha detectado ninguna zona repetida en el texto de las incidencias. Conviene registrar la ubicación de forma más sistemática (planta, zona, comercio) para poder identificar puntos calientes.</li>';
    var categoriaMasFrecuente = k.categoriaTop.val > 0
      ? '<li style="margin-bottom:6px"><strong>' + k.categoriaTop.label + ' (' + k.categoriaTop.val + '):</strong> es la categoría más frecuente del periodo. ' + (CONSEJO_CATEGORIA[k.categoriaTop.nombre] || '') + '</li>'
      : '';
    return '' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">' +
        card('Total relevantes', k.total, "verListaKPI('total')") + card('Gravedad alta', k.gravAlta, "verListaKPI('gravAlta')") +
        card('Robos', k.robos, "verListaKPI('robos')") + card('Daños', k.danys, "verListaKPI('danys')") + card('Accid. CC', k.accCC, "verListaKPI('accCC')") + card('Accid. Parking', k.accParking, "verListaKPI('accParking')") +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">' +
        '<div style="flex:1;min-width:240px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px">' +
          '<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Por categoría</div>' +
          bar('Daños', k.danys, catMax, '#f59e0b') + bar('Robo', k.robos, catMax, '#ef4444') + bar('Accidente CC', k.accCC, catMax, '#8b5cf6') + bar('Accidente Parking', k.accParking, catMax, '#0ea5e9') +
        '</div>' +
        '<div style="flex:1;min-width:240px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px">' +
          '<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Robos según contexto</div>' +
          bar('En horario comercial (apertura)', k.robosCom, ctxMax, '#ef4444') + bar('Nocturnos / exterior (cerrado)', k.robosNoct, ctxMax, '#7c3aed') +
          '<div style="margin-top:8px;font-size:11px;color:#9ca3af;font-style:italic">Los robos nocturnos ocurren en zonas exteriores; el centro está cerrado.</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 18px">' +
        '<div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:10px">💡 Propuestas de mejora y prevención</div>' +
        '<ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.7">' +
          puntoCaliente +
          '<li style="margin-bottom:6px"><strong>Robos nocturnos en el exterior (' + k.robosNoct + '):</strong> con el centro cerrado, ocurren en zonas exteriores (aparcabicis, gimnasio). Priorizar CCTV con visión nocturna, iluminación y coordinación con Mossos/112.</li>' +
          '<li style="margin-bottom:6px"><strong>Robos/hurtos en horario comercial (' + k.robosCom + '):</strong> se producen dentro de tiendas y restauración durante la apertura. Reforzar vigilancia en sala y coordinación con el personal de los locales.</li>' +
          categoriaMasFrecuente +
          '<li style="margin-bottom:6px"><strong>Calidad del registro:</strong> conviene separar tareas operativas nocturnas (retirada de protocolo, incidencias técnicas) de las incidencias de seguridad, y añadir <strong>hora de cierre</strong> y <strong>ubicación estructurada</strong>.</li>' +
        '</ul>' +
        '<div style="margin-top:10px;font-size:11px;color:#9ca3af;font-style:italic">Análisis orientativo basado en ' + k.total + ' incidencias. Al ser un volumen bajo, conviene validar la tendencia con varios meses de datos y contrastar con el responsable de seguridad.</div>' +
      '</div>';
  }

  function ensurePanel() {
    var panel = document.getElementById('kpi-seguridad');
    if (panel) return panel;
    var view = document.getElementById('view-incidencies');
    if (!view) return null;
    var metrics = view.querySelector('.metrics');
    panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'kpi-seguridad';
    panel.innerHTML =
      '<h3 style="margin:0;font-size:16px;color:#111827;cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px">' +
        '<span id="kpi-toggle" style="display:inline-block;transition:transform .2s;font-size:13px;color:#6b7280;transform:rotate(90deg)">▸</span>' +
        '📊 KPIs de Seguridad ' +
        '<span style="font-size:12px;font-weight:400;color:#6b7280" id="kpi-subtitle"></span>' +
      '</h3>' +
      '<div id="kpi-seguridad-body" style="overflow:hidden;display:block;margin-top:12px"></div>';
    if (metrics && metrics.nextSibling) {
      metrics.parentNode.insertBefore(panel, metrics.nextSibling);
    } else if (metrics) {
      metrics.parentNode.appendChild(panel);
    } else {
      view.insertBefore(panel, view.firstChild);
    }
    // Plegar / desplegar
    var h3 = panel.querySelector('h3');
    h3.addEventListener('click', function () {
      var b = document.getElementById('kpi-seguridad-body');
      var t = document.getElementById('kpi-toggle');
      if (!b) return;
      var open = b.style.display !== 'none';
      b.style.display = open ? 'none' : 'block';
      if (t) t.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
    });
    return panel;
  }

  function render() {
    var panel = ensurePanel();
    if (!panel) return;
    var k = computeKPIs();
    var body = document.getElementById('kpi-seguridad-body');
    if (body) body.innerHTML = bodyHTML(k);
    var sub = document.getElementById('kpi-subtitle');
    if (sub) sub.textContent = '(solo incidencias relevantes · ' + k.total + ' · excluye operativa, mantenimiento y leves)';
  }

  // Exponer y auto-activar
  window.renderKPIs = render;

  function boot() {
    render();
    // El propio app.js llama a window.renderKPIs() cuando cambian los datos
    // (nueva incidencia, carga desde Sheets...). Nada de repintar a ciegas
    // cada pocos segundos: eso recalculaba y volvía a pintar el panel sin
    // parar, y cada repintado disparaba además el escaneo de traducción de
    // toda la página.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
