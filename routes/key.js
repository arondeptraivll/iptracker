const router = require('express').Router();
const { nanoid } = require('nanoid');
const Key = require('../models/Key.model');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Middleware kiểm tra đã đăng nhập chưa
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// --- CÁC TRANG (PAGES) ---

// Trang quản lý Key chính
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const userKey = await Key.findOne({ where: { userDiscordId: req.user.discordId } });
        res.render('key', {
            title: "Quản lý Key",
            user: req.user,
            userKey: userKey,
            keyStatus: req.query.status // Để hiển thị thông báo
        });
    } catch (error) {
        console.error("Lỗi khi tải trang key:", error);
        res.status(500).send("Lỗi Máy chủ");
    }
});

// Trang chờ 10s để lấy key
router.get('/get/token/:userId', isLoggedIn, (req, res) => {
    // Bảo mật: Đảm bảo user chỉ có thể lấy key cho chính mình
    if (req.params.userId !== req.user.discordId) {
        return res.status(403).send("Hành động không hợp lệ.");
    }
    res.render('getKey', {
        title: "Đang tạo Key...",
        user: req.user,
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

// --- API & ACTIONS ---

// API Backend: Tạo key mới, rút gọn link và trả về cho client
router.post('/generate', isLoggedIn, async (req, res) => {
    try {
        // Xóa key cũ của chính user này nếu có để tạo key mới
        await Key.destroy({ where: { userDiscordId: req.user.discordId } });
        
        // Tạo key mới có hạn 5 giờ
        const newKeyString = `GEMLOGIN-${nanoid(16).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // Hạn 5 giờ
        
        await Key.create({
            keyString: newKeyString,
            expiresAt: expiresAt,
            userDiscordId: req.user.discordId
        });

        // Tạo link đầy đủ đến trang hiển thị key (an toàn hơn khi thêm keyString vào URL)
        const fullUrlToShowKey = `${req.protocol}://${req.get('host')}/key/show/${req.user.discordId}/${newKeyString}`;
        const encodedUrl = encodeURIComponent(fullUrlToShowKey);
        
        // API Token của Link4m
        const link4mApiToken = '66f90f6a40e0233fb72ede99'; // Đây là token ví dụ
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
    if (!keyString) {
        return res.redirect('/key?status=error_missing');
    }

    try {
        const foundKey = await Key.findOne({ where: { keyString: keyString.trim() } });

        if (!foundKey) {
            return res.redirect('/key?status=error_notfound');
        }

        if (new Date() > new Date(foundKey.expiresAt)) {
            // Có thể thêm logic xóa key hết hạn ở đây luôn
            await foundKey.destroy();
            return res.redirect('/key?status=error_expired');
        }

        // Kiểm tra xem key này có đang được ai dùng không. Nếu không, kích hoạt.
        if (foundKey.userDiscordId !== req.user.discordId) {
            // Đây là logic cho phép key được "pass" cho người khác.
            // Nếu bạn muốn chỉ người tạo mới được dùng thì phải check ngay từ đầu.
            // Hiện tại, ai có key hợp lệ đều có thể kích hoạt.
        }

        // Xóa key cũ của user hiện tại (nếu có)
        await Key.destroy({ where: { userDiscordId: req.user.discordId, id: { [require('sequelize').Op.ne]: foundKey.id } } });
        
        // Gán key này cho người dùng hiện tại
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
