/**
 * Sequelize model for the 'dialog_flows' table.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DialogFlow = sequelize.define('DialogFlow', {
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
        trigger_message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        response_message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
    }, {
        tableName: 'dialog_flows',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_userId',
                fields: ['userId']
            }
        ]
    });

    return DialogFlow;
};