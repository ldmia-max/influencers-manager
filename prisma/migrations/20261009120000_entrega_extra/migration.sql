-- Contenido entregado de mas, fuera de lo contratado.
--
-- Por defecto falso: todo lo registrado hasta ahora respondia a un
-- formato contratado, que es lo unico que la aplicacion sabia pedir.
ALTER TABLE "CampaignEntrega" ADD COLUMN "esExtra" BOOLEAN NOT NULL DEFAULT false;
