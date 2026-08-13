# Plan de Migracion - PostgreSQL a VPS

## Contexto

Actualmente la base de datos PostgreSQL corre en un servicio administrado (ej. Supabase, Neon, Railway, etc.). Este plan cubre la migracion a una instancia PostgreSQL propia en una VPS (DigitalOcean, Hetzner, Linode, etc.).

### Dependencias actuales del proyecto
- **Prisma 6.19+** con `prisma-client-js`
- **Extensiones requeridas**: `vector`, `pg_trgm`
- **Scripts existentes**: `npm run db:backup` (pg_dump) y `npm run db:restore` (psql)
- **Sin Docker** actualmente (no hay Dockerfile ni docker-compose)
- **Sin migraciones formales** (se usa `db push`, solo existe un SQL manual en `prisma/migrations/`)

---

## Fase 0: Preparacion (antes de tocar la VPS)

### 0.1 Generar migraciones formales
Actualmente se usa `prisma db push` sin historial de migraciones. Antes de migrar hay que crear una baseline.

```bash
# 1. Crear carpeta de migraciones desde el schema actual
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2. Marcar como ya aplicada en la BD actual
npx prisma migrate resolve --applied 0_init
```

### 0.2 Backup completo de la BD actual
```bash
# Usando el script existente del proyecto
npm run db:backup

# O manualmente con formato custom (mas flexible para restore)
pg_dump -h <host_actual> -p 5432 -U <user> -d <database> \
  -F c --no-owner --no-acl \
  -f backups/pre_migracion_$(date +%Y%m%d_%H%M%S).dump
```

### 0.3 Documentar la DATABASE_URL actual
Guardar la URL actual como referencia para rollback:
```
DATABASE_URL="postgresql://user:pass@host_actual:5432/influencer_manager"
```

---

## Fase 1: Configurar PostgreSQL en la VPS

### 1.1 Instalar PostgreSQL 16+
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql-16 postgresql-contrib-16

# Verificar
sudo systemctl status postgresql
psql --version
```

### 1.2 Instalar extensiones requeridas
El schema requiere `vector` y `pg_trgm`:

```bash
# pg_trgm viene con postgresql-contrib (ya instalado arriba)

# pgvector requiere instalacion aparte
sudo apt install -y postgresql-16-pgvector

# Verificar disponibilidad
sudo -u postgres psql -c "SELECT * FROM pg_available_extensions WHERE name IN ('vector', 'pg_trgm');"
```

### 1.3 Crear base de datos y usuario
```bash
sudo -u postgres psql <<EOF
CREATE USER influencer_app WITH PASSWORD '<password_seguro>';
CREATE DATABASE influencer_manager OWNER influencer_app;

\c influencer_manager
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Dar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE influencer_manager TO influencer_app;
GRANT ALL ON SCHEMA public TO influencer_app;
EOF
```

### 1.4 Configurar acceso remoto
Editar `postgresql.conf`:
```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```
```
listen_addresses = 'localhost'    # Solo localhost si la app esta en la misma VPS
# listen_addresses = '0.0.0.0'   # Si la app esta en otro servidor
```

Editar `pg_hba.conf`:
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```
```
# Conexion local
local   influencer_manager   influencer_app   scram-sha-256

# Si necesitas acceso remoto (solo desde IP especifica)
# host  influencer_manager   influencer_app   <IP_APP>/32   scram-sha-256
```

```bash
sudo systemctl restart postgresql
```

### 1.5 Firewall
```bash
# Si la app esta en la misma VPS, NO abrir el puerto 5432 externamente
sudo ufw allow ssh
sudo ufw enable

# Solo si necesitas acceso remoto:
# sudo ufw allow from <IP_APP> to any port 5432
```

---

## Fase 2: Migrar los datos

### 2.1 Restaurar el backup en la VPS

**Opcion A: Desde el backup custom (.dump)**
```bash
# Copiar el backup a la VPS
scp backups/pre_migracion_*.dump user@<VPS_IP>:/tmp/

# En la VPS, restaurar
pg_restore -h localhost -U influencer_app -d influencer_manager \
  --no-owner --no-acl /tmp/pre_migracion_*.dump
```

**Opcion B: Desde el backup SQL (.sql)**
```bash
scp backups/backup_*.sql user@<VPS_IP>:/tmp/

psql -h localhost -U influencer_app -d influencer_manager < /tmp/backup_*.sql
```

### 2.2 Verificar la integridad de los datos
```bash
# En la VPS
psql -h localhost -U influencer_app -d influencer_manager <<EOF
-- Verificar tablas principales
SELECT 'Profile' as tabla, count(*) FROM "Profile"
UNION ALL SELECT 'SocialAccount', count(*) FROM "SocialAccount"
UNION ALL SELECT 'Campaign', count(*) FROM "Campaign"
UNION ALL SELECT 'CampaignProfile', count(*) FROM "CampaignProfile"
UNION ALL SELECT 'ServiceType', count(*) FROM "ServiceType"
UNION ALL SELECT 'User', count(*) FROM "User";

-- Verificar extensiones
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');

-- Verificar enums
SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid ORDER BY typname, enumsortorder;
EOF
```

### 2.3 Marcar migraciones como aplicadas
```bash
# Desde tu maquina local, apuntando a la nueva BD
DATABASE_URL="postgresql://influencer_app:<pass>@<VPS_IP>:5432/influencer_manager" \
  npx prisma migrate resolve --applied 0_init
```

---

## Fase 3: Configurar la aplicacion

### 3.1 Actualizar la variable de entorno

Si la app corre **en la misma VPS**:
```env
DATABASE_URL="postgresql://influencer_app:<password>@localhost:5432/influencer_manager"
```

Si la app corre **en otro servidor** (ej. Vercel):
```env
DATABASE_URL="postgresql://influencer_app:<password>@<VPS_IP>:5432/influencer_manager?sslmode=require"
```

### 3.2 Verificar conexion de Prisma
```bash
npx prisma db pull    # Debe mostrar el schema sin errores
npx prisma studio     # Abrir y verificar datos visualmente
```

### 3.3 Probar la aplicacion
```bash
npm run build         # Verificar que compila
npm run dev           # Probar flujos criticos:
                      # - Login
                      # - Listar perfiles (paginacion + orden por tipo)
                      # - Crear campana
                      # - Approval workflow
```

---

## Fase 4: Optimizacion post-migracion

### 4.1 Configurar PostgreSQL para produccion
Editar `postgresql.conf` segun los recursos de la VPS:

```conf
# Para una VPS de 4GB RAM / 2 CPU (ajustar segun tu VPS)
shared_buffers = 1GB                # 25% de RAM
effective_cache_size = 3GB          # 75% de RAM
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 100
random_page_cost = 1.1              # SSD

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9

# Logging (util para debug)
log_min_duration_statement = 1000   # Log queries > 1 segundo
```

```bash
sudo systemctl restart postgresql
```

### 4.2 Configurar backups automaticos
```bash
# Crear script de backup
sudo mkdir -p /opt/backups/postgres

cat << 'SCRIPT' | sudo tee /opt/backups/pg_backup.sh
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="influencer_manager"

# Backup
pg_dump -U influencer_app -d $DB_NAME -F c --no-owner --no-acl \
  -f "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

# Eliminar backups mayores a 30 dias
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

echo "$(date): Backup completado - ${DB_NAME}_${TIMESTAMP}.dump"
SCRIPT

sudo chmod +x /opt/backups/pg_backup.sh

# Cron: backup diario a las 3 AM
echo "0 3 * * * postgres /opt/backups/pg_backup.sh >> /var/log/pg_backup.log 2>&1" | sudo tee /etc/cron.d/pg-backup
```

### 4.3 Connection pooling (opcional pero recomendado)
Si la app corre en Vercel/serverless, usar PgBouncer para evitar agotar conexiones:

```bash
sudo apt install -y pgbouncer

# Configurar /etc/pgbouncer/pgbouncer.ini
# [databases]
# influencer_manager = host=localhost port=5432 dbname=influencer_manager
#
# [pgbouncer]
# listen_port = 6432
# listen_addr = 0.0.0.0
# auth_type = scram-sha-256
# pool_mode = transaction
# max_client_conn = 200
# default_pool_size = 20
```

Actualizar DATABASE_URL para usar PgBouncer:
```env
DATABASE_URL="postgresql://influencer_app:<pass>@localhost:6432/influencer_manager?pgbouncer=true"
```

Y agregar URL directa para migraciones (PgBouncer no soporta DDL):
```env
DIRECT_URL="postgresql://influencer_app:<pass>@localhost:5432/influencer_manager"
```

Actualizar `schema.prisma`:
```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector, pg_trgm]
}
```

---

## Fase 5: Seguridad

### 5.1 SSL para conexiones remotas
Si la app NO esta en la misma VPS, configurar SSL:

```bash
# PostgreSQL ya genera certificados auto-firmados en la instalacion
# Verificar en postgresql.conf:
# ssl = on
# ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
# ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'

# Para produccion real, usar certificados de Let's Encrypt o similares
```

### 5.2 Monitoreo basico
```bash
# Instalar pg_stat_statements para monitorear queries lentas
sudo -u postgres psql -d influencer_manager -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Query para ver las consultas mas lentas:
# SELECT query, calls, mean_exec_time, total_exec_time
# FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## Plan de Rollback

Si algo sale mal, revertir a la BD original:

1. Cambiar `DATABASE_URL` de vuelta a la URL original (guardada en Fase 0.3)
2. Redesplegar la app
3. Verificar que todo funcione
4. Diagnosticar el problema con la VPS sin prisa

**Tiempo estimado de rollback: < 5 minutos** (solo cambiar variable de entorno + redeploy)

---

## Checklist resumido

- [ ] Crear baseline de migraciones (`prisma migrate diff`)
- [ ] Backup completo de la BD actual
- [ ] Guardar DATABASE_URL actual como referencia
- [ ] Instalar PostgreSQL 16+ en VPS
- [ ] Instalar extensiones: `pgvector`, `pg_trgm`
- [ ] Crear usuario y base de datos
- [ ] Configurar acceso (pg_hba.conf, firewall)
- [ ] Restaurar backup en la VPS
- [ ] Verificar conteo de registros en todas las tablas
- [ ] Verificar extensiones y enums
- [ ] Actualizar DATABASE_URL en la app
- [ ] `prisma db pull` exitoso
- [ ] `npm run build` exitoso
- [ ] Probar flujos criticos manualmente
- [ ] Configurar backups automaticos
- [ ] Configurar PgBouncer (si es serverless)
- [ ] Configurar SSL (si acceso remoto)
