const router = require('express').Router();
const passport = require('passport');

// Chuyển hướng đến Discord để xác thực
router.get('/discord', passport.authenticate('discord'));

// Route callback sau khi Discord xác thực thành công
router.get('/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/' // Thất bại thì quay lại trang chủ
}), (req, res) => {
    res.redirect('/dashboard'); // Thành công thì vào trang quản lý
});

// Đăng xuất
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy();
        res.redirect('/');
    });
});

module.exports = router;
