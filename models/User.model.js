const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  discordId: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  avatar: {
    type: DataTypes.STRING,
  },
  // --- CÁC TRƯỜNG MỚI CHO HỆ THỐNG KEY ---
  activationKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  keyExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Token tạm thời dùng trong quá trình lấy key mới
  getkeyToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Key mới được tạo ra đang chờ người dùng nhập
  pendingKey: {
    type: DataTypes.STRING,
    allowNull: true,
  }
});

module.exports = User;
