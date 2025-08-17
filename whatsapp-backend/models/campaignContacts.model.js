/**
 * Sequelize model for the 'campaign_contacts' linking table.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CampaignContact = sequelize.define('CampaignContact', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        campaign_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'campaigns',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        contact_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'contacts',
                key: 'id'
            },
            onDelete: 'CASCADE'
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
        status: {
            type: DataTypes.STRING, // e.g., 'pending', 'sent', 'failed', 'replied'
            defaultValue: 'pending'
        },
        ai_reply_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        replied_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'campaign_contacts',
        timestamps: false, // We are managing timestamps manually with sent_at/replied_at
        indexes: [
            {
                name: 'idx_campaignId',
                fields: ['campaign_id']
            },
            {
                name: 'idx_contactId',
                fields: ['contact_id']
            },
            {
                name: 'idx_campaign_id_status',
                fields: ['campaign_id', 'status']
            }
        ]
    });

    return CampaignContact;
};
