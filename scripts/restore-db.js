#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Database Restore Script
 * Restores a PostgreSQL database from a backup file
 *
 * Usage: npm run db:restore -- backup_2024-01-15_10-30-00.sql
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL no esta definida en el archivo .env');
  process.exit(1);
}

// Parse DATABASE_URL
function parseDatabaseUrl(url) {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('DATABASE_URL tiene un formato invalido');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5].split('?')[0],
  };
}

// Get backup file from arguments or list available backups
const backupsDir = path.join(__dirname, '..', 'backups');
let backupFile = process.argv[2];

// List available backups if no file specified
if (!backupFile) {
  if (!fs.existsSync(backupsDir)) {
    console.error('Error: No existe el directorio de backups');
    console.error('Primero ejecuta: npm run db:backup');
    process.exit(1);
  }

  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.error('Error: No hay backups disponibles');
    console.error('Primero ejecuta: npm run db:backup');
    process.exit(1);
  }

  console.log('Backups disponibles:');
  console.log('');
  backups.forEach((b, i) => {
    const bStats = fs.statSync(path.join(backupsDir, b));
    const bSize = (bStats.size / 1024).toFixed(2);
    console.log(`  ${i + 1}. ${b} (${bSize} KB)`);
  });
  console.log('');
  console.log('Uso: npm run db:restore -- <nombre_archivo.sql>');
  console.log('Ejemplo: npm run db:restore -- ' + backups[0]);
  process.exit(0);
}

// Resolve backup file path
let backupPath = backupFile;
if (!path.isAbsolute(backupFile)) {
  // Try in backups directory first
  const inBackupsDir = path.join(backupsDir, backupFile);
  if (fs.existsSync(inBackupsDir)) {
    backupPath = inBackupsDir;
  } else if (!fs.existsSync(backupFile)) {
    console.error(`Error: Archivo no encontrado: ${backupFile}`);
    console.error('Busca en el directorio backups/ o proporciona la ruta completa');
    process.exit(1);
  }
}

if (!fs.existsSync(backupPath)) {
  console.error(`Error: Archivo no encontrado: ${backupPath}`);
  process.exit(1);
}

const db = parseDatabaseUrl(DATABASE_URL);

console.log('');
console.log('=== RESTAURACION DE BASE DE DATOS ===');
console.log('');
console.log(`Base de datos: ${db.database}`);
console.log(`Host: ${db.host}:${db.port}`);
console.log(`Archivo: ${path.basename(backupPath)}`);
console.log('');
console.log('ADVERTENCIA: Esto eliminara todos los datos actuales de la base de datos!');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Escribe "RESTAURAR" para confirmar: ', (answer) => {
  rl.close();

  if (answer !== 'RESTAURAR') {
    console.log('Operacion cancelada');
    process.exit(0);
  }

  try {
    const env = { ...process.env, PGPASSWORD: db.password };

    console.log('');
    console.log('Restaurando base de datos...');

    // Read backup file
    const sqlContent = fs.readFileSync(backupPath, 'utf8');

    // Run psql to restore
    const command = `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database}`;

    execSync(command, {
      env,
      input: sqlContent,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    console.log('');
    console.log('Base de datos restaurada exitosamente!');
    console.log('');
    console.log('Ejecuta "npm run db:generate" para regenerar el cliente de Prisma');

  } catch (error) {
    console.error('');
    console.error('Error al restaurar:');

    if (error.message.includes('psql')) {
      console.error('  psql no esta instalado o no esta en el PATH');
      console.error('  Instala PostgreSQL client tools para usar este script');
    } else {
      console.error(' ', error.message);
    }

    process.exit(1);
  }
});
