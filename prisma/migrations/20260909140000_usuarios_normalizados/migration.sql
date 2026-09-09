-- Los identificadores de cuenta guardados como URL vuelven a ser el
-- identificador suelto.
--
-- Quien da de alta un creador copia la URL desde la propia plataforma.
-- Hoy eso se limpia al guardar (normalizarUsuarioSocial, aplicado en
-- normalizarCuentas), pero los perfiles creados antes de esa regla se
-- quedaron con la URL entera dentro de `username`, y ese campo no es
-- decorativo: de el salen las consultas a Apify y los enlaces al perfil
-- que ve el cliente. Guardado asi, la sincronizacion no encuentra la
-- cuenta y el enlace se muestra como "@https://www.instagram.com/...".
--
-- Se repite aqui la misma logica en SQL porque una migracion tiene que
-- poder aplicarse sola en el arranque; ejecutar un script a mano dentro
-- del contenedor es justo lo que se olvida.
UPDATE "SocialAccount"
SET "username" = trim(
  BOTH '/' FROM
  regexp_replace(
    regexp_replace(
      -- 3. YouTube guarda /channel/UC..., /c/Nombre y /user/Nombre: se
      --    conserva lo que va detras, que es el identificador real.
      regexp_replace(
        -- 2. Fuera parametros y ancla.
        split_part(split_part(
          -- 1. Fuera protocolo y dominio.
          regexp_replace("username", '^(https?://)?(www\.|m\.)?(instagram|tiktok|youtube|kick)\.com/', '', 'i'),
        '?', 1), '#', 1),
        '^(channel|c|user)/', '', 'i'
      ),
      -- 4. Fuera la arroba inicial.
      '^@', ''
    ),
    -- 5. Si queda algo despues del identificador, se descarta.
    '/.*$', ''
  )
)
WHERE "username" LIKE '%/%' OR "username" LIKE '@%';
