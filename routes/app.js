const router = require('express').Router();
const { nanoid } = require('nanoid');
const Link = require('../models/Link.model');
const Visit = require('../models/Visit.model');
const { Op } = require('sequelize');

// Middleware kiểm tra đã đăng nhập chưa
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// Trang chủ -> chuyển đến dashboard nếu đã đăng nhập
router.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'IP Tracker | Login' });
});

// Trang quản lý
router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const userLinks = await Link.findAll({
            where: { userDiscordId: req.user.discordId },
            include: [{
                model: Visit,
                order: [['timestamp', 'DESC']], // Sắp xếp lượt truy cập mới nhất lên đầu
            }],
            order: [['createdAt', 'DESC']],
        });

        res.render('dashboard', {
            title: 'IP Tracker | Dashboard',
            user: req.user,
            links: userLinks,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).send("Server Error");
    }
});

// Tạo link mới
router.post('/create-link', isLoggedIn, async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl) {
        return res.status(400).send('Target URL is required');
    }

    try {
        const newLink = await Link.create({
            shortId: nanoid(7), // Tạo ID ngắn 7 ký tự
            targetUrl,
            userDiscordId: req.user.discordId
        });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error creating link:", error);
        res.status(500).send('Could not create link');
    }
});

// Link theo dõi -> phục vụ trang track.ejs
router.get('/t/:shortId', async (req, res) => {
    try {
        const link = await Link.findOne({ where: { shortId: req.params.shortId } });
        if (link) {
            res.render('track', { targetUrl: link.targetUrl, shortId: link.shortId });
        } else {
            res.status(404).send('Link not found');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// API endpoint để nhận dữ liệu từ client
router.post('/log', async (req, res) => {
    const { shortId, fingerprint } = req.body;
    if (!shortId || !fingerprint) {
        return res.status(400).json({ status: 'error', message: 'Missing data' });
    }
    
    // Lấy IP chính xác nhất, đặc biệt khi chạy sau proxy như Render
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const link = await Link.findOne({ where: { shortId } });
        if (!link) {
            return res.status(404).json({ status: 'error', message: 'Link not found' });
        }
        
        // --- Logic xử lý Fingerprint ID ---
        let finalFingerprintId;
        const existingVisit = await Visit.findOne({
            where: { fingerprint: fingerprint },
            include: [{
                model: Link,
                where: { userDiscordId: link.userDiscordId } // Chỉ tìm trong các link của cùng 1 user
            }]
        });

        if (existingVisit) {
            finalFingerprintId = existingVisit.fingerprintId; // Dùng lại ID đã có
        } else {
            finalFingerprintId = nanoid(10); // Tạo ID mới cho thiết bị mới
        }

        // Lưu vào database
        await Visit.create({
            ipAddress: ipAddress.split(',')[0].trim(), // Lấy IP đầu tiên nếu có nhiều
            fingerprint: fingerprint,
            fingerprintId: finalFingerprintId,
            userAgent: req.headers['user-agent'],
            linkShortId: shortId
        });
        
        res.json({ status: 'success' });

    } catch (error) {
        console.error("Logging error:", error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

module.exports = router;
