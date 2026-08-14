# syntax=docker/dockerfile:1

# =====================================================================
# Imagen de produccion para el despliegue en OVH con Dokploy.
#
# Tres etapas para que la imagen final no arrastre ni el codigo fuente
# ni las dependencias de desarrollo:
#   deps    -> instala node_modules (y genera el cliente de Prisma)
#   builder -> compila Next en modo standalone
#   runner  -> solo lo necesario para ejecutar
#
# El servidor escucha en el 3000. Dokploy lo publica por Traefik en
# https://influencer-manager.losdemarketing.com
# =====================================================================

FROM node:22-alpine AS base
# openssl lo exigen los motores de Prisma; libc6-compat cubre los
# binarios compilados contra glibc que no existen tal cual en Alpine.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app


# --------------------------- dependencias ---------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# El schema tiene que estar ANTES de npm ci: el postinstall del proyecto
# ejecuta "prisma generate" y sin el schema falla la instalacion.
COPY prisma ./prisma
RUN npm ci


# --------------------------- CLI de Prisma --------------------------
# El CLI se instala APARTE, con su arbol de dependencias completo, en
# vez de copiar node_modules/prisma y node_modules/@prisma sueltos: el
# CLI tira de paquetes que viven fuera de esos dos directorios (effect,
# entre otros) y la copia parcial revienta al arrancar con
# "Cannot find module 'effect'".
#
# La version se lee de package.json para que no pueda desincronizarse
# de la que genero el cliente en la etapa deps.
#
# Junto al CLI se instala tsx, que es lo que permite ejecutar el seed
# (prisma/seed.ts) dentro del contenedor. El seed del proyecto usa
# ts-node, que es dependencia de desarrollo y no llega a esta imagen.
FROM base AS prismacli
COPY package.json ./
RUN PRISMA_VERSION="$(node -p "require('./package.json').dependencies.prisma.replace(/^[^0-9]*/, '')")" \
    && npm install --prefix /prisma-cli --no-save --no-audit --no-fund \
       "prisma@${PRISMA_VERSION}" tsx


# ------------------------------ build -------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# URL ficticia: Prisma exige que la variable exista para construir el
# cliente, pero durante el "docker build" la base de datos NO es
# alcanzable y ninguna pagina debe consultarla. Si alguna lo hace, el
# build falla justo aqui (ver el connection() de src/app/brief/page.tsx).
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

RUN npm run build


# ----------------------------- ejecucion ----------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# HOSTNAME 0.0.0.0 es obligatorio: por defecto el servidor standalone
# escucha en localhost y Traefik no podria alcanzarlo desde fuera.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Directorio de archivos subidos: fotos de perfil de Apify y adjuntos
# del brief. Aqui se monta el volumen persistente de Dokploy. NO se usa
# public/ porque en modo standalone Next no sirve lo que se escriba ahi
# despues del build; los archivos salen por /api/uploads/[...ruta].
ENV UPLOADS_DIR=/app/uploads

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Salida standalone: server.js + solo las dependencias que Next rastreo.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# CLI de Prisma + migraciones, para aplicar "migrate deploy" al
# arrancar. No viene en la salida standalone porque es una herramienta
# de linea de comandos, no parte del servidor. Va en su propia carpeta
# para que Node resuelva sus dependencias sin mezclarlas con las del
# servidor.
COPY --from=prismacli --chown=nextjs:nodejs /prisma-cli ./prisma-cli
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
    # Punto de montaje del volumen. Tiene que existir y pertenecer a
    # nextjs ANTES de que Docker monte encima: al crear un volumen nuevo
    # Docker copia el contenido y los permisos de esta ruta, y si fuera
    # de root el proceso no podria escribir los adjuntos.
    && mkdir -p /app/uploads/briefs /app/uploads/profiles \
    && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
