const router = require('express').Router();
const { nanoid } = require('nanoid');
const sequelize = require('../config/database');
const Link = require('../models/Link.model');
const Visit = require('../models/Visit.model');
const Key = require('../models/Key.model');
const { Op } = require('sequelize');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// --- MIDDLEWARES ---

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

async function isKeyActive(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }
    try {
        const activeKey = await Key.findOne({ where: { userDiscordId: req.user.discordId }});

        // Kiểm tra xem key có tồn tại và còn hạn không
        if (activeKey && new Date() < new Date(activeKey.expiresAt)) {
            // Gắn thông tin key vào request để sử dụng ở các nơi khác nếu cần
            req.user.hasActiveKey = true;
            return next();
        } else {
            // Nếu là request đến một trang, chuyển hướng về trang yêu cầu key
            if (req.method === 'GET') {
                return res.redirect('/key?status=error_required');
            }
            // Nếu là request hành động (POST), trả về lỗi
            return res.status(403).json({ success: false, message: "Hành động yêu cầu Key đã kích hoạt." });
        }
    } catch(error) {
        console.error("Lỗi middleware isKeyActive:", error);
        return res.status(500).send("Lỗi máy chủ khi xác thực key.");
    }
}

// --- CÁC TRANG CHÍNH (PAGES) ---

// Trang chủ / Đăng nhập
router.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'IP Tracker | Đăng nhập' });
});

// Trang bảng điều khiển
router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const activeKey = await Key.findOne({ where: { userDiscordId: req.user.discordId }});
        const hasActiveKey = !!(activeKey && new Date() < new Date(activeKey.expiresAt));

        const userLinks = await Link.findAll({
            where: { userDiscordId: req.user.discordId },
            include: [{ model: Visit, order: [['timestamp', 'DESC']] }],
            order: [['createdAt', 'DESC']],
        });
        res.render('dashboard', {
            title: 'IP Tracker | Bảng điều khiển',
            user: req.user,
            links: userLinks,
            baseUrl: `${req.protocol}://${req.get('host')}`,
            hasActiveKey: hasActiveKey // Truyền trạng thái key ra view
        });
    } catch (error) {
        console.error("Lỗi khi tải bảng điều khiển:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// Trang chi tiết một lượt truy cập (BẢO VỆ BỞI KEY)
router.get('/details/:visitId', isLoggedIn, isKeyActive, async (req, res) => {
    try {
        const { visitId } = req.params;
        const visit = await Visit.findOne({
            where: { id: visitId },
            include: {
                model: Link,
                where: { userDiscordId: req.user.discordId },
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
        console.error("Lỗi khi tải chi tiết lượt truy cập:", error);
        res.status(500).send('Lỗi Máy chủ');
    }
});


// --- CÁC HÀNH ĐỘNG (ACTIONS) ---

// Tạo liên kết mới (BẢO VỆ BỞI KEY)
router.post('/create-link', isLoggedIn, isKeyActive, async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl || !(targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        return res.status(400).send('URL đích không hợp lệ.');
    }
    try {
        await Link.create({
            shortId: nanoid(7),
            targetUrl,
            userDiscordId: req.user.discordId
        });
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Lỗi khi tạo liên kết:", error);
        res.status(500).send('Không thể tạo liên kết');
    }
});

// Xóa một liên kết (KHÔNG cần key)
router.post('/delete-link/:shortId', isLoggedIn, async (req, res) => {
    try {
        const { shortId } = req.params;
        const link = await Link.findOne({
            where: {
                shortId: shortId,
                userDiscordId: req.user.discordId
            }
        });
        if (link) {
            await link.destroy();
            res.redirect('/dashboard');
        } else {
            res.status(404).send("Không tìm thấy liên kết hoặc bạn không có quyền.");
        }
    } catch (error) {
        console.error("Lỗi khi xóa liên kết:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// Xóa một kết quả truy cập (KHÔNG cần key)
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
            res.json({ success: true, message: "Đã xóa kết quả." });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy kết quả hoặc không có quyền." });
        }
    } catch (error) {
        console.error("Lỗi khi xóa kết quả:", error);
        res.status(500).json({ success: false, message: "Lỗi Máy chủ" });
    }
});


// --- API & TRACKING ---

// API lấy chi tiết IP (BẢO VỆ BỞI KEY)
router.get('/ip-details/:ip', isLoggedIn, isKeyActive, async (req, res) => {
    const ip = req.params.ip;
    if (!ip) {
        return res.status(400).json({ error: 'Địa chỉ IP là bắt buộc' });
    }
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Lỗi gọi API IP:", error);
        res.status(500).json({ status: 'error', message: 'Không thể lấy chi tiết IP' });
    }
});

// Route tracking trung gian (Công khai, không cần key)
router.get('/t/:shortId', async (req, res) => {
    try {
        const link = await Link.findOne({ where: { shortId: req.params.shortId } });
        if (link) {
            res.render('track', { targetUrl: link.targetUrl, shortId: link.shortId });
        } else {
            res.status(404).send('Không tìm thấy liên kết');
        }
    } catch (error) {
        res.status(500).send('Lỗi Máy chủ');
    }
});

// Endpoint nhận log từ client (Công khai, không cần key)
router.post('/log', async (req, res) => {
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
            include: [{ model: Link, where: { userDiscordId: link.userDiscordId } }]
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
                fingerprintComponents: components,
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

module.exports = router;
