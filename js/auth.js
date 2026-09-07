/* ============================================================
   Autenticación con Firebase — Vilamarina
   Bloquea toda la página (#app-content) detrás de una pantalla de
   inicio de sesión (#login-screen) hasta que Firebase confirme que hay
   una sesión activa. Solo entra quien tenga usuario/contraseña creados
   a mano en Firebase Authentication > Users (no hay alta pública).

   Firebase Authentication solo funciona con "email" internamente, así
   que aquí se simula el inicio de sesión por nombre de usuario: lo que
   la persona escribe ("juan") se convierte en un correo ficticio
   ("juan@vilamarina.local") antes de dárselo a Firebase. Esa dirección
   nunca se muestra a la persona que entra, ni hace falta que exista de
   verdad: es solo el formato que Firebase exige puertas adentro. Por
   eso, al crear cada usuario en Firebase Authentication > Users, hay
   que escribir "nombreusuario@vilamarina.local" en el campo "Email".
   ============================================================ */
(function () {
  'use strict';

  var DOMINIO_USUARIO = '@vilamarina.local';

  function usuarioAEmail(usuario) {
    var limpio = (usuario || '').trim().toLowerCase().replace(/\s+/g, '');
    return limpio + DOMINIO_USUARIO;
  }

  function emailAUsuario(email) {
    email = email || '';
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

  function mostrarError(msg) {
    var box = document.getElementById('login-error');
    if (!box) return;
    box.textContent = msg;
    box.style.display = 'block';
  }

  function ocultarError() {
    var box = document.getElementById('login-error');
    if (box) box.style.display = 'none';
  }

  window.iniciarSesion = function () {
    var usuario = (document.getElementById('login-usuario') || {}).value || '';
    var password = (document.getElementById('login-password') || {}).value || '';
    ocultarError();
    if (!usuario.trim() || !password) {
      mostrarError('Introduce usuario y contraseña.');
      return;
    }
    var btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
    auth.signInWithEmailAndPassword(usuarioAEmail(usuario), password)
      .catch(function (err) {
        mostrarError(MENSAJES_ERROR[err.code] || 'No se ha podido iniciar sesión.');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
      });
  };

  window.cerrarSesion = function () {
    auth.signOut();
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
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    ['login-usuario', 'login-password'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') iniciarSesion(); });
    });
  });
})();
