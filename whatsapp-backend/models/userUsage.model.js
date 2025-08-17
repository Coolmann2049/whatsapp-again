const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserUsage = sequelize.define('UserUsage', {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: 'user_id_whatsapp', key: 'userId' }
        },
        campaign_messages_sent: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        bot_replies_sent: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
        // The last_reset_at column is no longer needed with the cron job approach
    }, {
        tableName: 'user_usage',
        timestamps: false
    });
    return UserUsage;
};