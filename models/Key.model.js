const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User.model');

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
    // THAY ĐỔI QUAN TRỌNG:
    // Key mới tạo sẽ chưa thuộc về ai cả, nên cột này phải cho phép NULL
    userDiscordId: {
        type: DataTypes.STRING,
        allowNull: true, // Sửa từ 'false' thành 'true'
        references: {
            model: 'Users',
            key: 'discordId',
        }
    },
    // Token tạm thời để định danh key chưa được nhận
    activationToken: {
        type: DataTypes.STRING,
        allowNull: true, // Chỉ có giá trị khi key chưa được kích hoạt
        unique: true
    }
});

// Quan hệ này vẫn giữ nguyên vì một key CUỐI CÙNG sẽ thuộc về một User
User.hasOne(Key, { foreignKey: 'userDiscordId', onDelete: 'CASCADE' });
Key.belongsTo(User, { foreignKey: 'userDiscordId' });


module.exports = Key;
