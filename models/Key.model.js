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
        allowNull: true,
        references: {
            model: 'Users',
            key: 'discordId',
        }
    },
    activationToken: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    }
});

// KHÔNG CÒN ĐỊNH NGHĨA QUAN HỆ Ở ĐÂY NỮA

module.exports = Key;
