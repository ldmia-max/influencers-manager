-- El catalogo de generos queda en tres: Masculino, Femenino y Otro.
--
-- En produccion se habia anadido a mano "Masculino y Femenino", que no
-- describe a una persona sino a una audiencia, y aparecia en el
-- formulario de perfil como si fuera una opcion mas.
--
-- No se borra por nombre concreto sino por descarte: se declara cual es
-- el catalogo valido y se elimina lo que sobre. Asi la migracion vale
-- igual en produccion, en local y en cualquier base que llevara otra
-- fila improvisada, sin tener que adivinar como se llamo cada una.
--
-- Gender no tiene borrado en cascada a proposito (ver CLAUDE.md), asi
-- que primero hay que dejar sin referencias las filas que se van: los
-- perfiles que las usaran pasan a "Otro", que es lo mas cercano a lo que
-- querian decir y evita perder el dato convirtiendolo en NULL.

-- 1. "Otro" tiene que existir antes de reasignar nada.
INSERT INTO "Gender" ("id", "name", "displayName", "isActive", "createdAt")
SELECT 'gender_otro_0000000000', 'otro', 'Otro', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Gender" WHERE "name" = 'otro');

-- 2. Los perfiles de cualquier genero sobrante pasan a "Otro".
UPDATE "Profile"
SET "genderId" = (SELECT "id" FROM "Gender" WHERE "name" = 'otro')
WHERE "genderId" IN (
  SELECT "id" FROM "Gender"
  WHERE "name" NOT IN ('femenino', 'masculino', 'otro')
);

-- 3. Ya sin referencias, se van.
DELETE FROM "Gender" WHERE "name" NOT IN ('femenino', 'masculino', 'otro');
