const router = require('express').Router();
const { nanoid } = require('nanoid');
const { Op } = require('sequelize');
const { Link, Visit, Key, sequelize } = require('../models');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { verifyCaptcha } = require('../middleware/captcha');

// --- MIDDLEWARES ---
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

async function isKeyActive(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        const activeKey = await Key.findOne({ where: { userDiscordId: req.user.discordId } });
        if (activeKey && new Date() < new Date(activeKey.expiresAt)) {
            req.user.hasActiveKey = true;
            return next();
        } else {
            if (req.method === 'GET') return res.redirect('/key?status=error_required');
            return res.status(403).json({ success: false, message: "Hành động yêu cầu Key đã kích hoạt." });
        }
    } catch (error) {
        console.error("Lỗi middleware isKeyActive:", error);
        return res.status(500).send("Lỗi máy chủ khi xác thực key.");
    }
}

// --- CÁC TRANG CHÍNH (PAGES) ---
router.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('index', {
        title: 'IP Tracker | Đăng nhập',
        HCAPTCHA_SITE_KEY: process.env.HCAPTCHA_SITE_KEY
    });
});

router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const activeKey = await Key.findOne({ where: { userDiscordId: req.user.discordId } });
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
            hasActiveKey: hasActiveKey,
            hcaptcha_site_key: process.env.HCAPTCHA_SITE_KEY,
            status: req.query.status
        });
    } catch (error) {
        console.error("Lỗi khi tải bảng điều khiển:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

router.get('/details/:visitId', isLoggedIn, isKeyActive, async (req, res) => {
    try {
        const { visitId } = req.params;
        const visit = await Visit.findOne({
            where: { id: visitId },
            include: { model: Link, where: { userDiscordId: req.user.discordId }, required: true }
        });
        if (!visit) return res.status(404).send('Không tìm thấy lượt truy cập hoặc bạn không có quyền.');
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


// --- CÁC ROUTE CÀI ĐẶT ---

router.get('/link/settings/:shortId', isLoggedIn, isKeyActive, async (req, res) => {
    try {
        const { shortId } = req.params;
        const link = await Link.findOne({
            where: { shortId, userDiscordId: req.user.discordId }
        });
        if (!link) {
            return res.status(404).render('message', {
                title: "Lỗi", message: "Không tìm thấy liên kết hoặc bạn không có quyền truy cập.", isError: true
            });
        }
        res.render('settings', {
            title: "Cài đặt Liên kết",
            user: req.user,
            link: link,
            hcaptcha_site_key: process.env.HCAPTCHA_SITE_KEY
        });
    } catch (error) {
        console.error("Lỗi khi tải trang cài đặt link:", error);
        res.status(500).send("Lỗi máy chủ.");
    }
});

router.post('/link/settings/:shortId', isLoggedIn, isKeyActive, verifyCaptcha, async (req, res) => {
    try {
        const { shortId } = req.params;
        const link = await Link.findOne({
            where: { shortId, userDiscordId: req.user.discordId }
        });
        if (!link) return res.status(404).send("Không tìm thấy liên kết.");
        
        link.blockForeignIPs = req.body.blockForeignIPs === 'on';
        link.requestGPS = req.body.requestGPS === 'on';
        
        await link.save();
        res.redirect('/dashboard?status=settings_saved');
    } catch (error) {
        console.error("Lỗi khi lưu cài đặt link:", error);
        res.status(500).send("Lỗi máy chủ.");
    }
});


// --- CÁC HÀNH ĐỘNG (ACTIONS) ---

router.post('/create-link', isLoggedIn, isKeyActive, verifyCaptcha, async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl || !(targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        return res.redirect('/dashboard?status=invalid_url');
    }
    try {
        await Link.create({ shortId: nanoid(7), targetUrl, userDiscordId: req.user.discordId });
        res.redirect('/dashboard?status=link_created');
    } catch (error) {
        console.error("Lỗi khi tạo liên kết:", error);
        res.status(500).send('Không thể tạo liên kết');
    }
});

router.post('/delete-link/:shortId', isLoggedIn, async (req, res) => {
    try {
        const { shortId } = req.params;
        const link = await Link.findOne({ where: { shortId, userDiscordId: req.user.discordId } });
        if (link) {
            await link.destroy();
            res.redirect('/dashboard?status=link_deleted');
        } else {
            res.redirect('/dashboard?status=link_notfound');
        }
    } catch (error) {
        console.error("Lỗi khi xóa liên kết:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

router.post('/delete-visit/:visitId', isLoggedIn, async (req, res) => {
    try {
        const { visitId } = req.params;
        const visit = await Visit.findOne({
            where: { id: visitId },
            include: { model: Link, where: { userDiscordId: req.user.discordId }, required: true }
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

router.get('/ip-details/:ip', isLoggedIn, isKeyActive, async (req, res) => {
    const ip = req.params.ip;
    if (!ip) return res.status(400).json({ error: 'Địa chỉ IP là bắt buộc' });
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Lỗi gọi API IP:", error);
        res.status(500).json({ status: 'error', message: 'Không thể lấy chi tiết IP' });
    }
});

router.get('/t/:shortId', async (req, res) => {
    try {
        const link = await Link.findOne({ where: { shortId: req.params.shortId } });
        if (!link) {
            return res.status(404).render('message', {
                title: 'Không tìm thấy', message: 'Liên kết này không tồn tại hoặc đã bị xóa.', isError: true
            });
        }
        
        if (link.blockForeignIPs) {
            const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
            const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,countryCode`);
            const geoData = await geoResponse.json();
            
            if (geoData.status !== 'success' || geoData.countryCode !== 'VN') {
                return res.status(403).render('message', {
                    title: 'Truy cập bị từ chối', message: 'Liên kết này chỉ dành cho người dùng tại Việt Nam.', isError: true
                });
            }
        }
        
        res.render('track', {
            targetUrl: link.targetUrl,
            shortId: link.shortId,
            requestGPS: link.requestGPS
        });
        
    } catch (error) {
        console.error("Lỗi route tracking:", error);
        return res.status(500).render('message', { title: 'Lỗi máy chủ', message: 'Đã có lỗi xảy ra.', isError: true });
    }
});

router.post('/log', async (req, res) => {
    const { shortId, fingerprint, components, latitude, longitude, accuracy } = req.body;
    if (!shortId || !fingerprint || !components) {
        return res.status(400).json({ status: 'error', message: 'Thiếu dữ liệu bắt buộc.' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    try {
        const link = await Link.findOne({ where: { shortId } });
        if (!link) return res.status(404).json({ status: 'error', message: 'Không tìm thấy liên kết' });
        
        let finalFingerprintId;
        const existingVisit = await Visit.findOne({ where: { fingerprint }, include: [{ model: Link, where: { userDiscordId: link.userDiscordId } }] });
        finalFingerprintId = existingVisit ? existingVisit.fingerprintId : nanoid(10);
        
        await sequelize.transaction(async (t) => {
            await Visit.create({
                ipAddress: ipAddress,
                fingerprint: fingerprint,
                fingerprintId: finalFingerprintId,
                userAgent: req.headers['user-agent'],
                fingerprintComponents: components,
                latitude: latitude || null,
                longitude: longitude || null,
                gpsAccuracy: accuracy || null,
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
