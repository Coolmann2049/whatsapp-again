const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize with database connection
const sequelize = new Sequelize('u737067433_agent','u737067433_agent','YASH.deep.o3o9rocks()', {
  host: 'srv663.hstgr.io',
  dialect: 'mysql',
  port: 3306,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
  
});

// Import models
const UserID = require('./userId.model')(sequelize);

// Initialize database
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Force sync all models with the database
    await sequelize.sync({ alter: true });
    console.log('Database models synchronized successfully.');
    
  } catch (error) {
    console.error('Unable to initialize database:', error);
    process.exit(1);
  }
}

// Export the sequelize instance, models, and initialization function
module.exports = {
  sequelize,
  UserID,
  initializeDatabase
};