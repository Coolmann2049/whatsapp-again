const { UserUsage, UserID } = require('../../models'); // Import UserID model

/**
 * Checks a user's daily usage against their specific limits and resets it if a new day has started.
 * @param {number} userId - The ID of the user to check.
 * @returns {Promise<{usage: object, user: object}>} - An object containing the user's usage and their main record with limits.
 */
async function checkAndResetUsage(userId) {
    // Fetch both the usage and the user's limits in parallel
    const [usage, user] = await Promise.all([
        UserUsage.findOrCreate({ where: { userId } }).then(([usageRecord]) => usageRecord),
        UserID.findByPk(userId, { attributes: ['daily_campaign_limit', 'daily_reply_limit'] })
    ]);

    if (!user) {
        throw new Error('User not found when checking usage limits.');
    }

    const now = new Date();
    const lastReset = new Date(usage.last_reset_at);
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

    if (hoursSinceReset > 24) {
        // It's a new 24-hour period, reset the counters.
        await usage.update({
            campaign_messages_sent: 0,
            bot_replies_sent: 0,
            last_reset_at: now
        });
        // Reload the usage object to get the reset values
        await usage.reload();
    }
    
    return { usage, user };
}

module.exports = { checkAndResetUsage };