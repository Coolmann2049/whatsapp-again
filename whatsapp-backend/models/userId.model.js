const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserID = sequelize.define('UserID', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    business_hours: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    notification_settings: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue : 1
    },
    devices_data: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue : '[]'
    },
    profile_photo_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    hashed_password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    device_id_counter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    reply_mode: {
      type: DataTypes.ENUM('ai', 'keyword', 'off'),
      allowNull: false,
      defaultValue: 'off' // Default to off for safety
    },
  }, {
    tableName: 'user_id_whatsapp',
    timestamps: true,
    indexes: [
      {
        fields: ['email'],
        unique: true,
        name: 'idx_email_unique' 
      }
    ],
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return UserID;
};