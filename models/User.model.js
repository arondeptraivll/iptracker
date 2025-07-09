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
});

// Import model Key sau khi User được định nghĩa để tránh lỗi cyclic dependency
const Key = require('./Key.model');
User.hasOne(Key, { foreignKey: 'userDiscordId' });
Key.belongsTo(User, { foreignKey: 'userDiscordId' });

module.exports = User;
