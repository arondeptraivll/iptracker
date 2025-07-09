const router = require('express').Router();
const { nanoid } = require('nanoid');
const sequelize = require('../config/database'); // Import sequelize cho transaction
const Link = require('../models/Link.model');
const Visit = require('../models/Visit.model');
const { Op } = require('sequelize');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Middleware kiểm tra đăng nhập
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// --- CÁC ROUTE HIỆN CÓ ---

router.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('index', { title: 'IP Tracker | Login' });
});

router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const userLinks = await Link.findAll({
            where: { userDiscordId: req.user.discordId },
            include: [{
                model: Visit,
                order: [['timestamp', 'DESC']],
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

router.post('/create-link', isLoggedIn, async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl) return res.status(400).send('Target URL is required');
    try {
        await Link.create({
            shortId: nanoid(7),
            targetUrl,
            userDiscordId: req.user.discordId
        });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error creating link:", error);
        res.status(500).send('Could not create link');
    }
});

// --- ROUTE CẬP NHẬT & ROUTE MỚI ---

// ROUTE MỚI: Xóa một link
router.post('/delete-link/:shortId', isLoggedIn, async (req, res) => {
    try {
        const { shortId } = req.params;
        const link = await Link.findOne({
            where: {
                shortId: shortId,
                userDiscordId: req.user.discordId // QUAN TRỌNG: Chỉ chủ sở hữu mới được xóa
            }
        });

        if (link) {
            await link.destroy(); // Sequelize sẽ tự xóa các visit liên quan nhờ 'onDelete: CASCADE'
            res.redirect('/dashboard');
        } else {
            res.status(404).send("Link not found or you don't have permission.");
        }
    } catch (error) {
        console.error("Error deleting link:", error);
        res.status(500).send("Server Error");
    }
});

// ROUTE MỚI: Xóa một kết quả (Visit)
router.post('/delete-visit/:visitId', isLoggedIn, async (req, res) => {
    try {
        const { visitId } = req.params;
        const visit = await Visit.findOne({
            where: { id: visitId },
            include: {
                model: Link,
                where: { userDiscordId: req.user.discordId },
                required: true
            }
        });
        
        if (visit) {
            await visit.destroy();
            res.json({ success: true, message: "Visit deleted successfully." });
        } else {
            res.status(404).json({ success: false, message: "Visit not found or permission denied." });
        }
    } catch (error) {
        console.error("Error deleting visit:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});


// ROUTE MỚI: Lấy thông tin chi tiết IP
router.get('/ip-details/:ip', isLoggedIn, async (req, res) => {
    const ip = req.params.ip;
    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("IP API fetch error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch IP details' });
    }
});

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

// API endpoint để nhận dữ liệu từ client (CẬP NHẬT)
router.post('/log', async (req, res) => {
    const { shortId, fingerprint } = req.body;
    if (!shortId || !fingerprint) {
        return res.status(400).json({ status: 'error', message: 'Missing data' });
    }
    
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const link = await Link.findOne({ where: { shortId } });
        if (!link) {
            return res.status(404).json({ status: 'error', message: 'Link not found' });
        }
        
        let finalFingerprintId;
        const existingVisit = await Visit.findOne({
            where: { fingerprint: fingerprint },
            include: [{
                model: Link,
                where: { userDiscordId: link.userDiscordId }
            }]
        });

        if (existingVisit) {
            finalFingerprintId = existingVisit.fingerprintId;
        } else {
            finalFingerprintId = nanoid(10);
        }

        // Dùng transaction để đảm bảo cả hai hành động (tạo visit và cập nhật link) đều thành công
        await sequelize.transaction(async (t) => {
            await Visit.create({
                ipAddress: ipAddress.split(',')[0].trim(),
                fingerprint: fingerprint,
                fingerprintId: finalFingerprintId,
                userAgent: req.headers['user-agent'],
                linkShortId: shortId
            }, { transaction: t });
    
            // CẬP NHẬT: Cập nhật thời gian truy cập cuối cùng cho link
            link.lastVisitedAt = new Date();
            await link.save({ transaction: t });
        });
        
        res.json({ status: 'success' });
    } catch (error) {
        console.error("Logging error:", error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

module.exports = router;
