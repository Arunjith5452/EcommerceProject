const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const razorpay = require("../../config/razorpay");
require('dotenv').config();
const crypto = require("crypto");
const mongoose = require("mongoose")

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
            .sort({ createdOn: -1 })
            .select('name offerPrice minimumPrice');


        ("cart products", cart)

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

        ("Stock check details", stockCheckDetails);

        if (!isStockSufficient) {
            ("Insufficient stock for one or more items in your cart.")
            return res.status(400).json({ success: false, message: "Insufficient stock for one or more items in your cart." });
        }

        ("Stock is sufficient for all items.");

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

const addAddressCheckout = async (req, res) => {
    ("the add address hit here")
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
        res.json({ success: true, message: 'Address added successfully!' });
    } catch (error) {
        console.error("Error adding address:", error)
        return res.redirect("/pageNotFound")
    }
}

const editAddressCheckout = async (req, res) => {
    try {
        const addressId = req.params.id;
        const data = req.body;
        const userId = req.session.user;

        const findAddress = await Address.findOne({
            userId,
            "address._id": addressId
        });

        if (!findAddress) {
            return res.status(404).json({
                success: false,
                message: "Address not found"
            });
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        pincode: data.pincode,
                        state: data.state,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    }
                }
            }
        );

        res.json({
            success: true,
            message: "Address updated successfully"
        });

    } catch (error) {
        console.error("Error in edit address:", error);
        res.status(500).json({
            success: false,
            message: "Error updating address"
        });
    }
};


const applyCoupon = async (req, res) => {
    ("the is the copoun ready to work")
    try {

        const { couponCode, cartTotal, removeCoupon } = req.body;
        const userId = req.session.user


        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please log in to apply coupons"
            });
        }

        let discount = 0;
        let finalAmount = cartTotal;

        if (removeCoupon) {

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

            ("Coupon details:", coupon);

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
            message: "Coupon applied successfully"
        });

    } catch (error) {
        console.error("Error applying/removing coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            addressId,
            finalAmount,
            paymentMethod,
            paymentConfirmed,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId,
            failureReason,
        } = req.body;

        console.log("Place Order Request:", req.body);

        if (orderId) {
            const existingOrder = await Order.findById(orderId);
            if (!existingOrder) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }
            if (!paymentConfirmed && req.body.paymentStatus === 'Failed') {
                await Promise.all([
                    Order.findByIdAndUpdate(orderId, {
                        paymentStatus: "Failed",
                        status: "Pending",
                        paymentFailureReason: failureReason || "Payment failed"
                    }),

                    User.findByIdAndUpdate(
                        existingOrder.userId,
                        { $addToSet: { orderHistory: orderId } }
                    )
                ]);

                return res.json({
                    success: true,
                    message: "Order status updated to failed",
                    order: { _id: orderId }
                });
            }

            if (paymentConfirmed) {
                try {
                    const isValid = await verifyRazorpayPayment(
                        { razorpay_order_id, razorpay_payment_id },
                        razorpay_signature
                    );

                    if (!isValid) {
                        throw new Error("Payment signature verification failed");
                    }

                    await Promise.all([
                        Order.findByIdAndUpdate(orderId, {
                            paymentStatus: "Success",
                            status: "Pending",
                            paymentId: razorpay_payment_id
                        }),

                        Cart.updateOne(
                            { userId },
                            { $set: { items: [], bill: 0 } }
                        ),

                        User.findByIdAndUpdate(
                            existingOrder.userId,
                            { $addToSet: { orderHistory: orderId } }

                        ),

                        ...existingOrder.orderedItems.map(item =>
                            Product.updateOne(
                                { _id: item.product, "sizeVariants.size": item.size },
                                { $inc: { "sizeVariants.$.quantity": -item.quantity } }
                            )
                        )
                    ]);

                    req.session.activeCoupon = null;
                    req.session.couponDiscount = null;

                    return res.json({
                        success: true,
                        message: "Payment successful",
                        order: { _id: orderId }
                    });

                } catch (error) {
                    console.error("Payment verification error:", error);
                    await Order.findByIdAndUpdate(orderId, {
                        paymentStatus: "Failed",
                        status: "Cancelled",
                        paymentFailureReason: error.message
                    });

                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
            }
        }

        const [addressDoc, cart] = await Promise.all([
            Address.findOne({ userId, 'address._id': addressId }),
            Cart.findOne({ userId }).populate('items.productId')
        ]);

        if (!addressDoc || !cart?.items.length) {
            return res.status(400).json({
                success: false,
                message: !addressDoc ? 'Invalid address' : 'Cart is empty'
            });
        }

        const selectedAddress = addressDoc.address.find(addr =>
            addr._id.toString() === addressId
        );

        const actualDiscount = req.session.activeCoupon ?
            (req.session.couponDiscount || 0) : 0;

        const orderData = {
            userId,
            orderId: `ORD${Date.now()}`,
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
            status: paymentMethod === 'COD' ? 'Processing' : 'Pending',
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
            createdOn: new Date()
        };

        const order = await Order.create(orderData);

        if (paymentMethod === 'COD') {
            await Promise.all([
                ...cart.items.map(item =>
                    Product.updateOne(
                        { _id: item.productId._id, "sizeVariants.size": item.size },
                        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
                    )
                ),
                Cart.updateOne(
                    { userId },
                    { $set: { items: [], bill: 0 } }
                ),
                User.findByIdAndUpdate(
                    userId,
                    { $push: { orderHistory: order._id } }
                )
            ]);

            req.session.activeCoupon = null;
            req.session.couponDiscount = null;

            return res.status(200).json({
                success: true,
                order: { _id: order._id },
                redirectUrl: `/orderSuccess/${order._id}`
            });
        }

        if (paymentMethod === "RAZORPAY") {
            try {
                const razorpayOrder = await razorpay.orders.create({
                    amount: finalAmount * 100,
                    currency: "INR",
                    receipt: order._id.toString(),
                    payment_capture: 1
                });

                await Order.findByIdAndUpdate(order._id, {
                    razorpayOrderId: razorpayOrder.id
                });

                return res.json({
                    success: true,
                    order: {
                        _id: order._id,
                        razorpay_order_id: razorpayOrder.id,
                        amount: finalAmount * 100,
                        currency: "INR",
                        status: "created"
                    }
                });
            } catch (error) {
                console.error("Razorpay order creation error:", error);
                await Order.findByIdAndDelete(order._id);
                return res.status(500).json({
                    success: false,
                    message: 'Error creating Razorpay order'
                });
            }
        }

    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error creating order'
        });
    }
};

const verifyRazorpayPayment = async (orderData, signature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
        throw new Error('Razorpay secret key is not configured');
    }

    try {
        const hmac = crypto.createHmac("sha256", secret.trim());
        const data = orderData.razorpay_order_id + "|" + orderData.razorpay_payment_id;
        hmac.update(data);
        const generated_signature = hmac.digest("hex");

        return generated_signature === signature;
    } catch (error) {
        console.error('Signature verification error:', error);
        throw error;
    }
};


const initiateRetryPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const userId = req.session.user;

        console.log('Initiating retry payment for order:', orderId);

        const order = await Order.findOne({ _id: orderId, userId }).populate('userId').lean();

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.paymentStatus === 'Success') {
            return res.status(400).json({ success: false, message: 'Payment already completed' });
        }

        if (order.paymentRetryCount >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Maximum payment retry attempts exceeded'
            });
        }

        const shortOrderId = orderId.slice(-8);
        const timestamp = Date.now().toString().slice(-8);
        const receipt = `r_${shortOrderId}_${timestamp}`;

        const options = {
            amount: amount * 100, 
            currency: "INR",
            receipt: receipt, 
            payment_capture: 1,
            notes: {
                order_id: orderId
            }
        };

        console.log('Creating Razorpay order with options:', options);

        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay order created:', razorpayOrder);

        await Order.updateOne(
            { _id: orderId },
            {
                $inc: { paymentRetryCount: 1 },
                $set: {
                    paymentStatus: 'Success',
                    status: 'Pending',
                    razorpay_order_id: razorpayOrder.id
                }
            }
        );

        const customerDetails = {
            customerName: order.userId?.name || '',
            customerEmail: order.userId?.email || ''
        };

        return res.json({
            success: true,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            orderId: razorpayOrder.id,
            originalOrderId: orderId,
            ...customerDetails
        });
    } catch (error) {
        console.error('Retry payment error:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.error?.description || error.message || 'Error initiating retry payment'
        });
    }
};
const paymentFailed = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }
        ("Received orderId in paymentFailed:", orderId);


        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.status = "Pending";
        order.paymentStatus = "Failed";
        order.paymentFailureReason = "User cancelled or payment failed";
        await order.save();

        return res.json({ success: true, message: "Order status updated to failed" });

    } catch (error) {
        console.error("Payment failure handling error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, reason } = req.body;
        ("Updating order status:", { orderId, status, reason });

        let order;
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            order = await Order.findById(orderId);
        }
        if (!order) {
            order = await Order.findOne({ orderId });
        }

        if (!order) {
            console.error("Order not found:", orderId);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.paymentStatus = status;
        if (status === "Failed") {
            order.paymentFailureReason = reason || "Failed";
            order.status = "Pending";
        }

        await order.save();

        ("Order status updated successfully");
        return res.json({
            success: true,
            message: "Order status updated successfully"
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating order status"
        });
    }
};


const verifyRetryPayment = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_payment_id,
            razorpay_order_id
        } = req.body;

        console.log("Verifying retry payment:", {
            orderId,
            razorpay_payment_id,
            razorpay_order_id
        });

        const order = await Order.findById(orderId);
        if (!order) {
            console.log("Order not found:", orderId);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        console.log("Payment details fetched:", payment);

        if (payment.status === "captured") {
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: "Success",
                status: "Pending",
                paymentId: razorpay_payment_id
            });

            return res.json({
                success: true,
                message: "Payment successful"
            });
        } else {
            try {
                await razorpay.payments.capture(razorpay_payment_id, payment.amount);

                await Order.findByIdAndUpdate(orderId, {
                    paymentStatus: "Success",
                    status: "Pending",
                    paymentId: razorpay_payment_id
                });

                return res.json({
                    success: true,
                    message: "Payment captured successfully"
                });
            } catch (captureError) {
                console.error("Payment capture failed:", captureError);
                throw new Error("Payment capture failed");
            }
        }
    } catch (error) {
        console.error("Retry payment verification error:", error);
        if (req.body.orderId) {
            await Order.findByIdAndUpdate(req.body.orderId, {
                paymentStatus: "Failed",
                paymentFailureReason: error.message || "Payment processing failed"
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Payment processing failed"
        });
    }
};

const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const paymentStatus = req.query.status || "success";
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

        ('Found order:', order);



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
            paymentMethod: order.paymentMethod,
            paymentStatus
        };

        ('Formatted order for template:', JSON.stringify(formattedOrder, null, 2));

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
    editAddressCheckout,
    paymentFailed,
    placeOrder,
    initiateRetryPayment,
    updateOrderStatus,
    verifyRetryPayment,
    getOrderSuccess,
    applyCoupon
}