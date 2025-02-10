const express = require('express');
const router = express.Router();
const { userAuth } = require("../middlewares/auth")

const userController = require("../controllers/user/usercontroller");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController");
const wishlistController = require("../controllers/user/wishlistController")
const cartController = require("../controllers/user/cartController");
const authController = require('../controllers/user/authController');
const checkoutController = require("../controllers/user/checkoutController");
const passport = require('passport');

router.get("/pageNotFound", userController.pageNotFound);

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post('/resendotp', userController.resendotp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  authController.googleCallback
);

router.get('/login', userController.loadLogin);
router.post('/login', userController.login);
router.get('/logout', userController.logout);


router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);
router.get("/userProfile", userAuth, profileController.userProfile);
router.get("/change-email", userAuth, profileController.changeEmail)
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);
router.get("/update-email", userAuth, profileController.getUpdateEmailPage);
router.post("/update-email", userAuth, profileController.updateEmail)
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid)
router.post("/verify-changePassword-otp", userAuth, profileController.verifyChangePassOtp);
router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, profileController.deleteAddress);
router.get("/orderDetails/:orderId", userAuth, profileController.viewOrderDetails);
router.post("/cancelSingleProduct/:orderId", userAuth, profileController.cancelSingleProduct);
router.post("/requestProductReturn/:orderId",userAuth ,profileController.productReturn)

router.get("/addAddress", userAuth, profileController.addAddress)
router.post("/addAddress", userAuth, profileController.postAddAddress);

router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userAuth, userController.filterProduct);
router.get("/filterPrice", userAuth, userController.filterByPrice);
router.get('/search', userAuth, userController.searchProducts);
router.post('/search', userAuth, userController.searchProducts);

router.get("/productDetails/:id", productController.productDetails);

router.get("/wishlist", userAuth, wishlistController.loadWishlist);
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist);
router.get("/removeFromWishlist", userAuth, wishlistController.removeProduct);

router.get("/cart", userAuth, cartController.loadCart);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/updateQuantity/:cartItemId", userAuth, cartController.updateCartQuantity);
router.delete("/removeFromCart/:cartItemId", userAuth, cartController.removeFromCart);

router.get("/checkout", userAuth, checkoutController.getCheckoutPage);
router.post("/addAddress-checkout",userAuth,checkoutController.addAddressCheckout);
router.post('/editAddress-checkout/:id',userAuth,checkoutController.editAddressCheckout);
router.post("/applyCoupon",userAuth,checkoutController.applyCoupon);
router.post("/placeOrder", userAuth, checkoutController.placeOrder);
router.post("/payment-failed",userAuth,checkoutController.paymentFailed);
router.post("/updateOrderStatus", userAuth, checkoutController.updateOrderStatus);
router.post("/initiate-retry-payment",userAuth, checkoutController.initiateRetryPayment);
router.post('/verify-retry-payment',userAuth,checkoutController.verifyRetryPayment);
router.get('/orderSuccess/:orderId', userAuth, checkoutController.getOrderSuccess);
router.get('/download-invoice/:orderId', userAuth,checkoutController.downloadInvoice);




module.exports = router;