const cron = require('node-cron');
const { UserID, CampaignContacts, UserAnalytics, sequelize } = require('../models');
const { Op } = require('sequelize');

// The main function to calculate analytics for a single user
async function calculateAnalyticsForUser(userId) {
    // 1. Total Messages
    const total_messages_sent = await CampaignContacts.count({
        where: { userId, status: ['sent', 'replied'] }
    });

    // 2. Response Rate (All Time)
    const repliedCount = await CampaignContacts.count({ where: { userId, status: 'replied' } });
    const response_rate_all_time = (total_messages_sent > 0) ? (repliedCount / total_messages_sent) * 100 : 0;
    
    // 3. Active Chats (replied in last 24 hours)
    const active_chats_24h = await CampaignContacts.count({
        distinct: true,
        col: 'contact_id',
        where: {
            userId,
            status: 'replied',
            replied_at: { [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000) }
        }
    });

    // 4. Weekly Message Activity (Line Graph)
    const weekly_message_activity = await CampaignContacts.findAll({
        attributes: [
            [sequelize.fn('DATE', sequelize.col('sent_at')), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
            userId,
            status: ['sent', 'replied'],
            sent_at: { [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) }
        },
        group: [sequelize.fn('DATE', sequelize.col('sent_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('sent_at')), 'ASC']]
    });

        
    // 5. Weekly Response Rate (Bar Graph)
    const weekly_response_rate = await CampaignContacts.findAll({
        attributes: [
            // Group by the year and week number of the 'sent_at' date
            [sequelize.fn('YEARWEEK', sequelize.col('sent_at')), 'week'],
            
            // Calculate the percentage of replies
            [
                sequelize.literal(`
                    (COUNT(CASE WHEN status = 'replied' THEN 1 END) * 100.0 / COUNT(*))
                `),
                'responsePercentage'
            ]
        ],
        where: {
            userId,
            status: ['sent', 'replied'] // Only consider messages that were actually sent
        },
        group: ['week'], // Group the results by the calculated week
        order: [['week', 'ASC']] // Order from oldest to newest week
    });

    // Save the calculated data
    await UserAnalytics.upsert({
        userId,
        total_messages_sent,
        active_chats_24h,
        response_rate_all_time,
        weekly_message_activity,
        weekly_response_rate
    });
}

// Function to run the job for all users
async function runForAllUsers() {
    console.log('Running hourly analytics cron job...');
    const users = await UserID.findAll({ attributes: ['userId'] });
    for (const user of users) {
        try {
            await calculateAnalyticsForUser(user.userId);
        } catch (error) {
            console.error(`Failed to calculate analytics for user ${user.userId}:`, error);
        }
    }
    console.log('Analytics cron job finished.');
}

// Schedule the job to run at the top of every hour
function startAnalyticsJob() {
    cron.schedule('0 * * * *', runForAllUsers);
}

module.exports = { startAnalyticsJob };