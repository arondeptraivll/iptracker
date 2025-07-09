// Import các thư viện cần thiết
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { Op } = require('sequelize');

// Import cấu hình và models
const sequelize = require('./config/database');
const User = require('./models/User.model');
const Link = require('./models/Link.model');

// Import các route
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');

// Lấy các biến môi trường
const PORT = process.env.PORT || 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL = process.env.RENDER_EXTERNAL_URL; // Render cung cấp biến này tự động

// Kiểm tra các biến môi trường quan trọng
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET || !BASE_URL) {
    console.error("Missing essential environment variables! (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET, RENDER_EXTERNAL_URL)");
    process.exit(1);
}

const app = express();

// --- Cấu hình Express ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Cấu hình Session ---
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: 'auto', // Tự động bật secure cookie khi chạy trên HTTPS (Render)
      httpOnly: true,
    }
}));

// --- Cấu hình Passport.js và Discord Strategy ---
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
            defaults: {
                username: username,
                avatar: avatarUrl
            }
        });

        // Nếu user đã tồn tại, cập nhật lại thông tin (tên/avatar) nếu có thay đổi
        if (!created && (user.username !== username || user.avatar !== avatarUrl)) {
          user.username = username;
          user.avatar = avatarUrl;
          await user.save();
        }

        return done(null, user);
    } catch (err) {
        console.error("Error in Discord strategy:", err);
        return done(err, null);
    }
}));


// --- Sử dụng Routes ---
app.use('/auth', authRoutes);
app.use('/', appRoutes);

// --- Tác vụ tự động: Dọn dẹp link cũ ---
// Lịch trình: Chạy vào lúc 2 giờ sáng mỗi ngày theo múi giờ Việt Nam
cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting daily cleanup task for old links...');
    try {
        // Xác định thời gian 2 ngày trước
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        
        // Tìm và xóa tất cả các link có lastVisitedAt nhỏ hơn 2 ngày trước
        const result = await Link.destroy({
            where: {
                lastVisitedAt: {
                    [Op.lt]: twoDaysAgo // Op.lt = less than (nhỏ hơn)
                }
            }
        });
        
        if (result > 0) {
            console.log(`[CRON] Successfully deleted ${result} old link(s).`);
        } else {
            console.log('[CRON] No old links found to delete.');
        }
    } catch (error) {
        console.error('[CRON] Error during scheduled link cleanup:', error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// --- Khởi động Server ---
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection has been established successfully.');
        
        // Đồng bộ hóa model với database. Render sẽ chạy lệnh này một lần khi build.
        // Không dùng { force: true } trong môi trường production!
        await sequelize.sync({ alter: true }); // Dùng alter để cập nhật bảng một cách an toàn
        console.log('✅ All models were synchronized successfully.');

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`🌐 Public URL: ${BASE_URL}`);
        });
    } catch (error) {
        console.error('❌ Unable to connect to the database or start server:', error);
        process.exit(1);
    }
}

startServer();
