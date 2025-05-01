// src/scripts/create-user.js
const User = require('../models/user');
const { sequelize } = require('../config/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createUser() {
  try {
    // Sync the database model
    await sequelize.sync();
    
    // Prompt for user details
    rl.question('Enter username: ', (username) => {
      rl.question('Enter email: ', (email) => {
        rl.question('Enter password: ', async (password) => {
          rl.question('Enter name: ', async (name) => {
            try {
              // Create user
              const user = await User.create({
                username,
                email,
                password,
                name,
                isActive: true
              });
              
              console.log(`User created with ID: ${user.id}`);
            } catch (error) {
              console.error('Error creating user:', error);
            } finally {
              rl.close();
              process.exit(0);
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('Setup error:', error);
    rl.close();
    process.exit(1);
  }
}

createUser();