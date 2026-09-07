/* ============================================================
   Mapa de usuarios — Vilamarina
   Relaciona cada nombre de usuario (el que se escribe al iniciar sesión)
   con el correo real de esa persona. Se usa tanto para iniciar sesión
   como para "¿Has olvidado tu contraseña?".

   Para dar de alta o migrar un usuario:
   1) En Firebase Authentication > Users, crea (o edita) la cuenta usando
      el CORREO REAL de la persona — ya no el correo ficticio
      "usuario@vilamarina.local" que se usaba antes.
   2) Añade aquí una línea 'nombredeusuario': 'correo.real@dominio.com'
      con el mismo correo exacto que hayas puesto en Firebase.

   Un usuario que todavía no aparezca aquí seguirá pudiendo iniciar sesión
   igual que antes (con el correo ficticio @vilamarina.local), pero para
   él "¿Has olvidado tu contraseña?" no podrá enviarle ningún correo real
   hasta que se migre siguiendo los dos pasos de arriba.

   Este archivo no contiene contraseñas ni nada secreto, solo la relación
   usuario -> correo.
   ============================================================ */
var USUARIOS_EMAIL = {
  'auxiliar.vilamarina': 'auxiliar.vilamarina@gbp.cat',
  'celia.beltran': 'celia.beltran@cbre.com',
  'renzo.neyra': 'renzo.neyra@cbre.com',
  'santiago.berto': 'santiago.berto@cbre.com',
};
