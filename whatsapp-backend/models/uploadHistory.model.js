/**
 * Sequelize model for the 'upload_history' table.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UploadHistory = sequelize.define('UploadHistory', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        file_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.STRING, // e.g., 'Completed', 'Failed'
            allowNull: false
        },
        total_contacts: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp',
                key: 'userId'
            },
            onDelete: 'CASCADE'
        },
        is_archived: { // For soft-archiving upload history
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'upload_history',
        timestamps: true, // Will create created_at and updated_at
        indexes: [
            {
                name: 'idx_userId',
                fields: ['userId']
            }
        ]
    });

    return UploadHistory;
};
