const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
// Các import khác không thay đổi

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
    // ---- CỘT CÀI ĐẶT MỚI ----
    requireCaptcha: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false, // Mặc định là TẮT
    },
});

// Các định nghĩa quan hệ đã có trong models/index.js và không cần thay đổi

module.exports = Link;
