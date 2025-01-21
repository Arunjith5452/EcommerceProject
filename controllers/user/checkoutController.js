const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema')

const getCheckoutPage = async (req,res) => {
    try {       

        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

    const cart = await Cart.findOne({userId}).populate('items.productId');

    if(!cart || cart.items.length===0){
        return res.redirect('/cart');
    }

    const subtotal = cart.items.reduce((total,item)=>total + item.totalPrice,0)

    const userAddress = await Address.findOne({userId});

   

    res.render('checkout',{
        cart,
        address:userAddress ? userAddress.address : [],
        user,
        subtotal,
        // walletBalance:user.wallet || 0
    });



    } catch (error) {
        console.error('Checkout page error:', error);
            res.status(500).render('error', { message: 'Error loading checkout page' })
    }
}

const placeOrder = async (req,res) => {
    try {

        const userId = req.session.user;
        const {addressId} = req.body;

        const cart = await Cart.findOne({userId}).populate('items.productId')

        if(!cart || cart.items.length === 0){
            throw new Error('Cart is empty');
        }

        const user = await User.findById(userId);

        const subtotal = cart.items.reduce((total,item)=>total +item.totalPrice,0);
    
        

        const order = new Order({
            userId,
            orderedItems:cart.items.map(item=>({
                product:item.productId,
                quantity:item.quantity,
                price:item.price
            })),
            totalPrice:subtotal,
            finalAmount:subtotal,
            address:addressId,
            status:'Pending',
            createdOn: new Date()
        })
          console.log("order",order)
        await order.save();

        user.orderHistory.push(order._id);
        await user.save();

        cart.items = [];
        await cart.save();
     
        res.json({
            success: true,
            orderId: order._id
        });

    } catch (error) {
        console.log("error",error)
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

const getOrderSuccess = async(req,res) => {
    try {
        
        res.render('orderSuccess')

    } catch (error) {
    
    }
}

module.exports={
    getCheckoutPage,
    placeOrder,
    getOrderSuccess
}