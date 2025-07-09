const router = require('express').Router();
const { nanoid } = require('nanoid');
const Key = require('../models/Key.model');
const User = require('../models/User.model');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Middleware kiểm tra đăng nhập
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// ---- CÁC TRANG (PAGES) ----

// 1. Trang quản lý Key chính
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const userKey = await Key.findOne({ where: { userDiscordId: req.user.discordId } });
        res.render('key', {
            title: "Quản lý Key",
            user: req.user,
            userKey: userKey,
            keyStatus: req.query.status // Để hiển thị thông báo (ví dụ: ?status=activated)
        });
    } catch (error) {
        console.error("Lỗi khi tải trang key:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// 2. Trang chờ 10s để lấy key
router.get('/get/token/:userId', isLoggedIn, (req, res) => {
    // Bảo mật: Đảm bảo user chỉ có thể lấy key cho chính mình
    if (req.params.userId !== req.user.discordId) {
        return res.status(403).send("Bạn không có quyền thực hiện hành động này.");
    }
    res.render('getKey', {
        title: "Đang tạo Key...",
        user: req.user,
    });
});

// 3. Trang hiển thị key (trang này sẽ được link4m rút gọn)
router.get('/show/:userId', async (req, res) => {
    try {
        const userKey = await Key.findOne({ where: { userDiscordId: req.params.userId } });
        if (!userKey) {
            return res.status(404).send("Không tìm thấy key hoặc key đã hết hạn. Vui lòng thử lại.");
        }
        res.render('showKey', {
            title: "Key của bạn",
            userKey: userKey,
        });
    } catch (error) {
        res.status(500).send("Lỗi Máy chủ");
    }
});

// ---- API & ACTIONS ----

// 4. API Backend: Tạo key, rút gọn link và trả về
router.post('/generate', isLoggedIn, async (req, res) => {
    try {
        // Xóa key cũ nếu có để tạo key mới
        await Key.destroy({ where: { userDiscordId: req.user.discordId } });
        
        // Tạo key mới có hạn 5 giờ
        const newKeyString = `GEMLOGIN-${nanoid(16).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now
        
        await Key.create({
            keyString: newKeyString,
            expiresAt: expiresAt,
            userDiscordId: req.user.discordId
        });

        // Tạo link đầy đủ đến trang hiển thị key
        const fullUrlToShowKey = `${req.protocol}://${req.get('host')}/key/show/${req.user.discordId}`;
        const encodedUrl = encodeURIComponent(fullUrlToShowKey);
        
        // API Token của Link4m (như trong tài liệu)
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

// 5. Kích hoạt key mà người dùng nhập vào
router.post('/activate', isLoggedIn, async (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.redirect('/key?status=error_missing');
    }

    try {
        const foundKey = await Key.findOne({ where: { keyString: key } });

        if (!foundKey) {
            return res.redirect('/key?status=error_notfound');
        }

        if (new Date() > new Date(foundKey.expiresAt)) {
            return res.redirect('/key?status=error_expired');
        }

        // Cập nhật key vào CSDL của User để kích hoạt
        foundKey.userDiscordId = req.user.discordId;
        await foundKey.save();
        
        res.redirect('/key?status=activated');
    } catch (error) {
        console.error("Lỗi khi kích hoạt key:", error);
        res.redirect('/key?status=error_server');
    }
});

// 6. Xóa/Hủy kích hoạt key
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
