const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User.model');

const Link = sequelize.define('Link', {
  shortId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  targetUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // THÊM TRƯỜNG MỚI
  lastVisitedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW, // Mặc định là thời điểm link được tạo
  },
}, {
    // Thêm on cascade delete để khi xóa link, các Visit liên quan cũng bị xóa
    onDelete: 'CASCADE',
});

User.hasMany(Link, { foreignKey: 'userDiscordId' });
Link.belongsTo(User, { foreignKey: 'userDiscordId' });

module.exports = Link;
