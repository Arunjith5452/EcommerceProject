const User = require("../../models/userSchema");
const Product = require("../../models/productSchema")
const Cart = require("../../models/cartSchema");


const loadCart = async (req, res) => {
    try {

        const userId = req.session.user;

        const cart = await Cart.findOne({ userId: userId })
            .populate('items.productId', 'productName salePrice sizeVariants productImage');

        if (!cart) {
            return res.render("cart", {
                user: await User.findById(userId),
                cart: []
            })
        }  

        return res.render("cart", {
            user: await User.findById(userId),
            cart: cart.items
        })



    } catch (error) {
        console.log("Error loading cart:", error)
        return res.redirect("/pageNotFound")
    }
}

const addToCart = async (req, res) => {
    try {
        const {productId, size, quantity = 1} = req.body
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ status: false, message: "Please login to add items to cart" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        if (quantity > product.quantity) {
            return res.status(400).json({
                status: false,
                message: `Only ${product.quantity} items available in stock`
            });
        }

        if(product.sizeVariants && product.sizeVariants.length > 0 && !size){
            return res.status(404).json({error:'Please select a size'})
        }

        const price = product.salePrice
        if (isNaN(price) || isNaN(quantity)) {
            return res.status(400).json({ status: false, message: "Invalid price or quantity" });
        }
        
        const totalPrice = price * quantity;

        let cart = await Cart.findOne({ userId: userId });
        
        if (!cart) {
            cart = new Cart({ userId: userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString() && 
            item.size === size);

        if (itemIndex > -1) {
            const newQuantity = cart.items[itemIndex].quantity + quantity;
            
            if (newQuantity > product.quantity) {
                return res.status(400).json({
                    status: false,
                    message: `Only ${product.quantity} items available in stock`
                });
            }
            
            if(newQuantity > 5){
                return res.status(400).json({
                    status: false,
                    message: "Maximum quantity allowed is 5 items"
                });
            }

            cart.items[itemIndex].quantity += quantity;
            cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * price;
        } else {
            if (quantity > 5) {
                return res.status(400).json({ 
                    status: false, 
                    message: "Maximum quantity allowed is 5 items"
                });
            }

            const newItem = {
                productId: productId,
                size: size,
                quantity: quantity,
                price: price,
                totalPrice: totalPrice
            }

            cart.items.push(newItem);
        }

        await cart.save();
        return res.status(200).json({ status: true, message: "Product added to cart successfully" });

    } catch (error) {
        console.error("Error on adding cart", error);
        return res.status(500).json({ status: false, message: "Internal Server Error" })
    }
}
const updateCartQuantity = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const { quantity } = req.body;
            
        const cart = await Cart.findOne({ userId: req.session.user });
        const cartItem = cart.items.find(item => item._id.toString() === cartItemId);
        
        if (!cartItem) {
            return res.status(404).json({ 
                status: false, 
                message: 'Item not found in cart' 
            });
        }

        const product = await Product.findById(cartItem.productId);
        if (!product) {
            return res.status(404).json({ 
                status: false, 
                message: 'Product not found' 
            });
        }

        let availableStock = product.quantity;
        if (product.sizeVariants && product.sizeVariants.length > 0) {
            const sizeVariant = product.sizeVariants.find(v => v.size === cartItem.size);
            if (sizeVariant) {
                availableStock = sizeVariant.quantity;
            }
        }

        if (quantity > cartItem.quantity && quantity > availableStock) {
            return res.status(400).json({
                status: false,
                message: `Only ${availableStock} items available in stock for size ${cartItem.size}`
            });
        }

        if (quantity <= 0) {
            cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
            await cart.save();
            return res.json({ 
                status: true, 
                removed: true
            });
        }

        if (quantity > 5) {
            return res.status(400).json({ 
                status: false, 
                message: 'Maximum quantity allowed is 5 items' 
            });
        }

        cartItem.quantity = quantity;
        cartItem.totalPrice = cartItem.price * quantity;
        await cart.save();
        
        return res.json({ 
            status: true, 
            newTotal: cartItem.totalPrice 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            status: false, 
            message: 'Error updating cart' 
        });
    }
};

const removeFromCart = async (req,res) => {
    try {
        
        const {cartItemId} = req.params;
        const cart = await Cart.findOne({userId:req.session.user});

        cart.items = cart.items.filter(item=>item._id.toString() !== cartItemId);
        await cart.save();
        return res.json({status:true})

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: 'Error removing item from cart' });
    }
}

module.exports = {
    loadCart,
    addToCart,
    updateCartQuantity,
    removeFromCart
}