const dotenv = require('dotenv');
const path = require('path');
const sql = require('mssql');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Detailed connection configuration
const config = {
  user: process.env.SQL_DATABASE_USERNAME,
  password: process.env.SQL_DATABASE_PASSWORD,
  server: process.env.SQL_DATABASE_HOST, // Ensure this is EXACTLY 'server', not 'host'
  port: parseInt(process.env.SQL_DATABASE_PORT || '1433'),
  database: process.env.SQL_DATABASE_NAME,
  options: {
    encrypt: false, // Change to true for cloud databases
    trustServerCertificate: true // Use only for local development
  },
  // Additional connection pool settings
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Log connection details for debugging
console.log('Connection Configuration:');
console.log('Server:', config.server);
console.log('Port:', config.port);
console.log('Database:', config.database);
console.log('Username:', config.user);

async function testConnection() {
  try {
    // Connect to the database
    await sql.connect(config);
    console.log('SQL Server connection successful');

    // Perform a simple query to verify connectivity
    const result = await sql.query`SELECT GETDATE() as currentTime`;
    console.log('Current Database Time:', result.recordset[0].currentTime);
  } catch (err) {
    console.error('Connection failed:', err);
    
    // Detailed error logging
    console.error('Error Details:');
    console.error('Message:', err.message);
    console.error('Name:', err.name);
    console.error('Code:', err.code);
    
    // If it's a connection error, log additional details
    if (err.originalError) {
      console.error('Original Error:', err.originalError);
    }
  } finally {
    // Always close the connection
    await sql.close();
  }
}

// Run the connection test
testConnection();