-- Rol de contabilidad: ve campanas, clientes y perfiles para pagar, y
-- no escribe nada de lo que gestiona mercadeo.
--
-- Anadir un valor a un enum de Postgres no reescribe ninguna fila; los
-- usuarios existentes conservan el suyo.
ALTER TYPE "UserRole" ADD VALUE 'CONTABILIDAD';
