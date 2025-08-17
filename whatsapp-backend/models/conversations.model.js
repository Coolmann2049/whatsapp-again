/**
 * Sequelize model for the 'conversations' table.
 * This is the single source of truth for a conversation thread.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Conversation = sequelize.define('Conversation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp',
                key: 'userId'
            }
        },
        contact_phone: {
            type: DataTypes.STRING,
            allowNull: false
        },
        is_manual_mode: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'conversations',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_user_phone_unique',
                unique: true,
                fields: ['userId', 'contact_phone']
            }
        ]
    });

    return Conversation;
};