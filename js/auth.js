/* ============================================================
   Autenticación con Firebase — Vilamarina
   Bloquea toda la página (#app-content) detrás de una pantalla de
   inicio de sesión (#login-screen) hasta que Firebase confirme que hay
   una sesión activa. Solo entra quien tenga usuario/contraseña creados
   a mano en Firebase Authentication > Users (no hay alta pública).

   Firebase Authentication solo funciona con "email" internamente, así
   que aquí se simula el inicio de sesión por nombre de usuario. El
   correo real de cada persona se busca en USUARIOS_EMAIL (js/usuarios.js);
   si un usuario todavía no está en ese mapa, se usa como reserva el
   correo ficticio "usuario@vilamarina.local" (que no existe de verdad y
   por tanto no puede recibir el correo de "¿Has olvidado tu contraseña?").
   Para que la recuperación de contraseña funcione de verdad con un
   usuario, hace falta:
   1) En Firebase Authentication > Users, crear o editar esa cuenta usando
      el correo real de la persona.
   2) Añadir esa persona a USUARIOS_EMAIL en js/usuarios.js con el mismo
      correo exacto.
   ============================================================ */
(function () {
  'use strict';

  var DOMINIO_USUARIO = '@vilamarina.local';
  var MAPA_USUARIOS = (typeof USUARIOS_EMAIL !== 'undefined' && USUARIOS_EMAIL) || {};

  function usuarioAEmail(usuario) {
    var limpio = (usuario || '').trim().toLowerCase().replace(/\s+/g, '');
    if (MAPA_USUARIOS[limpio]) return MAPA_USUARIOS[limpio];
    return limpio + DOMINIO_USUARIO;
  }

  function emailAUsuario(email) {
    email = email || '';
    for (var usuario in MAPA_USUARIOS) {
      if (MAPA_USUARIOS[usuario].toLowerCase() === email.toLowerCase()) return usuario;
    }
    var i = email.indexOf(DOMINIO_USUARIO);
    return i !== -1 ? email.slice(0, i) : email;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();

  var MENSAJES_ERROR = {
    'auth/invalid-email': 'El usuario no es válido.',
    'auth/user-not-found': 'No existe ningún usuario con ese nombre.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Espera un momento y vuelve a intentarlo.',
    'auth/network-request-failed': 'Error de conexión. Comprueba tu internet e inténtalo de nuevo.'
  };

  function mostrarMsg(id, msg, esOk) {
    var box = document.getElementById(id);
    if (!box) return;
    box.textContent = msg;
    box.classList.toggle('login-msg-ok', !!esOk);
    box.style.display = 'block';
  }

  function ocultarMsg(id) {
    var box = document.getElementById(id);
    if (!box) return;
    box.style.display = 'none';
    box.classList.remove('login-msg-ok');
  }

  window.iniciarSesion = function () {
    var usuario = (document.getElementById('login-usuario') || {}).value || '';
    var password = (document.getElementById('login-password') || {}).value || '';
    ocultarMsg('login-error');
    if (!usuario.trim() || !password) {
      mostrarMsg('login-error', 'Introduce usuario y contraseña.', false);
      return;
    }
    var btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
    auth.signInWithEmailAndPassword(usuarioAEmail(usuario), password)
      .catch(function (err) {
        mostrarMsg('login-error', MENSAJES_ERROR[err.code] || 'No se ha podido iniciar sesión.', false);
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
      });
  };

  window.cerrarSesion = function () {
    auth.signOut();
  };

  // Alterna entre el formulario de inicio de sesión y el de recuperación,
  // dentro de la misma tarjeta de login.
  window.mostrarRecuperar = function (ev) {
    if (ev) ev.preventDefault();
    ocultarMsg('login-error');
    ocultarMsg('recuperar-msg');
    var loginBox = document.getElementById('login-form-box');
    var recuperarBox = document.getElementById('recuperar-form-box');
    if (loginBox) loginBox.style.display = 'none';
    if (recuperarBox) recuperarBox.style.display = 'flex';
    var usuarioActual = (document.getElementById('login-usuario') || {}).value || '';
    var input = document.getElementById('recuperar-usuario');
    if (input) { input.value = usuarioActual; input.focus(); }
  };

  window.mostrarLogin = function (ev) {
    if (ev) ev.preventDefault();
    ocultarMsg('login-error');
    ocultarMsg('recuperar-msg');
    var loginBox = document.getElementById('login-form-box');
    var recuperarBox = document.getElementById('recuperar-form-box');
    if (recuperarBox) recuperarBox.style.display = 'none';
    if (loginBox) loginBox.style.display = 'flex';
  };

  // Por seguridad, no distinguimos entre "usuario no encontrado" y "correo
  // enviado correctamente": siempre se muestra el mismo mensaje de éxito,
  // para no revelar qué nombres de usuario existen realmente. Solo un
  // fallo de conexión real se muestra como error.
  window.enviarRecuperacion = function () {
    var usuario = (document.getElementById('recuperar-usuario') || {}).value || '';
    ocultarMsg('recuperar-msg');
    if (!usuario.trim()) {
      mostrarMsg('recuperar-msg', 'Escribe tu usuario.', false);
      return;
    }
    var btn = document.getElementById('recuperar-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    var errorDeRed = false;
    auth.sendPasswordResetEmail(usuarioAEmail(usuario))
      .catch(function (err) {
        if (err.code === 'auth/network-request-failed') errorDeRed = true;
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar enlace'; }
        if (errorDeRed) {
          mostrarMsg('recuperar-msg', MENSAJES_ERROR['auth/network-request-failed'], false);
        } else {
          mostrarMsg('recuperar-msg', 'Si el usuario existe, te hemos enviado un correo con instrucciones para restablecer la contraseña.', true);
        }
      });
  };

  auth.onAuthStateChanged(function (user) {
    var login = document.getElementById('login-screen');
    var app = document.getElementById('app-content');
    if (!login || !app) return;
    if (user) {
      login.style.display = 'none';
      app.style.display = 'block';
      var sesionEl = document.getElementById('sesion-correo');
      if (sesionEl) sesionEl.textContent = emailAUsuario(user.email);
    } else {
      login.style.display = 'flex';
      app.style.display = 'none';
      var pass = document.getElementById('login-password');
      if (pass) pass.value = '';
      window.mostrarLogin();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    ['login-usuario', 'login-password'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') iniciarSesion(); });
    });
    var recuperarInput = document.getElementById('recuperar-usuario');
    if (recuperarInput) recuperarInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') enviarRecuperacion(); });
  });
})();
