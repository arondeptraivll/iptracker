const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User.model');

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
});

User.hasMany(Link, { foreignKey: 'userDiscordId' });
Link.belongsTo(User, { foreignKey: 'userDiscordId' });

module.exports = Link;
