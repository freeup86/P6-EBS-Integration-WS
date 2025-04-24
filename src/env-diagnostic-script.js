const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Print current working directory
console.log('Current Working Directory:', process.cwd());

// Check .env file path
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
  console.error('.env file does not exist at the specified path');
}

// Load environment variables
dotenv.config({ path: envPath });

// Print all environment variables
console.log('\n--- Environment Variables ---');
Object.keys(process.env).forEach(key => {
  if (key.startsWith('SQL_')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});
console.log('--- End of Environment Variables ---');