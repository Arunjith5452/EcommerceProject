const express = require('express');
const router = express.Router();
const {userAuth} = require("../middlewares/auth")

const userController = require("../controllers/user/usercontroller");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController");
const wishlistController = require("../controllers/user/wishlistController")
const passport = require('passport');

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post('/resendotp',userController.resendotp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
   req.session.user = req.user._id;
   req.session.save((err)=>{
    if(err){
        console.log("session save error",err);
        return res.redirect('/signup');
    }
    res.redirect("/")
   })
});


router.get('/login', userController.loadLogin)
router.post('/login', userController.login)

router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);

router.get("/shop",userAuth,userController.loadShoppingPage);
router.get("/filter",userAuth,userController.filterProduct);
router.get("/filterPrice",userAuth,userController.filterByPrice);
router.post("/search",userAuth,userController.searchProducts)

router.get("/productDetails",userAuth,productController.productDetails);

router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct);

router.get('/logout', userController.logout)


module.exports = router;