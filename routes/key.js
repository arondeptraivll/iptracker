const router = require('express').Router();
const { nanoid } = require('nanoid');
const Key = require('../models/Key.model');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { verifyCaptcha } = require('../middleware/captcha');
const { Op } = require('sequelize');

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// ---- CÁC TRANG (PAGES) ----

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
// Sửa lại để tìm bằng activationToken thay vì userId
router.get('/show/:activationToken', async (req, res) => {
    try {
        const unactivatedKey = await Key.findOne({
            where: {
                activationToken: req.params.activationToken,
                userDiscordId: null // Đảm bảo key này chưa được ai kích hoạt
            }
        });
        if (!unactivatedKey) {
            return res.status(404).render('message', {
                title: 'Lỗi',
                message: 'Link không hợp lệ hoặc key đã được nhận.',
                isError: true
            });
        }
        res.render('showKey', {
            title: "Key của bạn",
            keyData: unactivatedKey, // Đổi tên để rõ ràng hơn
        });
    } catch (error) {
        res.status(500).send("Lỗi Máy chủ");
    }
});

// ---- API & ACTIONS ----

// API Backend: Chỉ tạo key, không kích hoạt
router.post('/generate', isLoggedIn, verifyCaptcha, async (req, res) => {
    try {
        // TẠO LỖ HỔNG BẢO MẬT Ở ĐÂY BẰNG CÁCH GÁN userDiscordId NGAY LẬP TỨC
        // ---- FIX: CHÚNG TA KHÔNG GÁN userDiscordId NỮA ----

        const newKeyString = `GEMLOGIN-${nanoid(16).toUpperCase()}`;
        const activationToken = nanoid(32); // Token duy nhất cho link
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
        
        // Tạo key với userDiscordId = NULL và có activationToken
        await Key.create({
            keyString: newKeyString,
            expiresAt,
            userDiscordId: null,
            activationToken
        });

        // Tạo link đầy đủ đến trang hiển thị key với token kích hoạt
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


// Kích hoạt key mà người dùng nhập vào. ĐÂY LÀ NƠI GÁN KEY CHO USER
router.post('/activate', isLoggedIn, async (req, res) => {
    const { keyString } = req.body;
    if (!keyString) return res.redirect('/key?status=error_missing');
    
    const t = await sequelize.transaction(); // Bắt đầu một transaction
    try {
        const foundKey = await Key.findOne({
            where: { keyString: keyString.trim() },
            transaction: t
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

        // Kiểm tra xem key này có phải đã được chính người dùng này kích hoạt rồi không
        if (foundKey.userDiscordId === req.user.discordId) {
             await t.rollback();
             return res.redirect('/key?status=activated'); // Key đã được kích hoạt rồi, không cần làm gì thêm
        }
        
        // Kiểm tra xem key này đã bị người khác kích hoạt chưa
        if (foundKey.userDiscordId !== null) {
            await t.rollback();
            return res.redirect('/key?status=error_taken'); // Key đã có người khác sử dụng
        }
        
        // ---- Logic kích hoạt an toàn ----
        // 1. Xóa tất cả các key cũ khác mà user này có thể đang sở hữu
        await Key.destroy({
            where: {
                userDiscordId: req.user.discordId
            },
            transaction: t
        });
        
        // 2. Gán key này cho người dùng hiện tại và xóa token kích hoạt đi
        foundKey.userDiscordId = req.user.discordId;
        foundKey.activationToken = null; // Vô hiệu hóa link lấy key cũ
        await foundKey.save({ transaction: t });
        
        // Nếu mọi thứ thành công, commit transaction
        await t.commit();
        
        res.redirect('/key?status=activated');

    } catch (error) {
        // Nếu có bất kỳ lỗi nào, rollback tất cả các thay đổi
        await t.rollback();
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
