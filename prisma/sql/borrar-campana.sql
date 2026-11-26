-- Borrar una campana desde el gestor de base de datos (DBeaver, psql).
--
-- NO es una migracion: no se aplica sola ni se numera como 001/002.
-- La app no tiene boton de borrar campanas a proposito (una campana es
-- historia comercial); borrarla es una decision deliberada que se toma
-- aqui. Lo normal para algo que no siguio es CANCELARLA desde la app.
--
-- Que se lleva por delante (ON DELETE CASCADE): influencers de la
-- campana, sus redes y formatos, entregas, metricas, avisos de plazo,
-- pagos con sus documentos y ABONOS, contactos asignados, enlaces de
-- revision e informe. /pagos deja de contarla en el total y en su mes:
-- si tenia abonos reales, ese dinero desaparece del control de costos.
--
-- Que queda: el brief (pierde el vinculo, ON DELETE SET NULL), el
-- cliente, el registro de auditoria y los archivos subidos en el volumen
-- de uploads (paso 3).
--
-- Las consultas dependen de los nombres de tablas y columnas de hoy: si
-- una migracion los cambia (p. ej. un documento nuevo en PagoInfluencer),
-- actualizar este archivo.
--
-- 0. Copia de seguridad antes (backup de Dokploy o pg_dump).
-- Reemplazar ID_CAMPANA por el id real en todos los pasos.


-- 1. Encontrar la campana
select id, name, status, mes, anio, "createdAt"
from "Campaign"
order by "createdAt";


-- 2. Ver que se va a borrar
select 'influencers' as que, count(*) from "CampaignProfile" where "campaignId" = 'ID_CAMPANA'
union all
select 'formatos', count(*) from "CampaignService" cs
  join "CampaignProfilePlatform" cpp on cpp.id = cs."campaignProfilePlatformId"
  join "CampaignProfile" cp on cp.id = cpp."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
union all
select 'entregas', count(*) from "CampaignEntrega" e
  join "CampaignService" cs on cs.id = e."campaignServiceId"
  join "CampaignProfilePlatform" cpp on cpp.id = cs."campaignProfilePlatformId"
  join "CampaignProfile" cp on cp.id = cpp."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
union all
select 'pagos', count(*) from "PagoInfluencer" pi
  join "CampaignProfile" cp on cp.id = pi."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
union all
select 'abonos', count(*) from "AbonoPago" a
  join "PagoInfluencer" pi on pi.id = a."pagoId"
  join "CampaignProfile" cp on cp.id = pi."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
union all
select 'brief vinculado', count(*) from "CampaignBrief" where "campaignId" = 'ID_CAMPANA';


-- 3. (Opcional) Archivos que quedaran huerfanos en el volumen de uploads.
-- El borrado no los toca; guardar la lista si se quieren eliminar a mano.
select u from (
  select unnest(array[pi."cuentaCobroUrl", pi."certificadoUrl", pi."rutUrl", pi."arlUrl", pi."contratoUrl"]) as u
  from "PagoInfluencer" pi join "CampaignProfile" cp on cp.id = pi."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
  union all
  select d.url from "PagoDocumento" d
  join "PagoInfluencer" pi on pi.id = d."pagoId"
  join "CampaignProfile" cp on cp.id = pi."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
  union all
  select a."comprobanteUrl" from "AbonoPago" a
  join "PagoInfluencer" pi on pi.id = a."pagoId"
  join "CampaignProfile" cp on cp.id = pi."campaignProfileId"
  where cp."campaignId" = 'ID_CAMPANA'
) x where u is not null;


-- 4. Borrar dentro de una transaccion.
-- En DBeaver, pasar antes a commit manual (boton Auto-Commit, o
-- Ctrl+Alt+Shift+A); con auto-commit cada linea se confirma sola.
begin;

delete from "Campaign" where id = 'ID_CAMPANA';
-- Debe decir DELETE 1. Si dice 0, el id esta mal: rollback.

select count(*) from "Campaign" where id = 'ID_CAMPANA';   -- debe dar 0

commit;   -- o rollback; si algo no cuadra


-- Despues, si tambien eran de prueba:
--   delete from "CampaignBrief" where id = '...';
--   El cliente solo se puede borrar cuando ya no tiene campanas
--   (Campaign.clientId es ON DELETE RESTRICT).
