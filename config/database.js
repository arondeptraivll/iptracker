const { Sequelize } = require('sequelize');

// Render.com cung cấp DATABASE_URL trong biến môi trường
// Sequelize sẽ tự động đọc và sử dụng nó
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Cần thiết cho kết nối SSL trên Render
    }
  },
  logging: false // Tắt log SQL để terminal sạch sẽ
});

module.exports = sequelize;
