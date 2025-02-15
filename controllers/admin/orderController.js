const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/adressSchema")
const mongoose = require("mongoose")

const orderList = async (req,res) => {
    try {
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 5
        
        const query = search ? {
            $or: [
                { orderId: { $regex: new RegExp(search, 'i') } },
                { 'address.name': { $regex: new RegExp(search, 'i') } }
            ]
        } : {};
        const orders = await Order.find(query)
        .populate({
            path: 'orderedItems.product',
            select: 'productName productImage price'
        })
        
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

         console.log('Initial orders:', JSON.stringify(orders, null, 2));

        const ordersWithDetails = await Promise.all(orders.map(async (order) => {
            try {
                if (!order.address) {
                    return { ...order, address: null };
                }


                const addressDoc = await Address.findOne({
                    'address._id': order.address
                });

                if (!addressDoc) {
                    return { ...order, address: null };
                }

                const addressData = addressDoc.address.find(addr => 
                    addr._id.toString() === order.address.toString()
                );

                return {
                    ...order,
                    address: addressData
                };

            } catch (err) {
                console.error(`Error processing address for order ${order.orderId}:`, err);
                return {
                    ...order,
                    address: null
                };
            }
        }));


    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);


        const getStatusColor = (status)=> {
            const colors ={
                'Pending': 'pending',
                'Processing': 'processing',
                'Shipped': 'shipped',
                'Delivered': 'delivered',
                'Cancelled': 'cancelled',
                'Returned' : 'returned'
            }
            return colors[status] || 'secondary';
        }

        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };
        
        res.render("order",{
            orders:ordersWithDetails,
            currentPage:page,
            totalOrders:totalOrders,
            totalPages:totalPages,
            search,
            getStatusColor,
            formatDate

        })


    } catch (error) {
        console.error("Error fetching order info:", error);
        res.status(500).send("Internal Server Error");
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, productId } = req.body;

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        if (productId) {
            const orderItem = order.orderedItems.find(
                item => item.product.toString() === productId
            );

            if (!orderItem) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Product not found in order' 
                });
            }

            orderItem.status = status;
            
            const allItemsSameStatus = order.orderedItems.every(
                item => item.status === status
            );
            
            if (allItemsSameStatus) {
                order.status = status;
            }
        } else {
            order.status = status;
            order.orderedItems.forEach(item => {
                if (item.status !== 'Cancelled') {
                    item.status = status;
                }
            });
        }

        await order.save();
        res.json({ 
            success: true, 
            order,
            message: 'Status updated successfully' 
        });

    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;


        const order = await Order.findOne({ orderId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName price sizeVariants productImage'
            }).lean()
    
        console.log('Full Order Object:', JSON.stringify(order, null, 2));
        
            
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found',
                searchedId: orderId 
            });
        }
        if (!order.address) {
            return res.json({
                success: true,
                order: { ...order, address: null }
            });
        }

        const addressDoc = await Address.findOne({
            'address._id': order.address
        });

        if (!addressDoc) {
            return res.json({
                success: true,
                order: { ...order, address: null }
            });
        }

        const addressData = addressDoc.address.find(addr => 
            addr._id.toString() === order.address.toString()
        );

        const orderData = {
            ...order,
            address: addressData || null
        };

        res.json({ 
            success: true, 
            order: orderData 
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const cancelSingleItem = async (req,res) => {
    try {
        
        const {orderId} =  req.params;
        const {productId} = req.body;

        const order = await Order.findOne({orderId});

        if(!order){
            return res.status(404).json({success:false,message:'Order not found'});
        }
        order.orderedItems = order.orderedItems.filter(item => 
            item.product.toString() !== productId
        )
        order.finalAmount = order.orderedItems.reduce((total , item)=>
        total + (item.quantity * item.product.price),0
    )

    if(order.orderedItems.length === 0){
        order.status = 'Cancelled'
    }

    await order.save();

   return res.json({ success: true, order })

    } catch (error) {

        console.error("Error cancelling order item:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


const cancelSingleProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancelReason, productId } = req.body;
        console.log("From cancelsingleProduct cancel reason:", cancelReason)
        const userId = req.session.user;

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.originalTotalPrice) {
            order.originalTotalPrice = order.orderedItems.reduce((total, item) => 
                total + (item.price * item.quantity), 0);
            order.originalDiscount = order.discount || 0;
        }

        const item = order.orderedItems.find(item => 
            item.product._id.toString() === productId
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }

        const itemTotal = item.price * item.quantity;
        
        // Calculate remaining order total after removing this item
        const remainingItems = order.orderedItems.filter(orderItem => 
            orderItem.product._id.toString() !== productId &&
            orderItem.status !== 'Cancelled' &&
            orderItem.status !== 'Returned'
        );
        
        const remainingTotal = remainingItems.reduce((total, orderItem) => 
            total + (orderItem.price * orderItem.quantity), 0);

        // Check if remaining total meets coupon criteria
        const meetsMinimumAmount = remainingTotal >= (order.couponMinAmount || 0);
        
        let refundAmount;

        if (!meetsMinimumAmount && order.discount) {
            // If doesn't meet minimum, refund = product price - coupon discount
            refundAmount = itemTotal - order.discount;
            order.discount = 0; // Remove coupon from order
        } else {
            // If meets minimum, refund full product price, keep coupon
            refundAmount = itemTotal;
        }

        item.status = 'Cancelled';
        item.cancelReason = cancelReason;

        const allItemsCancelled = order.orderedItems.every(item => 
            item.status === 'Cancelled' || item.status === 'Returned'
        );
        
        if (allItemsCancelled) {
            order.status = 'Cancelled';
            order.finalAmount = 0;
        } else {
            order.finalAmount = remainingTotal - (meetsMinimumAmount ? order.discount : 0);
        }

        // Update product inventory
        await Product.updateOne(
            { 
                _id: item.product._id,
                "sizeVariants.size": item.size 
            },
            { 
                $inc: { "sizeVariants.$.quantity": item.quantity }
            }
        );

        let currentWalletBalance = 0;
        if (order.paymentMethod !== 'COD') {
            const user = await User.findById(userId);
            user.wallet += refundAmount;
            user.walletHistory.push({
                transactionId: `TXN${Date.now()}`,
                type: 'credit',
                amount: refundAmount,
                date: new Date(),
                description: !meetsMinimumAmount ? 
                    'Product refund with adjusted coupon amount' : 
                    'Product refund'
            });
            await user.save();
            currentWalletBalance = user.wallet;
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Product cancelled successfully',
            refundDetails: {
                itemPrice: itemTotal,
                refundAmount: refundAmount,
                meetsMinimumAmount: meetsMinimumAmount
            },
            orderTotals: {
                remainingTotal: remainingTotal,
                finalAmount: order.finalAmount
            },
            currentWalletBalance,
            redirectUrl: '/userProfile?tab=orders'
        });
    } catch (error) {
        console.error('Error in cancelSingleProduct:', error);
        return res.status(500).json({
            success: false, 
            message: 'An error occurred while canceling the product'
        });
    }
};

const handleReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action, productId } = req.body;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderItem = order.orderedItems.find(item => 
            item.product._id.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        const user = await User.findById(order.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (action === 'approve') {
            const itemTotal = orderItem.price * orderItem.quantity;
            
            const remainingItems = order.orderedItems.filter(item => 
                item.product._id.toString() !== productId &&
                item.status !== 'Cancelled' &&
                item.status !== 'Returned'
            );
            
            const remainingTotal = remainingItems.reduce((total, item) => 
                total + (item.price * item.quantity), 0);

            const meetsMinimumAmount = remainingTotal >= (order.couponMinPrice || 0);
            
            let refundAmount;

            if (!meetsMinimumAmount && order.discount) {
                refundAmount = itemTotal - order.discount;
                order.discount = 0; 
            } else {
                refundAmount = itemTotal;
            }

            user.wallet += refundAmount;
            user.walletHistory.push({
                transactionId: `REF-${Date.now()}`,
                type: 'credit',
                amount: refundAmount,
                date: new Date(),
                description: !meetsMinimumAmount ? 
                    'Return refund with adjusted coupon amount' : 
                    'Product return refund'
            });
            await user.save();

            orderItem.status = 'Returned';
            order.returnStatus = 'Approved';

            const allItemsReturned = order.orderedItems.every(
                item => item.status === 'Returned' || item.status === 'Cancelled'
            );

            if (allItemsReturned) {
                order.status = 'Returned';
                order.finalAmount = 0;
            } else {
                const hasOtherReturns = order.orderedItems.some(
                    item => item.status === 'Return Request'
                );
                order.status = hasOtherReturns ? 'Return Request' : 'Delivered';
                order.finalAmount = remainingTotal - (meetsMinimumAmount ? order.discount : 0);
            }
            await order.save();

            return res.json({
                success: true,
                message: 'Return request approved',
                refundDetails: {
                    itemPrice: itemTotal,
                    refundAmount: refundAmount,
                    meetsMinimumAmount: meetsMinimumAmount
                },
                orderTotals: {
                    remainingTotal: remainingTotal,
                    finalAmount: order.finalAmount
                },
                currentWalletBalance: user.wallet,
                order
            });
        } else if(action === 'reject') {
            orderItem.status = 'Delivered';
            order.returnStatus = 'Rejected';

            const hasOtherReturns = order.orderedItems.some(
                item => item.status === 'Return Request'
            );

            if (hasOtherReturns) {
                order.status = 'Return Request';
            } else {
                order.status = 'Delivered';
            }

            await order.save();

            return res.json({
                success: true,
                message: 'Return request rejected',
                order
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }
    } catch (error) {
        console.error("Error handling return request:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

module.exports = {
    orderList,
    updateOrderStatus,
    getOrderDetails,
    cancelSingleItem,
    handleReturnRequest

}