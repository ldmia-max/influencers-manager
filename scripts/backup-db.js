#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Database Backup Script
 * Creates a backup of the PostgreSQL database
 *
 * Usage: npm run db:backup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL no esta definida en el archivo .env');
  process.exit(1);
}

// Parse DATABASE_URL
// Format: postgresql://user:password@host:port/database
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
    database: match[5].split('?')[0], // Remove query params
  };
}

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  console.log('Directorio de backups creado:', backupsDir);
}

// Generate backup filename with timestamp
const now = new Date();
const timestamp = now.toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .slice(0, 19);
const backupFilename = `backup_${timestamp}.sql`;
const backupPath = path.join(backupsDir, backupFilename);

try {
  const db = parseDatabaseUrl(DATABASE_URL);

  console.log('Iniciando backup de la base de datos...');
  console.log(`Base de datos: ${db.database}`);
  console.log(`Host: ${db.host}:${db.port}`);
  console.log(`Archivo: ${backupFilename}`);
  console.log('');

  // Set PGPASSWORD environment variable for pg_dump
  const env = { ...process.env, PGPASSWORD: db.password };

  // Run pg_dump
  const command = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p --no-owner --no-acl`;

  console.log('Ejecutando pg_dump...');
  const output = execSync(command, {
    env,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024, // 100MB buffer
  });

  // Write to file
  fs.writeFileSync(backupPath, output);

  // Get file size
  const stats = fs.statSync(backupPath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);

  console.log('');
  console.log('Backup completado exitosamente!');
  console.log(`Archivo: ${backupPath}`);
  console.log(`Tamano: ${fileSizeKB} KB`);

  // List recent backups
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse()
    .slice(0, 5);

  if (backups.length > 1) {
    console.log('');
    console.log('Ultimos backups:');
    backups.forEach((b, i) => {
      const bStats = fs.statSync(path.join(backupsDir, b));
      const bSize = (bStats.size / 1024).toFixed(2);
      console.log(`  ${i + 1}. ${b} (${bSize} KB)`);
    });
  }

} catch (error) {
  console.error('');
  console.error('Error al crear el backup:');

  if (error.message.includes('pg_dump')) {
    console.error('  pg_dump no esta instalado o no esta en el PATH');
    console.error('  Instala PostgreSQL client tools para usar este script');
  } else {
    console.error(' ', error.message);
  }

  process.exit(1);
}
