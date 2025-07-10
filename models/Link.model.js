const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
    lastVisitedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    blockForeignIPs: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    // ---- CỘT CÀI ĐẶT MỚI ----
    requestGPS: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false, // Mặc định là TẮT
    },
});

module.exports = Link;
