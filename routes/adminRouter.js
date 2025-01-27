const express = require('express');
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController")
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const bannerController = require("../controllers/admin/bannerController");
const couponController = require("../controllers/admin/couponController");

const { adminAuth } = require("../middlewares/auth")
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });

router.get("/pageerror", adminController.pageerror);

router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login)
router.get("/", adminAuth, adminController.loadDashboard)
router.get("/logout", adminController.logout)

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/UnblockCustomer", adminAuth, customerController.customerunBlocked);

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
router.get("/blockProduct", adminAuth, productController.blockProduct)
router.get("/unblockProduct", adminAuth, productController.unblockProduct)
router.get("/editProduct", adminAuth, productController.getEditProduct)
router.post("/editProduct/:id", adminAuth, uploads.array('images', 4), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage)
router.delete("/deleteProduct", adminAuth, productController.deleteProduct)

router.get("/orderList", adminAuth, orderController.orderList)
router.patch('/updateOrderStatus/:orderId', adminAuth, orderController.updateOrderStatus);
router.get('/userOrderDetails/:orderId', adminAuth, orderController.getOrderDetails);
router.patch('/userOrderCancel/:orderId', adminAuth, orderController.cancelSingleItem);
router.patch('/handleReturnRequest/:orderId',adminAuth , orderController.handleReturnRequest)

router.get("/banner", adminAuth, bannerController.getBannerPage)
router.get("/addBanner", adminAuth, bannerController.getAddBannerPage)
router.post("/addBanner", adminAuth, uploads.single("images"), bannerController.addBanner)

router.get("/coupon", adminAuth, couponController.loadCoupon);
router.post("/createCoupon", adminAuth, couponController.createCoupon)
router.get("/editCoupon", adminAuth, couponController.editCoupon)
router.post("/updateCoupon", adminAuth, couponController.updateCoupon)
module.exports = router;                                                                       