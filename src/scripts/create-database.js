const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env') 
});

// Database configuration
const config = {
  user: process.env.SQL_DATABASE_USERNAME,
  password: process.env.SQL_DATABASE_PASSWORD,
  server: process.env.SQL_DATABASE_HOST,
  port: parseInt(process.env.SQL_DATABASE_PORT || '1433'),
  database: 'master', // Connect to system database to create new database
  options: {
    encrypt: false, // Set to true for cloud databases
    trustServerCertificate: true // Use only for local development
  }
};

async function createDatabase() {
  try {
    // Connect to SQL Server
    await sql.connect(config);

    // Check if database exists
    const checkResult = await sql.query`
      SELECT name 
      FROM sys.databases 
      WHERE name = 'p6_ebs_integration'
    `;

    if (checkResult.recordset.length === 0) {
      // Create database if it doesn't exist
      await sql.query`CREATE DATABASE p6_ebs_integration`;
      console.log('Database p6_ebs_integration created successfully');
    } else {
      console.log('Database p6_ebs_integration already exists');
    }
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    // Close connection
    await sql.close();
  }
}

// Run the database creation
createDatabase().catch(console.error);