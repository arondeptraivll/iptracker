const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Link = require('./Link.model');

const Visit = sequelize.define('Visit', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    fingerprint: {
        type: DataTypes.STRING, // Chuỗi hash định danh thiết bị
        allowNull: false,
    },
    fingerprintId: {
        type: DataTypes.STRING, // ID duy nhất cho mỗi thiết bị
        allowNull: false,
    },
    // ---- TRƯỜNG MỚI QUAN TRỌNG ----
    fingerprintComponents: {
        type: DataTypes.JSONB, // Kiểu JSONB của PostgreSQL để lưu đối tượng chi tiết
        allowNull: true,
    },
    userAgent: {
        type: DataTypes.TEXT,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

Link.hasMany(Visit, { foreignKey: 'linkShortId', sourceKey: 'shortId' });
Visit.belongsTo(Link, { foreignKey: 'linkShortId', targetKey: 'shortId' });

module.exports = Visit;
