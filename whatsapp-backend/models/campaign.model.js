const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Campaign = sequelize.define('Campaign', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        template_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'message_templates',
            },
            onDelete: 'SET NULL', 
            onUpdate: 'SET NULL'
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
        status: {
            type: DataTypes.STRING(50),
            defaultValue: 'Draft'
        },
        sent_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        delivered_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        replies_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        client_id: {
            type: DataTypes.STRING(255),
            allowNull: false
        }
    }, {
        tableName: 'campaigns',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_userId',
                fields: ['userId']
            },
            {
                name: 'idx_templateId',
                fields: ['template_id']
            },
            {
                name: 'idx_status',
                fields: ['status']
            },
            {
                name: 'idx_clientId',
                fields: ['client_id']
            }
        ]  
    });

    return Campaign;
};