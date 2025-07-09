const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Key = sequelize.define('Key', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    keyString: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    userDiscordId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'Users', // Tên bảng 'Users'
            key: 'discordId',
        }
    }
});

module.exports = Key;
