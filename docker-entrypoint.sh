#!/bin/sh
# =====================================================================
# Arranque del contenedor de la aplicacion.
#
# Aplica las migraciones pendientes y despues levanta el servidor. Se
# hace aqui y no en el "docker build" porque durante la construccion la
# base de datos no es alcanzable.
#
# Poner RUN_MIGRATIONS=false para arrancar sin tocar la base de datos
# (util si se despliegan varias replicas y solo una debe migrar, o para
# entrar a depurar sin que el arranque modifique nada).
# =====================================================================
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> Aplicando migraciones de Prisma..."
  node ./prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
  echo "==> Migraciones al dia."
else
  echo "==> RUN_MIGRATIONS=false: se omiten las migraciones."
fi

echo "==> Arrancando Next en ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec "$@"
