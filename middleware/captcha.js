const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const verifyCaptcha = async (req, res, next) => {
    try {
        const captchaToken = req.body['h-captcha-response'];
        
        if (!captchaToken) {
            const referer = req.header('Referer') || '/dashboard';
            return res.redirect(`${referer}?status=captcha_missing`);
        }
        
        const params = new URLSearchParams();
        params.append('response', captchaToken);
        params.append('secret', process.env.HCAPTCHA_SECRET_KEY);

        const hcaptchaResponse = await fetch('https://api.hcaptcha.com/siteverify', {
            method: 'POST',
            body: params,
        });
        const data = await hcaptchaResponse.json();

        if (data.success) {
            return next();
        } else {
            console.error('Lỗi xác thực hCaptcha:', data['error-codes']);
            const referer = req.header('Referer') || '/dashboard';
            return res.redirect(`${referer}?status=captcha_error`);
        }
    } catch (error) {
        console.error('Lỗi hệ thống khi xác thực captcha:', error);
        return res.status(500).send("Lỗi máy chủ khi xác thực captcha.");
    }
};

module.exports = { verifyCaptcha };
