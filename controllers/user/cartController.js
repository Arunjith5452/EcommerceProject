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

        cart.items = cart.items.filter(item => item.quantity > 0);
             if (cart.items.length !== cart.items.length) {
            await cart.save();
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
        const {productId , size , quantity =1 } = req.body
        const userId = req.session.user;
       
        console.log("Request body:", req.body);
        console.log("User ID:", userId);

        if (!userId) {
            return res.status(401).json({ status: false, message: "Please login to add items to cart" });
        }

        const product = await Product.findById(productId);
        console.log("Found product:", product)
        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        console.log("Product size variants:", product.sizeVariants);

        console.log("product",product.sizeVariants)

        console.log(size)

        if(product.sizeVariants && product.sizeVariants.length > 0 && !size){
            return res.status(404).json({error:'Please select a size'})
        }

        console.log("expect error is not working so you can see my message in console")

        const price = product.salePrice
        if (isNaN(price) || isNaN(quantity)) {
            return res.status(400).json({ status: false, message: "Invalid price or quantity" });

        }
        const totalPrice = price * quantity;

        let cart = await Cart.findOne({ userId: userId });
        console.log("Existing cart:", cart);

        if (!cart) {
            console.log("Creating new cart for user");

            cart = new Cart({ userId: userId, items: [] });
        }


        const itemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString() && 
            item.size === size)
                    console.log("Found item index:", itemIndex); 




        if (itemIndex > -1) {
            const newQuantity = cart.items[itemIndex].quantity+quantity;
            if(newQuantity>5){
                return res.status(400).json({status:false,message:"Maximum quantity allowed is 5 items"})
            }
            console.log("Updating existing item in cart");

            cart.items[itemIndex].quantity += quantity;
            cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * price;
        } else {

            if (quantity > 5) {
                return res.status(400).json({ 
                    status: false, 
                    message: "Maximum quantity allowed is 5 items"
                });
            }
            console.log("Adding new item to cart");

            const newItem ={
                productId: productId,
                size:size,
                quantity: quantity,
                price: price,
                totalPrice: totalPrice
            }

            if(size){
                newItem.size = size
            }
            console.log("New item to be added:", newItem);

            cart.items.push(newItem);

        }
        console.log("Cart before save:", JSON.stringify(cart, null, 2));

        console.log("Product Price:", price);
        console.log("Quantity:", quantity);
        console.log("Total Price:", totalPrice);


       const savedCart = await cart.save();
        console.log("Saved cart:", savedCart);

        return res.status(200).json({ status: true, message: "Product added to cart successfully" });


    } catch (error) {
        console.error("Error on adding cart", error);
        return res.status(500).json({ status: false, message: "Internal Server Error" })
    }
}

const updateCartQuantity = async (req,res) => {
    
    try {
        
        const {cartItemId} = req.params
        const {quantity} = req.body;
            
        const cart = await Cart.findOne({userId : req.session.user});

        if (quantity <= 0) {
            cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
            await cart.save();
            return res.json({ 
                status: true, 
                removed: true,
                message: 'Item removed from cart'
            });
        }

        if (quantity > 5) {
            return res.status(400).json({ 
                status: false, 
                message: 'Maximum quantity allowed is 5 items'
            });
        }

        const item = cart.items.find(item => item._id.toString() === cartItemId);
        if(item){
            item.quantity = quantity;
            item.totalPrice = item.price * quantity;
            await cart.save();
            return res.json({ status: true, newTotal: item.totalPrice });
        }
        return res.status(404).json({ status: false, message: 'Item not found in cart' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: 'Error updating cart' });
    }
}

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