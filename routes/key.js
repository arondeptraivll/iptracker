const router = require('express').Router();
const { nanoid } = require('nanoid');
const { Op } = require('sequelize');
const { Key, sequelize } = require('../models');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { verifyCaptcha } = require('../middleware/captcha');

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// --- CÁC TRANG (PAGES) ---

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

router.get('/show/:activationToken', async (req, res) => {
    try {
        const unactivatedKey = await Key.findOne({
            where: {
                activationToken: req.params.activationToken,
                userDiscordId: null
            }
        });
        if (!unactivatedKey) {
            return res.status(404).render('message', {
                title: 'Lỗi',
                message: 'Link không hợp lệ hoặc key đã được người khác nhận.',
                isError: true
            });
        }
        res.render('showKey', {
            title: "Key của bạn",
            keyData: unactivatedKey
        });
    } catch (error) {
        res.status(500).send("Lỗi Máy chủ");
    }
});

// --- API & ACTIONS ---

router.post('/generate', isLoggedIn, verifyCaptcha, async (req, res) => {
    try {
        const newKeyString = `GEMLOGIN-${nanoid(16).toUpperCase()}`;
        const activationToken = nanoid(32);
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
        
        await Key.create({
            keyString: newKeyString,
            expiresAt,
            userDiscordId: null,
            activationToken
        });

        const fullUrlToShowKey = `${req.protocol}://${req.get('host')}/key/show/${activationToken}`;
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

router.post('/activate', isLoggedIn, async (req, res) => {
    const { keyString } = req.body;
    if (!keyString) return res.redirect('/key?status=error_missing');
    
    const t = await sequelize.transaction();
    try {
        const foundKey = await Key.findOne({
            where: { keyString: keyString.trim() },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (!foundKey) {
            await t.rollback();
            return res.redirect('/key?status=error_notfound');
        }

        if (new Date() > new Date(foundKey.expiresAt)) {
            await foundKey.destroy({ transaction: t });
            await t.commit();
            return res.redirect('/key?status=error_expired');
        }

        if (foundKey.userDiscordId === req.user.discordId) {
             await t.rollback();
             return res.redirect('/key?status=activated');
        }
        
        if (foundKey.userDiscordId !== null) {
            await t.rollback();
            return res.redirect('/key?status=error_taken');
        }
        
        await Key.destroy({
            where: { userDiscordId: req.user.discordId },
            transaction: t
        });
        
        foundKey.userDiscordId = req.user.discordId;
        foundKey.activationToken = null;
        await foundKey.save({ transaction: t });
        
        await t.commit();
        
        res.redirect('/key?status=activated');

    } catch (error) {
        await t.rollback();
        console.error("Lỗi khi kích hoạt key:", error);
        res.redirect('/key?status=error_server');
    }
});

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
