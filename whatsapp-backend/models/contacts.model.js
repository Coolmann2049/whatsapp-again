/**
 * Sequelize model for the 'contacts' table.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Contact = sequelize.define('Contact', {
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
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        uploadHistoryId: { // <-- NEW FOREIGN KEY
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'upload_history',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ''
        },
        phone: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING(255),
            defaultValue: ''
        },
        company: {
            type: DataTypes.STRING(255),
            defaultValue: ''
        },
        is_manual_mode: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'contacts',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_phone_user_unique',
                unique: true,
                fields: ['phone', 'userId'] // <-- COMPOSITE UNIQUE KEY
            },
            {
                name: 'idx_userId',
                fields: ['userId']
            },
            {
                name: 'idx_uploadHistoryId',
                fields: ['uploadHistoryId']
            }
        ]
    });

    return Contact;
};