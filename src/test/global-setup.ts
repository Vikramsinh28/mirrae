import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('🔧 Setting up test database...');

  try {
    if (process.env.SKIP_DB_SETUP === '1') {
      console.log('⏭️  SKIP_DB_SETUP=1 set, skipping database setup for tests');
      return;
    }
    // Never fall back to POSTGRES_URL: `db push --force-reset` wipes the target database
    const testDatabaseUrl = process.env.TEST_POSTGRES_URL;
    if (!testDatabaseUrl) {
      throw new Error('TEST_POSTGRES_URL must be set to run tests (or set SKIP_DB_SETUP=1)');
    }
    const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
    if (!databaseName.endsWith('_test') || testDatabaseUrl === process.env.POSTGRES_URL) {
      throw new Error(`Refusing to reset "${databaseName}": test database name must end in _test`);
    }

    console.log(`📂 Using test database: ${databaseName}`);

    console.log('🗄️ Deploying database schema...');
    // Use db push instead of migrate for testing
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      env: { ...process.env, POSTGRES_URL: testDatabaseUrl },
    });

    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}
