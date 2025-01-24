const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/adressSchema")


const orderList = async (req,res) => {
    try {
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 5
        const query = {};
        if (search) {
            query.$or = [
                { orderId: { $regex: new RegExp(search, 'i') } },  
                { 'order.address.name': { $regex: new RegExp(search, 'i') } },
                { 'order.address.email': { $regex: new RegExp(search, 'i') } }
            ];
        }
        console.log("Search query:", JSON.stringify(query, null, 2));

        const orderData = await Order.find(query)
        .populate('address')
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page -1)*limit)
        

        console.log("Fetched order data:", orderData);

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders/limit)

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
            orders:orderData,
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

const updateOrderStatus = async (req,res) => {
    try {
        
        const {orderId} =req.params;
        const {status} = req.body;

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderId },
            { status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, order: updatedOrder });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


const getOrderDetails = async (req, res) => {
    console.log("searching starts")
    try {
        const { orderId } = req.params;
        console.log("Received Order ID for Details:", orderId);


        const order = await Order.findOne({ orderId })
        .populate('address')
        .populate({
            path:'orderedItems.product',
            select:'productName price sizeVariants productImage'
        });
    
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

        const userAddress = await Address.findOne({
            userId: order.address._id
        })

        console.log("this is user address",userAddress)
        
        const orderData = {
            address: userAddress ? userAddress.address[0] : null,
            order:order
        }

        console.log("this is the ordered data",orderData)
       
        res.json(orderData);

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
// Remove the specific item
        order.orderedItems = order.orderedItems.filter(item => 
            item.product.toString() !== productId
        )
 // Recalculate total amount
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


module.exports = {
    orderList,
    updateOrderStatus,
    getOrderDetails,
    cancelSingleItem

}