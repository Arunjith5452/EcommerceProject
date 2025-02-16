const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const razorpay = require("../../config/razorpay");
require('dotenv').config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const PDFDocument = require('pdfkit');
const fs = require('fs');

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
            console.log("Insufficient stock for one or more items in your cart.")
            return res.redirect('/cart?error=insufficient_stock');        }
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
                    Cart.updateOne(
                        { userId },
                        { $set: { items: [], bill: 0 } }
                    ),
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

        const actualDiscount = req.session.activeCoupon ? (req.session.couponDiscount || 0) : 0;
        const coupon = req.session.activeCoupon
            ? await Coupon.findOne({ name: req.session.activeCoupon })
            : null;
        const couponMinPrice = coupon ? coupon.minimumPrice || 0 : 0;

        if (paymentMethod === 'WALLET') {
            const user = await User.findById(userId);
            if (user.wallet < finalAmount) {
                return res.status(200).json({
                    success: false,
                    message: `Your wallet balance is insufficient. You currently have ₹${user.wallet}. Please choose a different payment method.`
                });
            }
            
            

            const walletTransaction = {
                transactionId: `WAL${Date.now()}`,
                type: "debit",
                amount: finalAmount,
                status: "Completed"
            };

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
                paymentMethod: 'WALLET',
                address: selectedAddress,
                couponMinPrice,
                status: 'Pending',
                paymentStatus: 'Success',
                createdOn: new Date(),
                couponApplied: req.session.activeCoupon ? true : false
            };

            const order = await Order.create(orderData);

            await Promise.all([
                User.findByIdAndUpdate(userId, {
                    $inc: { wallet: -finalAmount },
                    $push: {
                        walletHistory: walletTransaction,
                        orderHistory: order._id
                    }
                }),
                ...cart.items.map(item =>
                    Product.updateOne(
                        { _id: item.productId._id, "sizeVariants.size": item.size },
                        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
                    )
                ),
                Cart.updateOne(
                    { userId },
                    { $set: { items: [], bill: 0 } }
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

        if (paymentMethod === 'COD') {
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
                couponMinPrice,
                status: 'Pending',
                paymentStatus: 'Success',
                createdOn: new Date(),
                couponApplied: req.session.activeCoupon ? true : false
            };

            const order = await Order.create(orderData);

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
                couponMinPrice,
                status: 'Pending',
                paymentStatus: 'Pending',
                createdOn: new Date(),
                couponApplied: req.session.activeCoupon ? true : false
            };

            const order = await Order.create(orderData);

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
        const razorpayOrder = await razorpay.orders.create(options);
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

const verifyRetryPayment = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_payment_id,
            razorpay_order_id
        } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            console.log("Order not found:", orderId);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (payment.status === "captured") {
            await Promise.all([
                Order.findByIdAndUpdate(orderId, {
                    paymentStatus: "Success",
                    status: "Pending",
                    paymentId: razorpay_payment_id
                }),
                ...order.orderedItems.map(item =>
                    Product.updateOne(
                        { _id: item.product, "sizeVariants.size": item.size },
                        { $inc: { "sizeVariants.$.quantity": -item.quantity } }
                    )
                )
            ]);

            return res.json({
                success: true,
                message: "Payment successful"
            });
        } else {
            try {
                await razorpay.payments.capture(razorpay_payment_id, payment.amount);

                await Promise.all([
                    Order.findByIdAndUpdate(orderId, {
                        paymentStatus: "Success",
                        status: "Pending",
                        paymentId: razorpay_payment_id
                    }),
                    ...order.orderedItems.map(item =>
                        Product.updateOne(
                            { _id: item.product, "sizeVariants.size": item.size },
                            { $inc: { "sizeVariants.$.quantity": -item.quantity } }
                        )
                    )
                ]);

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

const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;


        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage sizeVariants paymentStatus'
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
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findOne({ orderId })
            .populate({
                path: "orderedItems.product",
                select: "productName price"
            })
            .lean();

        if (!order) return res.status(404).send("Order not found");

        const userAddress = await Address.findOne({ 'address._id': order.address });
        if (!userAddress) return res.status(404).send("Address not found");

        const selectedAddress = userAddress.address.find(
            addr => addr._id.toString() === order.address.toString()
        );
        if (!selectedAddress) return res.status(404).send("Specific address not found");

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);
        doc.pipe(res);

        doc.fontSize(24)
            .text('FashionKart', 50, 50, { align: 'left' })
            .fontSize(10)
            .text('www.FashionKart.com', 50, 80, { align: 'left' })
            .text('supportFashionKart.com', 50, 95, { align: 'left' })
            .text('+1 (123) 456-7890', 50, 110, { align: 'left' });

        doc.fontSize(20)
            .text('INVOICE', 300, 50, { align: 'right', width: 250 })
            .fontSize(10)
            .text(`Invoice No: ${orderId}`, 300, 80, { align: 'right', width: 250 })
            .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 95, { align: 'right', width: 250 })
            .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 110, { align: 'right', width: 250 });

        doc.moveTo(50, 140)
            .lineTo(550, 140)
            .stroke();

        doc.fontSize(14)
            .text('Bill To:', 50, 170)
            .fontSize(10)
            .text(selectedAddress.name, 50, 190)
            .text(selectedAddress.addressLine1, 50, 205)
            .text(selectedAddress.addressLine2 || '', 50, 220)
            .text(`${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}`, 50, 235)
            .text(`Phone: ${selectedAddress.phone || 'N/A'}`, 50, 250);

        const tableTop = 300;
        const tableHeaders = {
            item: { x: 50, width: 250 },
            qty: { x: 300, width: 70 },
            price: { x: 370, width: 90 },
            amount: { x: 460, width: 90 }
        };

        doc.rect(50, tableTop - 10, 500, 25)
            .fill('#f6f6f6');

        doc.fillColor('black')
            .fontSize(10)
            .text('Item Description', tableHeaders.item.x, tableTop)
            .text('Qty', tableHeaders.qty.x, tableTop, { width: tableHeaders.qty.width, align: 'center' })
            .text('Unit Price', tableHeaders.price.x, tableTop, { width: tableHeaders.price.width, align: 'right' })
            .text('Amount', tableHeaders.amount.x, tableTop, { width: tableHeaders.amount.width, align: 'right' });

        let yPosition = tableTop + 30;
        let subtotal = 0;

        order.orderedItems.forEach((item) => {
            const amount = item.quantity * item.price;
            subtotal += amount;

            doc.text(item.product.productName, tableHeaders.item.x, yPosition, { width: tableHeaders.item.width })
                .text(item.quantity.toString(), tableHeaders.qty.x, yPosition, { width: tableHeaders.qty.width, align: 'center' })
                .text(`₹${item.price.toFixed(2)}`, tableHeaders.price.x, yPosition, { width: tableHeaders.price.width, align: 'right' })
                .text(`₹${amount.toFixed(2)}`, tableHeaders.amount.x, yPosition, { width: tableHeaders.amount.width, align: 'right' });

            yPosition += 25;
        });

        doc.moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .stroke();

        yPosition += 20;

        const summaryX = 370;
        const summaryWidth = 180;

        doc.text('Subtotal:', summaryX, yPosition, { width: 90, align: 'right' })
            .text(`₹${subtotal.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

        if (order.discount) {
            yPosition += 20;
            doc.text('Discount:', summaryX, yPosition, { width: 90, align: 'right' })
                .text(`-₹${order.discount.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });
        }

        yPosition += 25;
        doc.rect(summaryX - 10, yPosition - 5, summaryWidth, 25)
            .fill('#f6f6f6');

        doc.fillColor('black')
            .fontSize(12)
            .text('Total:', summaryX, yPosition, { width: 90, align: 'right' })
            .text(`₹${(order.finalAmount || subtotal).toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

        yPosition += 50;
        doc.fontSize(10)
            .text('Payment Information', 50, yPosition)
            .text(`Method: ${order.paymentMethod}`, 50, yPosition + 15)
            .text(`Status: ${order.paymentStatus || 'Pending'}`, 50, yPosition + 30);

        doc.fontSize(10)
            .text('Thank you for your business!', 50, doc.page.height - 100, { align: 'center' });

        doc.fontSize(8)
            .text('Terms & Conditions:', 50, doc.page.height - 80)
            .text('1. All prices are in INR and include GST where applicable.', 50, doc.page.height - 70)
            .text('2. This is a computer-generated invoice and requires no signature.', 50, doc.page.height - 60);
        doc.end();
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).send("Error generating invoice");
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
    downloadInvoice,
    applyCoupon
}