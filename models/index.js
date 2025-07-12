const sequelize = require('../config/database');

// 1. Import tất cả các model
const User = require('./User.model');
const Link = require('./Link.model');
const Visit = require('./Visit.model');
const Key = require('./Key.model');
const Credential = require('./Credential.model'); // THÊM MODEL MỚI

// 2. Thiết lập các mối quan hệ (Associations)

// Mối quan hệ giữa User và Link
User.hasMany(Link, { foreignKey: 'userDiscordId', onDelete: 'CASCADE' });
Link.belongsTo(User, { foreignKey: 'userDiscordId' });

// Mối quan hệ giữa Link và Visit
Link.hasMany(Visit, { foreignKey: 'linkShortId', sourceKey: 'shortId', onDelete: 'CASCADE' });
Visit.belongsTo(Link, { foreignKey: 'linkShortId', targetKey: 'shortId' });

// Mối quan hệ giữa User và Key
User.hasOne(Key, { foreignKey: 'userDiscordId', onDelete: 'CASCADE' });
Key.belongsTo(User, { foreignKey: 'userDiscordId' });

// --- MỐI QUAN HỆ MỚI ---
// Mối quan hệ giữa Visit và Credential (Một lượt truy cập có thể có một bộ thông tin đăng nhập)
Visit.hasOne(Credential, { foreignKey: 'visitId', onDelete: 'CASCADE' });
Credential.belongsTo(Visit, { foreignKey: 'visitId' });

// 3. Export tất cả mọi thứ ra để sử dụng trong ứng dụng
module.exports = {
    sequelize, // Thể hiện kết nối DB
    User,
    Link,
    Visit,
    Key,
    Credential // Thêm Credential
};
