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
                    console.log(`No address ID found for order ${order.orderId}`);
                    return { ...order, address: null };
                }

                console.log(`Looking up address for order ${order.orderId} with address ID: ${order.address}`);

                const addressDoc = await Address.findOne({
                    'address._id': order.address
                });

                if (!addressDoc) {
                    console.log(`No address document found for address ID ${order.address}`);
                    return { ...order, address: null };
                }

                const addressData = addressDoc.address.find(addr => 
                    addr._id.toString() === order.address.toString()
                );

                if (!addressData) {
                    console.log(`No matching address found in document for address ID ${order.address}`);
                    return { ...order, address: null };
                }

                console.log(`Found address data:`, JSON.stringify(addressData, null, 2));

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

        console.log("formatDate data",formatDate)
        console.log("getStatusColor data",getStatusColor)

        
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
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (productId) {
            // Update status for a specific product
            const orderItem = order.orderedItems.find(
                item => item.product.toString() === productId
            );

            if (!orderItem) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Product not found in order' 
                });
            }

            // Only update if the item isn't already cancelled
            if (orderItem.status !== 'Cancelled') {
                orderItem.status = status;
            }

            // Check if all non-cancelled items have the same status
            const nonCancelledItems = order.orderedItems.filter(
                item => item.status !== 'Cancelled'
            );

            const allNonCancelledSameStatus = nonCancelledItems.every(
                item => item.status === status
            );

            if (allNonCancelledSameStatus) {
                // If all non-cancelled items have the same status, update order status
                order.status = status;
            } else {
                // If items have different statuses, mark as partially processed
                order.status = 'Partially Processed';
            }
        } else {
            // Bulk update for all non-cancelled items
            order.orderedItems.forEach(item => {
                if (item.status !== 'Cancelled') {
                    item.status = status;
                }
            });

            // Check if there are any non-cancelled items
            const hasNonCancelledItems = order.orderedItems.some(
                item => item.status !== 'Cancelled'
            );

            if (hasNonCancelledItems) {
                order.status = status;
            } else {
                // If all items are cancelled, keep order status as Cancelled
                order.status = 'Cancelled';
            }
        }

        await order.save();
        res.json({ success: true, order });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOrderDetails = async (req, res) => {
    console.log("searching starts")
    try {
        const { orderId } = req.params;
        console.log("Received Order ID for Details:", orderId);


        const order = await Order.findOne({ orderId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName price sizeVariants productImage'
            }).lean()
    
         console.log("This is the full order")
        console.log('Full Order Object:', JSON.stringify(order, null, 2));
        
            
        if (!order) {
            console.log(`No order found for ID: ${orderId}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found',
                searchedId: orderId 
            });
        }
        if (!order.address) {
            console.log(`No address ID found for order details ${orderId}`);
            return res.json({
                success: true,
                order: { ...order, address: null }
            });
        }

        const addressDoc = await Address.findOne({
            'address._id': order.address
        });

        if (!addressDoc) {
            console.log(`No address document found for order details ${orderId}`);
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

const handleReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action, productId } = req.body;

        console.log('Processing return request:', { orderId, action, productId });

        const order = await Order.findOne({ orderId });

        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderItem = order.orderedItems.find(item => 
            item.product._id.toString() === productId || 
            item.product.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        console.log('Found order item:', {
            productId: orderItem.product.toString(),
            currentStatus: orderItem.status,
            orderStatus: order.status
        });

        if (order.status !== 'Return Request') {
            return res.status(400).json({
                success: false,
                message: 'No return request to process for this order'
            });
        }

        if (action === 'approve') {
            orderItem.status = 'Returned';
            order.returnStatus = 'Approved';

            const allItemsReturned = order.orderedItems.every(
                item => item.status === 'Returned' || item.status === 'Cancelled'
            );

            if (allItemsReturned) {
                order.status = 'Returned';
            } else {
                const hasOtherReturns = order.orderedItems.some(
                    item => item.status === 'Return Request' || item.status === 'Delivered'
                );
                order.status = hasOtherReturns ? 'Partially Returned' : 'Returned';
            }

        } else if (action === 'reject') {
            orderItem.status = 'Delivered';
            order.returnStatus = 'Rejected';

            const hasOtherReturns = order.orderedItems.some(
                item => item.status === 'Return Request' && item.product.toString() !== productId
            );

            if (!hasOtherReturns) {
                order.status = 'Delivered';
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }

        console.log('Saving order with updated status:', {
            orderStatus: order.status,
            itemStatus: orderItem.status,
            returnStatus: order.returnStatus
        });

        await order.save();

        res.json({
            success: true,
            message: `Return request ${action}d successfully`,
            order
        });

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