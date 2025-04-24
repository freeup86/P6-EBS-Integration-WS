const { sequelize } = require('../config/database');
const SyncOperation = require('../models/sync-operation');
const logger = require('../utils/logger');

async function runDatabaseDiagnostics() {
  try {
    console.log('=== Database Diagnostics ===');

    // Test raw SQL query
    console.log('1. Testing Raw SQL Query:');
    try {
      const [results] = await sequelize.query('SELECT GETDATE() as currentTime');
      console.log('Current Database Time:', results[0].currentTime);
    } catch (queryError) {
      console.error('Raw SQL Query Error:', queryError);
    }

    // Test model creation
    console.log('\n2. Testing Model Creation:');
    try {
      const testOperation = await SyncOperation.create({
        type: 'Diagnostic Test',
        source: 'Database Diagnostics Script',
        status: 'Completed',
        details: 'Verifying model creation capabilities'
      });
      console.log('Test Sync Operation Created:', testOperation.toJSON());
    } catch (modelError) {
      console.error('Model Creation Error:', modelError);
    }

    // List all defined models
    console.log('\n3. Defined Models:');
    Object.keys(sequelize.models).forEach(modelName => {
      console.log(`- ${modelName}`);
    });

    // Check table exists
    console.log('\n4. Checking Table Existence:');
    try {
      const [tableResults] = await sequelize.query(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = 'dbo' 
         AND TABLE_NAME = 'sync_operations'`
      );
      console.log('Sync Operations Table Exists:', tableResults.length > 0);
    } catch (tableError) {
      console.error('Table Existence Check Error:', tableError);
    }
  } catch (error) {
    console.error('Diagnostic Script Error:', error);
  } finally {
    // Close the connection
    await sequelize.close();
  }
}

// Run diagnostics
runDatabaseDiagnostics().catch(console.error);