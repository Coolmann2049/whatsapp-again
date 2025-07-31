/**
 * Sequelize model for the 'ai_configurations' table.
 * Stores the AI personality and context for each user.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AiConfiguration = sequelize.define('AiConfiguration', {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp', // The table name for the UserID model
                key: 'userId'
            },
            onDelete: 'CASCADE'
        },
        business_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        industry: {
            type: DataTypes.STRING,
            allowNull: false
        },
        business_description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        key_products: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        target_audience: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        communication_tone: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'professional'
        },
        not_to_do_instructions: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: ' '
        },
        personality: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: () => ({ formality: 50, friendliness: 50, creativity: 50, detail: 50 })
        },
        faq: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: () => ({})
        }
    }, {
        tableName: 'ai_configurations',
        timestamps: true, // Adds created_at and updated_at
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return AiConfiguration;
};