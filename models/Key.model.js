const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Key = sequelize.define('Key', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // Chuỗi key ngẫu nhiên mà người dùng sẽ nhập vào
    keyString: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    // Thời điểm key sẽ hết hạn
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    // ID của người dùng đang kích hoạt và sử dụng key này
    userDiscordId: {
        type: DataTypes.STRING,
        allowNull: false, // Ban đầu khi tạo, nó được gán cho người tạo key. Sau đó user khác có thể kích hoạt
        references: {
            model: 'Users', // Tên bảng 'Users'
            key: 'discordId',
        }
    }
}, {
    // Tùy chọn thêm
    timestamps: true, // Tự động thêm createdAt và updatedAt
});

module.exports = Key;
