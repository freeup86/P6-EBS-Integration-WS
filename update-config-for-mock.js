// update-config-for-mock.js
const fs = require('fs');
const path = require('path');

// Path to config.js
const configPath = path.join(__dirname, 'src', 'config.js');

// Read the current config file
let configContent = fs.readFileSync(configPath, 'utf8');

// Update the baseUrl values to point to the mock API
configContent = configContent.replace(
  /baseUrl: process\.env\.P6_API_URL \|\| '.*?'/g, 
  "baseUrl: process.env.P6_API_URL || 'http://localhost:3000/mock-api/p6'"
);

configContent = configContent.replace(
  /baseUrl: process\.env\.EBS_API_URL \|\| '.*?'/g, 
  "baseUrl: process.env.EBS_API_URL || 'http://localhost:3000/mock-api/ebs'"
);

// Write the updated config back to the file
fs.writeFileSync(configPath, configContent);

console.log('Config updated to use mock API!');