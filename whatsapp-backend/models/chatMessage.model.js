/**
 * Sequelize model for the 'chat_messages' table.
 * This table stores the transcript of all tracked conversations.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ChatMessage = sequelize.define('ChatMessage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp', // Foreign key to UserID table
                key: 'userId'
            }
        },
        conversation_id: { 
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'conversations', // Links to the new table
                key: 'id'
            }
        },
        campaign_id: {
            type: DataTypes.INTEGER,
            allowNull: true, // A message might not be part of a campaign
            references: {
                model: 'campaigns', // Foreign key to your campaigns table
                key: 'id'
            }
        },
        sender: {
            type: DataTypes.ENUM('user', 'bot'), // 'user' is the contact, 'bot' is your client's automated response
            allowNull: false
        },
        message_content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'chat_messages',
        timestamps: false, // We use our own 'timestamp' column
        indexes: [
            // Add indexes for all foreign keys to speed up queries
            { fields: ['userId'] },
            { fields: ['conversation_id'] },
            { fields: ['campaign_id'] }
        ]
    });

    return ChatMessage;
};