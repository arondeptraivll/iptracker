const router = require('express').Router();
const { nanoid } = require('nanoid');
const sequelize = require('../config/database');
const Link = require('../models/Link.model');
const Visit = require('../models/Visit.model');
const { Op } = require('sequelize');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Middleware kiểm tra đăng nhập
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// ---- CÁC ROUTE CHÍNH ----

router.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('index', { title: 'IP Tracker | Đăng nhập' });
});

router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const userLinks = await Link.findAll({
            where: { userDiscordId: req.user.discordId },
            include: [{ model: Visit, order: [['timestamp', 'DESC']] }],
            order: [['createdAt', 'DESC']],
        });
        res.render('dashboard', {
            title: 'IP Tracker | Bảng điều khiển',
            user: req.user,
            links: userLinks,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// ---- ROUTE MỚI: TRANG CHI TIẾT LƯỢT TRUY CẬP ----
router.get('/details/:visitId', isLoggedIn, async (req, res) => {
    try {
        const { visitId } = req.params;
        const visit = await Visit.findOne({
            where: { id: visitId },
            include: {
                model: Link,
                where: { userDiscordId: req.user.discordId }, // Đảm bảo visit này thuộc về user đang đăng nhập
                required: true,
            }
        });

        if (!visit) {
            return res.status(404).send('Không tìm thấy lượt truy cập hoặc bạn không có quyền truy cập.');
        }

        res.render('details', {
            title: `Chi tiết Lượt truy cập - ${visit.ipAddress}`,
            visit: visit,
            user: req.user
        });
    } catch (error) {
        console.error("Error fetching visit details:", error);
        res.status(500).send('Lỗi Máy chủ');
    }
});


// API endpoint để nhận dữ liệu từ client (CẬP NHẬT)
router.post('/log', async (req, res) => {
    // ---- CẬP NHẬT: Nhận thêm 'components' ----
    const { shortId, fingerprint, components } = req.body;
    if (!shortId || !fingerprint || !components) {
        return res.status(400).json({ status: 'error', message: 'Thiếu dữ liệu' });
    }
    
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const link = await Link.findOne({ where: { shortId } });
        if (!link) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy liên kết' });
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

        await sequelize.transaction(async (t) => {
            await Visit.create({
                ipAddress: ipAddress.split(',')[0].trim(),
                fingerprint: fingerprint,
                fingerprintId: finalFingerprintId,
                userAgent: req.headers['user-agent'],
                fingerprintComponents: components, // ---- LƯU DỮ LIỆU JSONB MỚI ----
                linkShortId: shortId
            }, { transaction: t });
    
            link.lastVisitedAt = new Date();
            await link.save({ transaction: t });
        });
        
        res.json({ status: 'success' });
    } catch (error) {
        console.error("Lỗi khi ghi log:", error);
        res.status(500).json({ status: 'error', message: 'Lỗi Máy chủ' });
    }
});


// (Các route khác như create-link, delete-link, delete-visit, ip-details giữ nguyên...)
router.post('/create-link', isLoggedIn, async (req, res) => { /* ... */ });
router.post('/delete-link/:shortId', isLoggedIn, async (req, res) => { /* ... */ });
router.post('/delete-visit/:visitId', isLoggedIn, async (req, res) => { /* ... */ });
router.get('/ip-details/:ip', isLoggedIn, async (req, res) => { /* ... */ });
router.get('/t/:shortId', async (req, res) => { /* ... */ });


module.exports = router;
