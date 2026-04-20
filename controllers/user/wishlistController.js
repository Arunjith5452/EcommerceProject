const User = require("../../models/userSchema")
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");




const loadWishlist = async (req,res) => {
    try {
        const userId = req.session.user;
        
        const wishlist = await Wishlist.findOne({ userId: userId })
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'productName productImage salePrice category sizeVariants isBlocked',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            })

        const user = await User.findById(userId);

        if (!wishlist || wishlist.products.length === 0) {
            return res.render("wishlist", {
                user: user,
                wishlist: [],
                products: []
            })
        }

        const originalProductCount = wishlist.products.length;
        wishlist.products = wishlist.products.filter(item => 
            item.productId && !item.productId.isBlocked
        );

        if (wishlist.products.length !== originalProductCount) {
            await wishlist.save();
        }

        const products = wishlist.products.map(item => item.productId);
        
        return res.render("wishlist", {
            user: user,
            wishlist: wishlist.products,
            products: products
        })
      
    } catch (error) {
        console.error("Error in loadWishlist:", error)
        return res.redirect("/pageNotFound")               
    }
}
const addToWishlist = async (req,res) => {
    try {

        const productId = req.body.productId;
        const userId = req.session.user;


        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ 
                status: false, 
                message: 'Product not found' 
            });
        }

        let wishlist = await Wishlist.findOne({userId:userId});

        if(!wishlist) {
            wishlist = new Wishlist({userId:userId,products:[]});
        }

        if(wishlist.products.some(item => item.productId.toString() === productId)) {
            return res.status(200).json({success:false,message:'Product already in wishlist'});
        }
        wishlist.products.push({productId:productId});
        await wishlist.save();

        return res.status(200).json({success:true,message:'Product added to wishlist'})

    } catch (error) {
       
        console.error("Error on adding wishlist",error);
        return res.status(500).json({success:false,message:'Internal Server Error'})
        
    }
}


const removeProduct = async (req,res)=> {
    try {

        const productId = req.query.productId;
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({userId:userId});

        if(!wishlist){
            return res.status(404).json({status:false,message:"Wishlist not found"})
        }

        const index = wishlist.products.findIndex(item => item.productId.toString() === productId);
        
        if(index > -1){
            wishlist.products.splice(index,1);
            await wishlist.save();
        }
       
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.json({ status: true, message: "Product removed from wishlist" });
        }
        return res.redirect("/wishlist");
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({status:false,message:"Internal Server Error"})
    }
}


module.exports = {
    loadWishlist,
    addToWishlist,
    removeProduct
}