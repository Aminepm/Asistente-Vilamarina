/* ============================================================
   Autenticación con Firebase — Vilamarina
   Bloquea toda la página (#app-content) detrás de una pantalla de
   inicio de sesión (#login-screen) hasta que Firebase confirme que hay
   una sesión activa. Solo entra quien tenga usuario/contraseña creados
   a mano en Firebase Authentication > Users (no hay alta pública).
   ============================================================ */
(function () {
  'use strict';

  firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();

  var MENSAJES_ERROR = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe ninguna cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
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
    var email = (document.getElementById('login-email') || {}).value || '';
    var password = (document.getElementById('login-password') || {}).value || '';
    email = email.trim();
    ocultarError();
    if (!email || !password) {
      mostrarError('Introduce correo y contraseña.');
      return;
    }
    var btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
    auth.signInWithEmailAndPassword(email, password)
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
      var correoEl = document.getElementById('sesion-correo');
      if (correoEl) correoEl.textContent = user.email || '';
    } else {
      login.style.display = 'flex';
      app.style.display = 'none';
      var pass = document.getElementById('login-password');
      if (pass) pass.value = '';
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    ['login-email', 'login-password'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') iniciarSesion(); });
    });
  });
})();
