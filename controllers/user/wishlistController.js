const User = require("../../models/userSchema")
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");




const loadWishlist = async (req,res) => {
    try {
        
        const userId = req.session.user;
        
        const wishlist = await Wishlist.findOne({userId:userId})
        .populate({
            path: 'products.productId', 
            model: 'Product',
            select: 'productName productImage salePrice category',
            populate: {
                path: 'category',  
                model: 'Category'  
            } 
        })
        if(!wishlist){
            return res.render("wishlist",{
                user: await User.findById(userId),
                wishlist:[]
            })
        }
        
        return res.render("wishlist",{
            user:await User.findById(userId),
            wishlist : wishlist.products,
        })
      

    } catch (error) {
        
        console.error(error)
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
            return res.status(200).json({status:false,message:'Product already in wishlist'});
        }
        wishlist.products.push({productId:productId});
        await wishlist.save();

        return res.status(200).json({status:true,message:'Product added to wishlist'})

    } catch (error) {
       
        console.error("Error on adding wishlist",error);
        return res.status(500).json({status:false,message:'Internal Server Error'})
        
    }
}


const removeProduct = async (req,res)=> {
    try {

        const productId = req.query.productId;
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({userId:userId})

        if(!wishlist){
            return res.status(404).json({status:false,message:"Wishlist not found"})
        }

        const index = wishlist.products.findIndex(item => item.productId.toString()===productId)
        if(index > -1){
            wishlist.products.splice(index,1)
            await wishlist.save();
        }
       
        return res.redirect("/wishlist")
        
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