const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const razorpay = require("../../config/razorpay");
const crypto = require("crypto");

const getCheckoutPage = async (req, res) => {
    try {

        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName sizeVariants'
        });

        const validCoupons = await Coupon.find({
            isList: true,
            expireOn: { $gt: new Date() },
            createdOn: { $lt: new Date() },
            userId: { $eq: [] }    
        })
        .sort({createdOn:-1})
        .select('name offerPrice minimumPrice');
        

        console.log("cart products", cart)

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        let isStockSufficient = true;
        const stockCheckDetails = cart.items.map((item) => {
            const productStock = item.productId.sizeVariants.find(
                (variant) => variant.size === item.size
            )?.quantity || 0;

            if (item.quantity > productStock) {
                isStockSufficient = false;
            }

            return {
                productName: item.productId.productName,
                size: item.size,
                quantityOrdered: item.quantity,
                stockAvailable: productStock,
                stockSufficient: item.quantity <= productStock
            };
        });

        console.log("Stock check details", stockCheckDetails);

        if (!isStockSufficient) {
            console.log("Insufficient stock for one or more items in your cart.")
            return res.status(400).json({success:false,message:"Insufficient stock for one or more items in your cart."});
        }

        console.log("Stock is sufficient for all items.");

        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0)

        const userAddress = await Address.findOne({ userId });


       return res.render('checkout', {
            cart,
            address: userAddress ? userAddress.address : [],
            user,
            subtotal,
            validCoupons
            // walletBalance:user.wallet || 0
        });



    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(500).render('error', { message: 'Error loading checkout page' })
    }
}

const addAddressCheckout = async (req,res) => {
    console.log("the add address hit here")
    try {
        
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            })
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        res.json({ success: true, message: 'Address added successfully!' });    } catch (error) {
        console.error("Error adding address:", error)
        return res.redirect("/pageNotFound")
    }
}

const applyCoupon = async (req,res) => {
    console.log("the is the copoun ready to work")
    try {
        
        const {couponCode , cartTotal , removeCoupon} = req.body;
        const userId = req.session.user
       

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in to apply coupons"
            });
        }

        let discount = 0;
        let finalAmount = cartTotal; 

        if(removeCoupon){

           if (req.session.activeCoupon) {
                await Coupon.updateOne(
                    { name: req.session.activeCoupon },
                    { $pull: { userId: userId } }
                );
                delete req.session.activeCoupon;
                delete req.session.couponDiscount;        
                }

            return res.status(200).json({
                success: true,
                discount: 0,
                finalAmount: cartTotal,
                message: "Coupon removed successfully"
            });
        }

        if (!couponCode) {
            return res.status(400).json({
                success: false,
                message: "Please provide a coupon code"
            });
        }

        const coupon = await Coupon.findOne({
            name: couponCode,
            isList: true,
            expireOn: { $gt: new Date() },
            createdOn: { $lt: new Date() },
           })

            console.log("Coupon details:", coupon);

            if (!coupon) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid coupon code or coupon has expired"
                });
            }

            if (coupon.userId.includes(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "You have already used this coupon"
                });
            }

            if (cartTotal < coupon.minimumPrice) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum purchase amount of ₹${coupon.minimumPrice} required`
                });
            }

            discount = coupon.offerPrice;
            finalAmount = cartTotal - discount;

            req.session.activeCoupon = couponCode;
            req.session.couponDiscount = discount;



            await Coupon.updateOne(
                { _id: coupon._id },
                { $push: { userId: userId } }
            );
        

        return res.status(200).json({
            success: true,
            discount,
            finalAmount,
            message:"Coupon applied successfully" 
        });

    } catch (error) {
        console.error("Error applying/removing coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const verifyPaymentAndCreateOrder = async (orderData, signature, secret) => {
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(orderData.razorpay_order_id + "|" + orderData.razorpay_payment_id)
    return hmac.digest("hex") === signature;
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, discount, finalAmount, paymentMethod } = req.body;
        const actualDiscount = req.session.activeCoupon ? (req.session.couponDiscount || 0) : 0;

        const [addressDoc, cart] = await Promise.all([
            Address.findOne({ userId, 'address._id': addressId }),
            Cart.findOne({ userId }).populate('items.productId')
        ])

        if (!addressDoc || !cart?.items.length) {
            return res.status(400).json({ 
                success: false, 
                message: !addressDoc ? 'Invalid address' : 'Cart is empty' 
            })
        }

        const selectedAddress = addressDoc.address.find(addr => 
            addr._id.toString() === addressId
        )

        const stockCheck = await Promise.all(cart.items.map(async (item) => {
            const variant = item.productId.sizeVariants.find(v => v.size === item.size);
            return {
                isValid: variant?.quantity >= item.quantity,
                product: item.productId.productName,
                size: item.size
            }
        }));

        const invalidStock = stockCheck.find(item => !item.isValid)
        if (invalidStock) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock for ${invalidStock.product} (${invalidStock.size})`
            });
        }

        if (paymentMethod === "RAZORPAY") {
            if (!req.body.paymentConfirmed) {
                const options = {
                    amount: finalAmount * 100,
                    currency: "INR",
                    receipt: `order_rcptid_${Date.now()}`,
                    payment_capture: 1
                }
                const razorpayOrder = await razorpay.orders.create(options);
                return res.json({ success: true, order: razorpayOrder });
            }else{
            if (req.body.razorpay_payment_id) {
                const isValid = await verifyPaymentAndCreateOrder(
                    {
                        razorpay_order_id: req.body.razorpay_order_id,
                        razorpay_payment_id: req.body.razorpay_payment_id
                    },
                    req.body.razorpay_signature,
                    process.env.RAZORPAY_KEY_SECRET
                )

                if (!isValid) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Invalid payment signature" 
                    })
                }
            } else {
                return res.status(200).json({ 
                    success: true, 
                    order: razorpayOrder 
                })
            }
        }
    }

        await Promise.all(cart.items.map(item => 
            Product.updateOne(
                { _id: item.productId._id, "sizeVariants.size": item.size },
                { $inc: { "sizeVariants.$.quantity": -item.quantity } }
            )
        ));

        const order = await Order.create({
            userId,
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                size: item.size
            })),
            totalPrice: cart.items.reduce((total, item) => total + item.totalPrice, 0),
            discount: actualDiscount,
            finalAmount,
            paymentMethod,
            address: selectedAddress,
            status: 'Pending',
            paymentId: req.body.razorpay_payment_id,
            createdOn: new Date()
        });

        await Promise.all([
            cart.updateOne({ items: [] }),
            User.findByIdAndUpdate(userId, { $push: { orderHistory: order._id } })
        ]);

        delete req.session.activeCoupon;
        delete req.session.couponDiscount;

        return res.status(200).json({
            success: true,
            orderId: order._id
        });

    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error creating order'
        });
    }
};
const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;


        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage sizeVariants' 
            })
            .lean();

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                user: userId
            });
        }

        const userAddress = await Address.findOne({
            userId: userId,
            'address._id': order.address
        });

        const selectedAddress = userAddress ? 
        userAddress.address.find(addr => addr._id.toString() === order.address.toString()) 
        : null;

        console.log('Found order:', order);



        const formattedOrder = {
            orderId: order.orderId,
            createdOn: order.createdOn,
            finalAmount: order.finalAmount,
            totalPrice: order.totalPrice,
            discount: order.discount,
            couponApplied: order.actualDiscount,
            orderedItems: order.orderedItems,
            address: selectedAddress,
            status: order.status,
            paymentMethod: order.paymentMethod
        };

        console.log('Formatted order for template:', JSON.stringify(formattedOrder, null, 2));

        return res.render('orderSuccess', {
            order: formattedOrder,
            user: await User.findById(userId)
        });

    } catch (error) {
        console.error('Error in order success:', error);
        return res.status(500).render('error', {
            message: 'Something went wrong',
        });
    }
};


module.exports = {
    getCheckoutPage,
    addAddressCheckout,
    placeOrder,
    getOrderSuccess,
    applyCoupon
}