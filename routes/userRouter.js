const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/usercontroller");
const profileController = require("../controllers/user/profileController")
const passport = require('passport');

router.get("/pageNotFound", userController.pageNotFound);
// Sign up Management
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post('/resendotp',userController.resendotp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    res.redirect('/')
});


router.get('/login', userController.loadLogin)
router.post('/login', userController.login)

router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);





router.get('/logout', userController.logout)


module.exports = router;