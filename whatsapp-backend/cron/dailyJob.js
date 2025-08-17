const cron = require('node-cron');
const { Campaign, UserUsage } = require('../models');
const dotenv = require('dotenv');
dotenv.config();

// Job 1: Reset all daily usage counters at midnight
async function resetDailyUsage() {
    console.log('Running daily cron job to reset usage counters...');
    try {
        await UserUsage.update(
            { campaign_messages_sent: 0, bot_replies_sent: 0 },
            { where: {} } // Apply to all users
        );
        console.log('Daily usage counters have been reset.');
    } catch (error) {
        console.error('Error resetting daily usage counters:', error);
    }
}

// Job 2: Resume campaigns that were paused due to limits
async function resumePausedCampaigns() {
    console.log('Checking for campaigns to resume...');
    const pausedCampaigns = await Campaign.findAll({
        where: { status: 'Paused_Limit' },
        include: [{ model: UserID, as: 'user' }]
    });

    for (const campaign of pausedCampaigns) {
        const usage = await UserUsage.findOne({ where: { userId: campaign.userId } });
        
        // Check if the user is now below their limit (counters were just reset)
        if (usage.campaign_messages_sent < campaign.user.daily_campaign_limit) {
            console.log(`User ${campaign.userId}'s limit has reset. Resuming campaign ${campaign.id}.`);
            await campaign.update({ status: 'Running' });

            // Command the worker to pick up the job again
            await fetch(`${process.env.VPS_URL}/api/process-campaign`, {
                method: 'POST',
                body: JSON.stringify({
                    campaignId: campaign.id,
                    clientId: campaign.client_id,
                    auth: process.env.VPS_AUTH
                })
            });
        }
    }
}

function startDailyJobs() {
    // Schedule to run every day at midnight (server time)
    cron.schedule('0 0 * * *', async () => {
        await resetDailyUsage();
        await resumePausedCampaigns();
    });
}

module.exports = { startDailyJobs };