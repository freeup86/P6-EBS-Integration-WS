const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Print current working directory and environment
console.log('Current Working Directory:', process.cwd());
console.log('Node Environment:', process.env.NODE_ENV);

// Determine .env file path
const envPath = path.resolve(process.cwd(), '.env');
console.log('Attempting to load .env from:', envPath);

// Check if .env file exists
if (fs.existsSync(envPath)) {
  console.log('.env file exists');
  
  // Read and print .env file contents
  const envFileContents = fs.readFileSync(envPath, 'utf8');
  console.log('--- .env File Contents ---');
  console.log(envFileContents);
  console.log('--- End of .env Contents ---');
} else {
  console.error('.env file does NOT exist at the specified path');
}

// Load environment variables with verbose logging
const result = dotenv.config({ 
  path: envPath,
  debug: true 
});

// Check for loading errors
if (result.error) {
  console.error('Error loading .env file:', result.error);
}

// Print out all SQL-related environment variables
console.log('\n--- SQL-related Environment Variables ---');
const sqlVars = [
  'SQL_DATABASE_HOST',
  'SQL_DATABASE_PORT', 
  'SQL_DATABASE_NAME', 
  'SQL_DATABASE_USERNAME', 
  'SQL_DATABASE_PASSWORD'
];

sqlVars.forEach(varName => {
  console.log(`${varName}: ${process.env[varName] || 'UNDEFINED'}`);
});
console.log('--- End of Environment Variables ---');

// Demonstrate how to explicitly set variables if they're not loading
if (!process.env.SQL_DATABASE_HOST) {
  console.warn('Attempting to set SQL_DATABASE_HOST manually');
  process.env.SQL_DATABASE_HOST = 'localhost';
}
if (!process.env.SQL_DATABASE_PORT) {
  process.env.SQL_DATABASE_PORT = '1433';
}
if (!process.env.SQL_DATABASE_NAME) {
  process.env.SQL_DATABASE_NAME = 'p6_ebs_integration';
}
if (!process.env.SQL_DATABASE_USERNAME) {
  process.env.SQL_DATABASE_USERNAME = 'sa';
}
if (!process.env.SQL_DATABASE_PASSWORD) {
  console.error('WARNING: SQL_DATABASE_PASSWORD is not set!');
}