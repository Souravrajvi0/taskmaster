import pg from 'pg';

const { Pool } = pg;

export const DEFAULT_HEARTBEAT = 5000; // 5 seconds in milliseconds

export function getDBConnectionString() {
  const missingEnvVars = [];

  const checkEnvVar = (envVar, envVarName) => {
    if (!envVar) {
      missingEnvVars.push(envVarName);
    }
  };

  const dbUser = process.env.POSTGRES_USER;
  checkEnvVar(dbUser, 'POSTGRES_USER');

  const dbPassword = process.env.POSTGRES_PASSWORD;
  checkEnvVar(dbPassword, 'POSTGRES_PASSWORD');

  const dbName = process.env.POSTGRES_DB;
  checkEnvVar(dbName, 'POSTGRES_DB');

  const dbHost = process.env.POSTGRES_HOST || 'localhost';
  const dbPort = process.env.POSTGRES_PORT || '5432';

  if (missingEnvVars.length > 0) {
    throw new Error(`The following required environment variables are not set: ${missingEnvVars.join(', ')}`);
  }

  return `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
}

export async function connectToDatabase(dbConnectionString) {
  const pool = new Pool({
    connectionString: dbConnectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  let retryCount = 0;
  const maxRetries = 5;

  while (retryCount < maxRetries) {
    try {
      const client = await pool.connect();
      console.log('Connected to the database.');
      client.release();
      return pool;
    } catch (err) {
      console.log('Failed to connect to the database. Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      retryCount++;
    }
  }

  throw new Error('Ran out of retries to connect to database (5)');
}
