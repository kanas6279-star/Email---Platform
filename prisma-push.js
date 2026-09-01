// This script ensures the database schema is up to date before the app starts
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('Running Prisma migrations...');
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
