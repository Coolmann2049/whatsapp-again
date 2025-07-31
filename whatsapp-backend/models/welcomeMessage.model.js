/**
 * Sequelize model for the 'welcome_messages' table.
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const WelcomeMessage = sequelize.define('WelcomeMessage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp', // Table name for the UserID model
                key: 'userId'
            },
            onDelete: 'CASCADE'
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'welcome_messages',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        // --- ADD THIS INDEX ---
        indexes: [
            {
                // Index on the userId foreign key for faster lookups
                fields: ['userId']
            }
        ]
    });

    return WelcomeMessage;
};