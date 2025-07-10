// Đường dẫn file: middleware/captcha.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const verifyCaptcha = async (req, res, next) => {
    try {
        const captchaToken = req.body['h-captcha-response'];
        
        // 1. Kiểm tra xem token có được gửi lên không
        if (!captchaToken) {
            console.warn('Cảnh báo: Form gửi lên thiếu h-captcha-response.');
            // Hiển thị thông báo trên trang key, vì đây là trang người dùng sẽ thấy
            if (req.originalUrl.includes('/key/generate')) {
                 return res.status(400).json({ success: false, message: "Captcha không hợp lệ. Vui lòng tải lại trang và thử lại." });
            }
            return res.redirect('/dashboard?status=captcha_error'); // Hoặc trang nào phù hợp
        }
        
        // 2. Chuẩn bị dữ liệu để gửi đến hCaptcha
        const params = new URLSearchParams();
        params.append('response', captchaToken);
        params.append('secret', process.env.HCAPTCHA_SECRET_KEY);
        // params.append('remoteip', req.ip); // Tùy chọn: Gửi IP người dùng để tăng cường bảo mật

        // 3. Gửi request xác thực
        const hcaptchaResponse = await fetch('https://api.hcaptcha.com/siteverify', {
            method: 'POST',
            body: params,
        });

        const data = await hcaptchaResponse.json();

        // 4. Xử lý kết quả
        if (data.success) {
            // Xác thực thành công, cho phép đi tiếp
            return next();
        } else {
            console.error('Lỗi xác thực hCaptcha:', data['error-codes']);
            if (req.originalUrl.includes('/key/generate')) {
                return res.status(400).json({ success: false, message: "Xác thực Captcha thất bại." });
            }
            return res.redirect('/dashboard?status=captcha_error');
        }

    } catch (error) {
        console.error('Lỗi hệ thống khi xác thực captcha:', error);
        return res.status(500).send("Lỗi máy chủ khi xác thực captcha.");
    }
};

module.exports = { verifyCaptcha };
