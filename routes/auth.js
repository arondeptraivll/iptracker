const router = require('express').Router();
const passport = require('passport');
const { User } = require('../models'); // SỬA Ở ĐÂY

// Route: /auth/discord
router.get('/discord', passport.authenticate('discord'));

// Route: /auth/discord/callback
router.get('/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

// Route: /auth/logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy();
        res.redirect('/');
    });
});

module.exports = router;
