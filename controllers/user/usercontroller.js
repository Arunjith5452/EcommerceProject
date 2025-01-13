const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");
const { json } = require("express");
const mongoose = require("mongoose")
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");





const pageNotFound = async (req, res) => {

    try {

        res.render("page-404")

    } catch (error) {

        res.redirect("/pageNotFound")

    }

}

const loadSignup = async (req, res) => {
    try {

        return res.render('signup')

    } catch (error) {

        console.log('home page not loading:', error);
        res.status(500).send('Server Error')
    }
}

const loadHomepage = async (req, res) => {
    try {

        const user = req.session.user;
        const categories = await Category.find({isListed:true});
        let productData = await Product.find(
            {isBlocked:false,
            category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
        })
        productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData = productData.slice(0,4);
        if (user) {
            const userData = await User.findOne({ _id: user })


            if (userData.isBlocked) {
                req.session.destroy((err) => {
                    if (err) {
                        return res.status(500).send('Error in logging out');
                    }
                    res.redirect('/login');
                });
                return;
            }
            
            res.render("home", { user: userData ,products:productData })

        } else {
            return res.render("home",{products:productData});
        }

    } catch (error) {

        console.log("Home page not found");
        res.status(500).send("Server error")

    }
}


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        })

        return info.accepted.length > 0

    } catch (error) {

        console.error("Error sending email", error)
        return false

    }
}



const signup = async (req, res) => {
    try {

        const { username, mobile, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render("signup", { message: "Password do not match" })
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User already exists" })
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = { username, mobile, email, password };

        res.render("verify-otp");
        console.log("OTP Sent", otp);

    } catch (error) {

        console.error("signup error", error);
        res.redirect("/pageNotFound")

    }
}

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10)

        return passwordHash;

    } catch (error) {

    }
}

const verifyOtp = async (req, res) => {
    try {

        const { otp } = req.body;
        console.log(otp);

        if (otp == req.session.userOtp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)

            const saveUserData = new User({
                username: user.username,
                email: user.email,
                mobile: user.mobile,
                password: passwordHash
            })

            await saveUserData.save();

            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl: "/" })
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP,Please try again" })
        }

    } catch (error) {

        console.error("Error Verifying OTP", error)
        res.status(500).json({ success: false, message: "An error occured" })
    }
}


async function resendVerificationEmail(email, otp) {

    console.log("the otp verification goining on");

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text:` Your otp is: ${otp}`,
            html: `<b>Your otp: ${otp}</b>`,
        });

        return info.accepted && info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

const resendotp = async (req, res) => {
    console.log("Resend otp is working, sending the request");

    try {
        const { email } = req.session.userData;
        console.log("eamil is here in resednotp ", email)
        if (!email) {
            return res.status(500).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();

        console.log("resend otp created:", otp);

        req.session.userOtp = otp;

        const emailSent = await resendVerificationEmail(email, otp);
        console.log("the email sented successfully", emailSent)
        if (emailSent) {
            console.log("Resend otp :", otp);
            res.status(200).json({ success: true, message: "OTP Resent successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
    } catch (error) {
        console.log("Error sending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error. Please try again." });
}
};

const loadLogin = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.render('login')
        } {
            res.redirect('/')
        }

    } catch (error) {

        res.redirect('/pageNotFound')

    }
}

const login = async (req, res) => {
    try {

        const { email, password } = req.body;

        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render('login', { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render('login', { message: "User is blocked by admin" })
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render('login', { message: "Incorrect Password" })
        }

        req.session.user = findUser._id;
        res.redirect("/")

    } catch (error) {

        console.error("login error", error)
        res.render("login", { message: "login failed. Please try again later" })

    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error", err.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect('/login')
        })
    } catch (error) {

        console.log("Logout error", error)
        res.redirect("/pageNotFound")

    }
}

const loadShoppingPage = async (req,res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
        const categoryIds = categories.map((category)=>category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page-1)*limit;
        const products = await Product.find({
            isBlocked:false,
            category:{$in:categoryIds},
            quantity:{$gt:0},

        }).sort({createdOn:-1}).skip(skip).limit(limit);
        const totalProducts = await Product.countDocuments({
            isBlocked:false,
            category:{$in:categoryIds,},
            quantity:{$gt:0}
        }) 

        const totalPages = Math.ceil(totalProducts/limit);
        const categoriesWithIds = categories.map(category=>({_id:category._id,name:category.name}));


        return res.render("shop",{
            user:userData,
            products:products,
            category:categoriesWithIds,
            totalProducts:totalProducts,
            currentPage:page,
            totalPages:totalPages
        })
    } catch (error) {
        return res.redirect("/pageNotFound")
    }
}

const filterProduct = async (req,res) => {
    try {
        
        const user = req.session.user;
        const category = req.query.category;
        const findCategory = category ? await Category.findOne({_id:category}) : null;

        const query = {
            isBlocked:false,
            quantity:{$gt:0}
        }

        if(findCategory){
            query.category = findCategory._id;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

        const categories = await Category.find({isListed:true});

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage-1) * itemsPerPage;
        let endIndex = startIndex+itemsPerPage;
        let totalPages = Math.ceil(findProducts.length/itemsPerPage);
        const currentProduct = findProducts.slice(startIndex,endIndex)
        let userData = null;
        if(user){
            userData = await User.findOne({_id:user});
            if(userData){
                const searchEntry = {
                    category : findCategory ? findCategory._id : null,
                    searchedOn : new Date(),
                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }
           req.session.filteredProducts = currentProduct;
           return res.render("shop",{
            user: userData,
            products:currentProduct,
            category:categories,
            totalPages,
            currentPage,
            selectedCategory:category || null
           })

    } catch (error) {
        return res.redirect("/pageNotFound");
    }
}


const filterByPrice = async (req,res) => {
    try {
        
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        const categories = await Category.findOne({isListed:true}).lean();

        let findProducts = await Product.find({
            salePrice:{$gt:req.query.gt,$lt:req.query.lt},
            isBlocked:false,
            quantity:{$gt:0}
        }).lean();

        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage-1)*itemsPerPage
        let endIndex = startIndex+ itemsPerPage;
        let totalPages = Math.ceil(findProducts.length/itemsPerPage);
        const currentProduct = findProducts.slice(startIndex,endIndex);
        req.session.filteredProducts = findProducts ;
        return res.render("shop",{
            user:userData,
            products:currentProduct,
            category: categories,
            totalPages ,
            currentPage,
        })

    } catch (error) {
        
        console.log(error);
        return res.redirect("/pageNotFound")

    }
}

const searchProducts = async (req,res) => {
    try {
        
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        let search = req.body.query;

        const categories = await Category.find({isListed:true}).lean();
        const categoryIds = categories.map(category=>category._id.toString());
        let searchResult = [];

        if(req.session.filteredProducts && req.session.filteredProducts.length>0){
            searchResult = req.session.filteredProducts.filter(product=>product.productName.toLowerCase().includes(search.toLowerCase()))
        }else{
            searchResult = await Product.find({
                productName:{$regex:".*"+search+".*",$options:"i"},
                isBlocked:false,
                quantity:{$gt:0},
                category:{$in:categoryIds}
            })
        }

        searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page)|| 1;
        let startIndex = (currentPage-1)*itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length/itemsPerPage);
        const currentProduct = searchResult.slice(startIndex,endIndex)

        return res.render("shop",{
            user:userData,
            products :currentProduct,
            category : categories,
            totalPages,
            currentPage,
            count:searchResult.length
        })

    } catch (error) {
        console.log(error)
        return res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendVerificationEmail,
    resendotp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts

}