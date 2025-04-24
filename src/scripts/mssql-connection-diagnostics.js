const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Detailed connection configuration for raw mssql
const config = {
  user: process.env.SQL_DATABASE_USERNAME,
  password: process.env.SQL_DATABASE_PASSWORD,
  server: process.env.SQL_DATABASE_HOST,
  database: process.env.SQL_DATABASE_NAME,
  port: parseInt(process.env.SQL_DATABASE_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Print out configuration for debugging
console.log('MSSQL Connection Configuration:');
console.log('Server:', config.server);
console.log('Port:', config.port);
console.log('Database:', config.database);
console.log('Username:', config.user);

async function testConnection() {
  try {
    // Connect to the database
    await sql.connect(config);
    console.log('Successfully connected to SQL Server');

    // Perform a simple query
    const result = await sql.query`SELECT GETDATE() as currentTime`;
    console.log('Current Database Time:', result.recordset[0].currentTime);

    // Additional diagnostics
    const serverQuery = await sql.query`SELECT @@SERVERNAME as serverName`;
    console.log('Server Name:', serverQuery.recordset[0].serverName);

    const versionQuery = await sql.query`SELECT @@VERSION as version`;
    console.log('SQL Server Version:', versionQuery.recordset[0].version);
  } catch (err) {
    console.error('Connection Failed');
    console.error('Error Details:', err);
  } finally {
    // Close connection
    await sql.close();
  }
}

// Run the test
testConnection();