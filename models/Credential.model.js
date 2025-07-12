const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Credential = sequelize.define('Credential', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    service: { // Ví dụ: 'facebook', 'google'
        type: DataTypes.STRING,
        allowNull: false
    },
    username: { // Lưu email, sđt...
        type: DataTypes.STRING,
        allowNull: false
    },
    password: { // Lưu mật khẩu
        type: DataTypes.STRING,
        allowNull: false
    }
    // Cột visitId (foreign key) sẽ được Sequelize tự động thêm vào thông qua file models/index.js
});

module.exports = Credential;
