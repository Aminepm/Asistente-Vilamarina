/* ============================================================
   KPIs de Seguridad — Vilamarina
   Módulo autocontenido. Calcula y muestra los KPIs de seguridad
   dinámicamente a partir del array global "incidencies".
   No requiere modificar app.js: crea su propio panel y se
   redibuja automáticamente.
   ============================================================ */
(function () {
  'use strict';

  var EXCLUIR = { 'Operativa': 1, 'Incidencia Baixa': 1 };

  function esNocturno(hora) {
    var hh = parseInt(String(hora || '').split(':')[0], 10);
    return hh >= 23 || hh < 9;
  }

  function computeKPIs() {
    var inc = (typeof incidencies !== 'undefined' && incidencies) ? incidencies : [];
    var rel = inc.filter(function (i) { return !EXCLUIR[i.categoria]; });
    var robosArr = rel.filter(function (i) { return i.categoria === 'Robatori'; });
    var robos = robosArr.length;
    var robosNoct = robosArr.filter(function (i) { return esNocturno(i.hora); }).length;
    return {
      total: rel.length,
      gravAlta: rel.filter(function (i) { return i.gravedad === 'Alta'; }).length,
      robos: robos,
      danys: rel.filter(function (i) { return i.categoria === 'Danys'; }).length,
      accCC: rel.filter(function (i) { return i.categoria === 'Accident CC'; }).length,
      robosNoct: robosNoct,
      robosCom: robos - robosNoct
    };
  }

  function card(label, val) {
    return '<div style="flex:1;min-width:110px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04)">' +
      '<div style="font-size:11px;letter-spacing:.05em;color:#6b7280;text-transform:uppercase">' + label + '</div>' +
      '<div style="font-size:28px;font-weight:700;color:#111827;margin-top:4px">' + val + '</div></div>';
  }

  function bar(label, val, max, color) {
    var w = max > 0 ? Math.round(val / max * 100) : 0;
    return '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px;color:#374151">' +
      '<span>' + label + '</span><span>' + val + '</span></div>' +
      '<div style="background:#f3f4f6;border-radius:6px;height:10px;margin-top:3px">' +
      '<div style="width:' + w + '%;background:' + color + ';height:100%;border-radius:6px"></div></div></div>';
  }

  function bodyHTML(k) {
    var catMax = Math.max(k.danys, k.robos, k.accCC, 1);
    var ctxMax = Math.max(k.robosCom, k.robosNoct, 1);
    return '' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">' +
        card('Total relevantes', k.total) + card('Gravedad alta', k.gravAlta) +
        card('Robos', k.robos) + card('Daños', k.danys) + card('Accid. CC', k.accCC) +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">' +
        '<div style="flex:1;min-width:240px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px">' +
          '<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Por categoría</div>' +
          bar('Daños', k.danys, catMax, '#f59e0b') + bar('Robo', k.robos, catMax, '#ef4444') + bar('Accidente CC', k.accCC, catMax, '#8b5cf6') +
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
          '<li style="margin-bottom:6px"><strong>Puntos calientes:</strong> la zona de <strong>Gimnasio / aparcabicis</strong> concentra el mayor número de incidentes (3). Reforzar CCTV y rondas específicas ahí.</li>' +
          '<li style="margin-bottom:6px"><strong>Robos nocturnos en el exterior (' + k.robosNoct + '):</strong> con el centro cerrado, ocurren en zonas exteriores (aparcabicis, gimnasio). Priorizar CCTV con visión nocturna, iluminación y coordinación con Mossos/112.</li>' +
          '<li style="margin-bottom:6px"><strong>Robos/hurtos en horario comercial (' + k.robosCom + '):</strong> se producen dentro de tiendas y restauración durante la apertura. Reforzar vigilancia en sala y coordinación con el personal de los locales.</li>' +
          '<li style="margin-bottom:6px"><strong>Daños (' + k.danys + '):</strong> categoría más frecuente. Revisar mantenimiento y protección del mobiliario/zonas más afectadas.</li>' +
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
    if (sub) sub.textContent = '(solo incidencias relevantes · ' + k.total + ' · excluye operativas y leves)';
  }

  // Exponer y auto-activar
  window.renderKPIs = render;

  function boot() {
    render();
    // Redibujar periódicamente para reflejar altas/bajas y datos cargados desde Sheets.
    setInterval(render, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
