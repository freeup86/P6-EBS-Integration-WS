const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger');

// Explicitly load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Comprehensive environment variable resolution
function getEnvVar(key, defaultValue = '') {
  const value = process.env[key];
  
  // Check if value is undefined, null, or empty string
  if (value === undefined || value === null || value.trim() === '') {
    logger.warn(`Environment variable ${key} not set. Using default value.`);
    return defaultValue;
  }
  
  return value.trim();
}

// Resolve database configuration with comprehensive fallbacks
const dbConfig = {
  host: getEnvVar('SQL_DATABASE_HOST', 'localhost'),
  port: parseInt(getEnvVar('SQL_DATABASE_PORT', '1433'), 10),
  database: getEnvVar('SQL_DATABASE_NAME', 'p6_ebs_integration'),
  username: getEnvVar('SQL_DATABASE_USERNAME', 'sa'),
  password: getEnvVar('SQL_DATABASE_PASSWORD')
};

// Verbose logging of resolved configuration
console.log('Resolved Database Configuration:');
console.log('Host:', dbConfig.host);
console.log('Port:', dbConfig.port);
console.log('Database:', dbConfig.database);
console.log('Username:', dbConfig.username);

// Validate critical configuration
if (!dbConfig.password) {
  const errorMsg = 'CRITICAL: No database password provided!';
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Create Sequelize instance with comprehensive error handling
const sequelize = new Sequelize(
  dbConfig.database, 
  dbConfig.username, 
  dbConfig.password, 
  {
    dialect: 'mssql',
    host: dbConfig.host,
    port: dbConfig.port,
    
    dialectOptions: {
      options: {
        encrypt: false, // Adjust based on your SQL Server setup
        trustServerCertificate: true,
        validateBulkLoadParameters: true
      }
    },
    
    // Detailed logging
    logging: (msg) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(msg);
      }
    },
    
    // Connection pool configuration
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Comprehensive database connection test
async function testDatabaseConnection() {
  try {
    // Attempt authentication
    await sequelize.authenticate();
    logger.info('SQL Server connection established successfully.');
    
    // Sync models with additional options
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      //logging: (msg) => logger.debug(msg)
      logging: console.log
    });
    logger.info('Database models synchronized successfully.');
    
    // Optional: Run a simple query to further verify connection
    const [results] = await sequelize.query('SELECT GETDATE() as currentTime');
    logger.info('Current Database Time:', results[0].currentTime);
  } catch (error) {
    // Comprehensive error logging
    logger.error('Database Connection Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      sqlMessage: error.parent?.message
    });
    
    // Provide actionable advice
    if (error.message.includes('Authentication failed')) {
      logger.error('Authentication failed. Please check your credentials.');
    } else if (error.message.includes('Connection refused')) {
      logger.error('Connection refused. Check host, port, and firewall settings.');
    }
    
    throw error;
  }
}

// Expose methods
module.exports = {
  sequelize,
  testDatabaseConnection,
  sync: async () => {
    await testDatabaseConnection();
  }
};