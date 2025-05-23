const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");
const { json, query } = require("express");
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

        if (!req.session.user) {
            return res.render('signup')
        } {
            res.redirect('/')
        }

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
            category:{$in:categories.map(category=>category._id)}
        }).sort({createdAt:-1}).limit(4)

        let isNewUser = req.session.isNewUser || false; 

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
            
            res.render("home", { user: userData ,products:productData ,isNewUser})

        } else {
            return res.render("home",{products:productData,isNewUser});
        }

    } catch (error) {

        console.log("Home page not found");
        res.status(500).send("Server error")

    }
}

const removeNewuseFlag = async (req,res) => {
    try {
        req.session.isNewUser = false;
        res.sendStatus(200);
    } catch (error) {
        console.error("new user flag error",error)
        
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

function generateReferralCode() {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
}



const signup = async (req, res) => {
    try {

        const { username, mobile, email, password, confirmPassword, referralCode } = req.body

        if (password !== confirmPassword) {
            return res.render("signup", { message: "Password do not match" })
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User already exists" })
        }

        let referredByUser = null;
        if (referralCode && referralCode.trim() !== '') {
            referredByUser = await User.findOne({ referralCode: referralCode });
            if (!referredByUser) {
                return res.render("signup", { message: "Invalid referral code" });
            }
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = { username, mobile, email, password ,referredBy: referredByUser ? referredByUser.referralCode : null 
        }
        req.session.isNewUser = true
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

            const referralCode = generateReferralCode()

            const saveUserData = new User({
                username: user.username,
                email: user.email,
                mobile: user.mobile,
                password: passwordHash,
                referralCode: referralCode,
                referredBy: user.referredBy,
                wallet: user.referredBy ? 50 : 0 
            })

            await saveUserData.save();

            if(user.referredBy){
                const referrerUser  = await User.findOne({referralCode:user.referredBy})
                if(referrerUser){
                    referrerUser.referrals.push(saveUserData._id);
                    referrerUser.referralEarnings +=100
                    referrerUser.wallet +=100

                    referrerUser.walletHistory.push({
                        transactionId: 'REF' + Date.now(),
                        type: 'credit',
                        amount: 100,
                        status: 'Completed'
                    })

                    await referrerUser.save()
                }

            }

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
        }else {
            res.redirect('/')
        }

    } catch (error) {

        res.redirect('/pageNotFound')

    }
}

const login = async (req, res) => {
    try {


        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('login', { message: "Email and password are required" });
        }

        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render('login', { message: "Invalid email" })
        }
        if (findUser.isBlocked) {
            return res.render('login', { message: "User is blocked by admin" })
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render('login', { message: "Invalid Password" })
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
        delete req.session.user 
        return res.redirect('/login');
    } catch (error) {
        console.log("Logout error", error);
        res.redirect("/pageNotFound");
    }
};


const getFilteredProducts = async (req) => {
    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map(category => category._id.toString());

    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || 'default';

    req.session.sort = sort;

    const query = {
        isBlocked: false,
        sizeVariants: { $elemMatch: { quantity: { $gt: 0 } } }
    };

    if (req.query.category) {
        req.session.selectedCategory = req.query.category;
    }

    if (req.session.selectedCategory) {
        query.category = req.session.selectedCategory;
    } else {
        query.category = { $in: categoryIds };
    }

    if (req.body.query || req.session.searchQuery) {
        query.productName = { 
            $regex: new RegExp(req.body.query || req.session.searchQuery, "i") 
        };
    }

    if (req.session.priceFilter) {
        query.salePrice = {
            $gte: parseInt(req.session.priceFilter.gt),
            $lte: parseInt(req.session.priceFilter.lt)
        };
    }

    let sortOption = {};
    switch (sort) {
        case "low":
            sortOption = { salePrice: 1 };
            break;
        case "high":
            sortOption = { salePrice: -1 };
            break;
        case "az":
            sortOption = { productName: 1 };
            break;
        case "za":
            sortOption = { productName: -1 };
            break;
        default:
            sortOption = { createdAt: -1 };
    }

    const products = await Product.find(query)
        .collation({ locale: 'en', strength: 2 })
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('category')
        .lean();

        const updatedProducts = products.map((product) => {
            const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
            const productOffer = product.productOffer || 0;
            const totalOffer = categoryOffer + productOffer;
            
            return {
                ...product,
                totalOffer
            };
        });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products:updatedProducts,
        totalProducts,
        totalPages,
        currentPage: page,
        categories,
        sort,
    };
};

const loadShoppingPage = async (req, res) => {
    try {
        delete req.session.priceFilter;
        delete req.session.selectedCategory;
        delete req.session.searchQuery; 
        delete req.body.query;

        req.query.sort = req.query.sort || req.session.sort || 'default';

        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

  
        
        const {
            products,
            totalPages,
            totalProducts,
            currentPage,
            categories,
            sort,
        } = await getFilteredProducts(req);

        const updatedProducts = products.map((product) => {
            const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
            const productOffer = product.productOffer || 0;
            const totalOffer = categoryOffer + productOffer;
            
            return {
                ...product,
                totalOffer
            };
        });

        const categoriesWithIds = categories.map(category => ({
            _id: category._id,
            name: category.name
        }));


        return res.render("shop", {
            user: userData,
            products: updatedProducts, 
            category: categoriesWithIds,
            totalProducts,
            currentPage,
            totalPages,
            selectedSort: sort,
            searchQuery: null,
            priceRange: null,
            selectedCategory: req.session.selectedCategory || null,
        });
    } catch (error) {
        console.error(error);
        return res.redirect("/pageNotFound");
    }
}

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
       
        const { 
            products, 
            totalPages, 
            currentPage, 
            categories, 
            sort 
        } = await getFilteredProducts(req);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData && category) {
                userData.searchHistory.push({
                    category: category,
                    searchedOn: new Date()
                });
                await userData.save();
            }
        }

        return res.render("shop", {
            user: userData,
            products,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: req.session.selectedCategory || null,
            selectedSort: sort,
            priceRange: req.session.priceFilter || null,
            searchQuery: req.body.query || null  

        });
    } catch (error) {
        console.error(error);
        return res.redirect("/pageNotFound");
    }
}

const filterByPrice = async (req, res) => {
    try {
        req.session.priceFilter = {
            gt: parseInt(req.query.gt),
            lt: parseInt(req.query.lt)
        };

        const { 
            products, 
            totalPages, 
            currentPage, 
            categories, 
            sort 
        } = await getFilteredProducts(req);

        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        return res.render("shop", {
            user: userData,
            products,
            category: categories,
            totalPages,
            currentPage,
            selectedSort: sort,
            selectedCategory: req.session.selectedCategory || null,
            searchQuery: null,
            priceRange: { 
                gt: req.query.gt, 
                lt: req.query.lt 
            }
        });
    } catch (error) {
        console.error(error);
        return res.redirect("/pageNotFound");
    }
}

const searchProducts = async (req, res) => {
    try {
        req.session.searchQuery = req.body.query;
        req.query.sort = req.body.sort || req.query.sort || 'default';
        const { 
            products, 
            totalPages, 
            currentPage, 
            categories, 
            sort, 
            totalProducts 
        } = await getFilteredProducts(req);

        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        return res.render("shop", {
            user: userData,
            products,
            category: categories,
            totalPages,
            currentPage,
            selectedSort: sort,
            searchQuery: req.body.query ,
            count: totalProducts,
            selectedCategory: req.session.selectedCategory || null,
            priceRange: req.session.priceFilter || null
        });
    } catch (error) {
        console.error(error);
        return res.redirect("/pageNotFound");
    }
}
module.exports = {
    removeNewuseFlag,
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
    searchProducts,

}