const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema")

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
            return res.status(400).send("Insufficient stock for one or more items in your cart.");
        }

        console.log("Stock is sufficient for all items.");

        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0)

        const userAddress = await Address.findOne({ userId });



        res.render('checkout', {
            cart,
            address: userAddress ? userAddress.address : [],
            user,
            subtotal,
            // walletBalance:user.wallet || 0
        });



    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(500).render('error', { message: 'Error loading checkout page' })
    }
}

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

        console.log('Received addressId:', addressId);
        console.log('User ID:', userId);


        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            throw new Error('Cart is empty');
        }


        let isStockSufficient = true;
        const stockCheckDetails = await Promise.all(cart.items.map(async (item) => {
            const product = item.productId;
            const productStock = product.sizeVariants.find(
                (variant) => variant.size === item.size
            )?.quantity || 0;

            if (item.quantity > productStock) {
                isStockSufficient = false;
            }

            return {
                productName: product.productName,
                size: item.size,
                quantityOrdered: item.quantity,
                stockAvailable: productStock,
                stockSufficient: item.quantity <= productStock
            };
        }));

        if (!isStockSufficient) {
            return res.status(400).json({
                success: false,
                message: 'Some items are no longer in stock'
            });
        }

        await Promise.all(cart.items.map(async(item)=>{
            const product = item.productId
      
        await Product.updateOne(
        {_id:product._id,"sizeVariants.size":item.size},
        {$inc:{"sizeVariants.$.quantity":-item.quantity}}
    )
}))

        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        const order = new Order({
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                size: item.size
            })),
            totalPrice: subtotal,
            finalAmount: subtotal,
            address: userId,
            status: 'Pending',
            createdOn: new Date(),
        });


        await order.save();

        const user = await User.findById(userId)
        user.orderHistory.push(order._id);
        await user.save();

        cart.items = [];
        await cart.save();

        res.json({
            success: true,
            orderId: order._id
        });

    } catch (error) {
        console.log("Order creation error:", error);
        res.status(500).json({
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
            .populate('address')
            .lean();

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                user: userId
            });
        }

        console.log('Found order:', order);

        const user = await User.findById(userId)

        const userAddress = await Address.findOne({
            userId: order.address
        });



        const formattedOrder = {
            orderId: order.orderId,
            createdOn: order.createdOn,
            finalAmount: order.finalAmount,
            totalPrice: order.totalPrice,
            discount: order.discount,
            orderedItems: order.orderedItems,
            address: userAddress ? userAddress.address[0] : null,
            status: order.status
        };

        console.log('Formatted order for template:', JSON.stringify(formattedOrder, null, 2));

        return res.render('orderSuccess', {
            order: formattedOrder,
            user: user
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
    placeOrder,
    getOrderSuccess
}