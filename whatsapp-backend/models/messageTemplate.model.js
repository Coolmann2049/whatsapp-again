const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MessageTemplate = sequelize.define('MessageTemplate', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING(50),
            defaultValue: 'General'
        },
        variables: {
            type: DataTypes.JSON,
            allowNull: true 
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_id_whatsapp', 
                key: 'userId'
            },
            onDelete: 'CASCADE'
        }
    }, {
        // --- Model Options ---

        tableName: 'message_templates',
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

    return MessageTemplate;
};