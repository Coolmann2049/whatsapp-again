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
const Contact = require('./contacts.model')(sequelize);
const Campaign = require('./campaign.model')(sequelize);
const MessageTemplate = require('./messageTemplate.model')(sequelize);
const UploadHistory = require('./uploadHistory.model')(sequelize);
const UserAnalytics = require('./userAnalytics.model')(sequelize);
const CampaignContacts = require('./campaignContacts.model')(sequelize);
const WelcomeMessage = require('./welcomeMessage.model')(sequelize);
const DialogFlows = require('./dialogFlows.model')(sequelize);
const AiConfiguration = require('./aiConfiguration.model')(sequelize);
const ChatMessage = require('./chatMessage.model')(sequelize);
const Conversation = require('./conversations.model')(sequelize);
const UserUsage = require('./userUsage.model')(sequelize);


// Initialize database
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Force sync all models with the database
    await sequelize.sync({ alter : true });
    console.log('Database models synchronized successfully.');

    // A Campaign belongs to a single MessageTemplate
    Campaign.belongsTo(MessageTemplate, {
        foreignKey: 'template_id',
        as: 'template' // This 'as' alias MUST match the one in your .findAll() query
    });

    // A MessageTemplate can be used in many Campaigns
    MessageTemplate.hasMany(Campaign, {
        foreignKey: 'template_id'
    });

    // In your models/index.js or database.js
    Campaign.belongsTo(UserID, { foreignKey: 'userId', as: 'user' });
    UserID.hasMany(Campaign, { foreignKey: 'userId' });

    // A Contact can have many ChatMessages
    Contact.hasMany(ChatMessage, {
        foreignKey: 'contact_id'
    });

    // A ChatMessage belongs to one Contact
    ChatMessage.belongsTo(Contact, {
        foreignKey: 'contact_id'
    });
    // A CampaignContact record belongs to one Contact
    CampaignContacts.belongsTo(Contact, {
        foreignKey: 'contact_id'
    });

    // A Contact can be part of many campaigns (and thus have many CampaignContact records)
    Contact.hasMany(CampaignContacts, {
        foreignKey: 'contact_id'
    });

    // This is the association you are missing
    Campaign.hasMany(CampaignContacts, {
        foreignKey: 'campaign_id'
    });
    CampaignContacts.belongsTo(Campaign, {
        foreignKey: 'campaign_id'
    });
    
    UserID.hasMany(Conversation, {
    foreignKey: 'userId'
    });
    Conversation.belongsTo(UserID, {
        foreignKey: 'userId'
    });

    // A Conversation can have many Chat Messages
    Conversation.hasMany(ChatMessage, {
        foreignKey: 'conversation_id'
    });
    ChatMessage.belongsTo(Conversation, {
        foreignKey: 'conversation_id'
    });
  } catch (error) {
    console.error('Unable to initialize database:', error);
    process.exit(1);
  }
}

// Export the sequelize instance, models, and initialization function
module.exports = {
  sequelize,
  UserID,
  Contact,
  Campaign,
  MessageTemplate,
  UploadHistory,
  UserAnalytics,
  CampaignContacts,
  WelcomeMessage,
  DialogFlows,
  AiConfiguration,
  ChatMessage,
  Conversation,
  UserUsage,
  initializeDatabase
};