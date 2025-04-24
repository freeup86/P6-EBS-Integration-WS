const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from project root
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env') 
});

console.log('Database Configuration:');
console.log('Host:', process.env.SQL_DATABASE_HOST);
console.log('Port:', process.env.SQL_DATABASE_PORT);
console.log('Database Name:', process.env.SQL_DATABASE_NAME);
console.log('Username:', process.env.SQL_DATABASE_USERNAME);

// Use the absolute path to the database config
const databaseConfig = require(path.resolve(process.cwd(), 'src/config/database'));

async function testConnection() {
  try {
    await databaseConfig.testDatabaseConnection();
    console.log('Database connection test successful!');
    process.exit(0);
  } catch (error) {
    console.error('Database connection test failed:', error);
    console.error('Detailed Error:', error.toString());
    process.exit(1);
  }
}

testConnection();