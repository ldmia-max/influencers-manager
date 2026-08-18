-- Margen congelado por campana.
--
-- El DEFAULT 0.4 NOT NULL rellena las filas existentes al 40%, que es
-- una decision consciente: es el margen que todas llevan mostrando
-- desde que se subio el valor global, asi que congelarlas ahi no
-- cambia ninguna cifra visible. Las campanas anteriores a ese cambio
-- se negociaron al 20%, pero se asume el 40% para no alterar lo que ya
-- se venia viendo.

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "markupPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.4;

