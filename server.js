const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');

const sequelize = require('./config/database');
const User = require('./models/User.model');

// Import routes
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');

// Biến môi trường
const PORT = process.env.PORT || 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL = process.env.RENDER_EXTERNAL_URL; // Render sẽ cung cấp biến này

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET) {
    console.error("Missing essential environment variables!");
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
        const { id, username, avatar, email } = profile;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;

        const [user, created] = await User.findOrCreate({
            where: { discordId: id },
            defaults: {
                username: username,
                avatar: avatarUrl
            }
        });

        // Nếu user đã tồn tại, có thể cập nhật thông tin nếu cần
        if (!created && (user.username !== username || user.avatar !== avatarUrl)) {
          user.username = username;
          user.avatar = avatarUrl;
          await user.save();
        }

        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));


// --- Sử dụng Routes ---
app.use('/auth', authRoutes);
app.use('/', appRoutes); // Các route còn lại

// --- Khởi động Server ---
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
        
        // Sync models - Render sẽ chạy này khi build, không nên dùng `force: true`
        await sequelize.sync(); 
        console.log('All models were synchronized successfully.');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database or start server:', error);
    }
}

startServer();
