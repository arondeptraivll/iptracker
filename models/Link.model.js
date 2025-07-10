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
    // ---- THAY ĐỔI CỘT CÀI ĐẶT ----
    // Đổi tên từ requireCaptcha thành blockForeignIPs
    blockForeignIPs: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false, // Mặc định là TẮT (cho phép tất cả)
    },
});

module.exports = Link;
