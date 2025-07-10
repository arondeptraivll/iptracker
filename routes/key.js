const router = require('express').Router();
const { nanoid } = require('nanoid');
const Key = require('../models/Key.model');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { verifyCaptcha } = require('../middleware/captcha');

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// Trang quản lý Key chính
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const userKey = await Key.findOne({ where: { userDiscordId: req.user.discordId } });
        res.render('key', {
            title: "Quản lý Key",
            user: req.user,
            userKey: userKey,
            keyStatus: req.query.status
        });
    } catch (error) {
        console.error("Lỗi khi tải trang key:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// Trang chờ 10s để lấy key
router.get('/get/token/:userId', isLoggedIn, (req, res) => {
    if (req.params.userId !== req.user.discordId) {
        return res.status(403).send("Hành động không hợp lệ.");
    }
    res.render('getKey', {
        title: "Đang tạo Key...",
        user: req.user,
        hcaptcha_site_key: process.env.HCAPTCHA_SITE_KEY
    });
});

// Trang hiển thị key (sau khi vượt link)
router.get('/show/:userId/:keyString', async (req, res) => {
    try {
        const userKey = await Key.findOne({ where: { userDiscordId: req.params.userId, keyString: req.params.keyString } });
        if (!userKey) {
            return res.status(404).send("Không tìm thấy key hoặc link không hợp lệ.");
        }
        res.render('showKey', {
            title: "Key của bạn",
            userKey: userKey,
        });
    } catch (error) {
        res.status(500).send("Lỗi Máy chủ");
    }
});


// API Backend: Tạo key mới, (BẢO VỆ BỞI CAPTCHA)
router.post('/generate', isLoggedIn, verifyCaptcha, async (req, res) => {
    try {
        await Key.destroy({ where: { userDiscordId: req.user.discordId } });
        
        const newKeyString = `GEMLOGIN-${nanoid(16).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
        
        await Key.create({ keyString: newKeyString, expiresAt, userDiscordId: req.user.discordId });

        const fullUrlToShowKey = `${req.protocol}://${req.get('host')}/key/show/${req.user.discordId}/${newKeyString}`;
        const encodedUrl = encodeURIComponent(fullUrlToShowKey);
        
        const link4mApiToken = '66f90f6a40e0233fb72ede99';
        const apiUrl = `https://link4m.co/api-shorten/v2?api=${link4mApiToken}&url=${encodedUrl}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === 'success') {
            res.json({ success: true, shortenedUrl: data.shortenedUrl });
        } else {
            throw new Error(data.message || "Không thể rút gọn link");
        }
    } catch (error) {
        console.error("Lỗi khi tạo key và rút gọn link:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Kích hoạt key mà người dùng nhập vào
router.post('/activate', isLoggedIn, async (req, res) => {
    const { keyString } = req.body;
    if (!keyString) return res.redirect('/key?status=error_missing');
    try {
        const foundKey = await Key.findOne({ where: { keyString: keyString.trim() } });
        if (!foundKey) return res.redirect('/key?status=error_notfound');
        if (new Date() > new Date(foundKey.expiresAt)) {
            await foundKey.destroy();
            return res.redirect('/key?status=error_expired');
        }
        await Key.destroy({ where: { userDiscordId: req.user.discordId, id: { [require('sequelize').Op.ne]: foundKey.id } } });
        foundKey.userDiscordId = req.user.discordId;
        await foundKey.save();
        res.redirect('/key?status=activated');
    } catch (error) {
        console.error("Lỗi khi kích hoạt key:", error);
        res.redirect('/key?status=error_server');
    }
});

// Xóa/Hủy kích hoạt key
router.post('/deactivate', isLoggedIn, async(req, res) => {
    try {
        await Key.destroy({ where: { userDiscordId: req.user.discordId }});
        res.redirect('/key?status=deactivated');
    } catch(error){
        console.error("Lỗi khi hủy key:", error);
        res.redirect('/key?status=error_server');
    }
});

module.exports = router;
