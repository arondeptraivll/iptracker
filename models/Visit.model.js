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
        type: DataTypes.STRING, // Đây là chuỗi fingerprint đầy đủ
        allowNull: false,
    },
    fingerprintId: {
        type: DataTypes.STRING, // Đây là ID duy nhất cho mỗi thiết bị
        allowNull: false,
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
