const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Visit = sequelize.define('Visit', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fingerprint: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fingerprintId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fingerprintComponents: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    
    // ---- CÁC CỘT GPS MỚI ----
    latitude: {
        type: DataTypes.DOUBLE, // Dùng DOUBLE để có độ chính xác cao
        allowNull: true,
    },
    longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
    },
    gpsAccuracy: {
        type: DataTypes.FLOAT, // Độ chính xác (tính bằng mét)
        allowNull: true,
    }
});

module.exports = Visit;
