const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserAnalytics = sequelize.define('UserAnalytics', {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'user_id_whatsapp', 
                key: 'userId' 
            }
        },
        total_messages_sent: { 
            type: DataTypes.INTEGER, 
            defaultValue: 0 
        },
        active_chats_24h: { 
            type: DataTypes.INTEGER, 
            defaultValue: 0 
        },
        response_rate_all_time: { 
            type: DataTypes.FLOAT, 
            defaultValue: 0 
        },
        weekly_message_activity: { 
            type: DataTypes.JSON, 
            defaultValue: [] 
        },
        weekly_response_rate: { 
            type: DataTypes.JSON, 
            defaultValue: [] 
        }
    }, {
        tableName: 'user_analytics',
        timestamps: true
    });
    return UserAnalytics;
};