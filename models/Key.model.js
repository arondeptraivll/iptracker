const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
// Dòng require User này bị xóa trong mô hình mới, nhưng nếu bạn cần nó vì một lý do nào đó, hãy đảm bảo
// các mối quan hệ được định nghĩa trong file models/index.js
// const User = require('./User.model');

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
    // ---- THAY ĐỔI QUAN TRỌNG NHẤT LÀ DÒNG NÀY ----
    userDiscordId: {
        type: DataTypes.STRING,
        allowNull: true, // PHẢI LÀ TRUE
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

// Toàn bộ các định nghĩa quan hệ đã được chuyển sang models/index.js

module.exports = Key;
