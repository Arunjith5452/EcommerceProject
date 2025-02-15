const User = require("../../models/userSchema");
const Product = require("../../models/productSchema")
const Address = require("../../models/adressSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/userSchema");
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config();
const session = require("express-session");

function generateOtp() {

    const digits = "1234567890"
    let otp = ""
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP:${otp}</h4><br></b>`
        }
        const info = await transporter.sendMail(mailOptions);

        return true

    } catch (error) {
        console.error("error sending email", error);
        return false
    }
}

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;

    } catch (error) {

    }
}


const getForgotPassPage = async (req, res) => {
    try {

        res.render("forgot-password");

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid = async (req, res) => {
    try {

        const { email } = req.body;
        const findUser = await User.findOne({ email: email })
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP:", otp)
            } else {
                return res.json({ success: false, message: "Failed to send otp. Please try again" });
            }
        } else {
            return res.render("forgot-password", { message: "User with this email does not exist" });
        }

    } catch (error) {
        return res.redirect("/pageNotFound")
    }
}


const verifyForgotPassOtp = async (req, res) => {
    try {

        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "An error occured. Please try again" })
    }
}


const getResetPassPage = async (req, res) => {
    try {

        return res.render("reset-password")

    } catch (error) {

        return res.redirect("/pageNotFound")
    }
}


const resendOtp = async (req, res) => {
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            return res.status(200).json({ success: true, message: "Resend otp successful" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }

    } catch (error) {

        console.error("Error in resend otp", error)
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

const postNewPassword = async (req, res) => {
    try {

        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email }, { $set: { password: passwordHash } }
            )
            return res.redirect("/login")
        } else {
            return res.render("reset-password", { message: 'Passwords do not match' });
        }

    } catch (error) {
        return res.redirect("/PageNotFound")
    }
}

const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId)
        .populate('walletHistory')
        .populate('referrals','username createdAt')

        if (userData.walletHistory && userData.walletHistory.length > 0) {
            userData.walletHistory.sort((a, b) => b.date - a.date)
        }

        if (!userData.referralCode) {
            userData.referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
            await userData.save();
        }

        const addressData = await Address.findOne({ userId: userId });

        const orders = await Order.find({
            _id: { $in: userData.orderHistory }
        })
        .sort({createdOn: -1})
        .populate('orderedItems.product', 'productName')

        
        res.render('profile', {
            user: userData,
            userAddress: addressData,
            orders: orders
        });

    } catch (error) {
        console.error("Error for retrieve profile data", error);
        return res.redirect("/pageNotFound");
    }
}

const updateProfile = async (req, res) => {
    console.log('hello update profile')
    try {
        const userId = req.session.user
        console.log('userId:',userId)
        const { username, mobile } = req.body
        
  
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, mobile },
            { new: true }
        )
  
        
  
        if (!updatedUser) {
            return res.status(200).json({
                success: false,
                message: 'User not found'
            });
        }
  
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
  });
  }
  }
const changeEmail = async (req, res) => {
    try {

        return res.render("change-email")

    } catch (error) {

        return res.redirect("/pageNotFound")
    }
}
const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user;

        const currentUser = await User.findOne({ _id: userId });

        if (!currentUser) {
            return res.render("change-email", { message: "User with this email not exist" });
        }
       
        if (currentUser.email != email) {
            return res.render("change-email", { message: "Please enter your current email address" })
        }
         
        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        try {
            const emailSent = await sendVerificationEmail(email, otp);
            console.log("Email sending result:", emailSent);

            if (!emailSent) {
                return res.json("email-error");
            }

            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;

            console.log("OTP:", otp)

            return res.render("change-email-otp");
        } catch (emailError) {
            console.error("Error sending email:", emailError);
            return res.render("change-email", { message: "Failed to sent OTP. Please try again" })
        }

    } catch (error) {
        console.error("Change email validation error:", error);
        return res.redirect("/pageNotFound");
    }
}

const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (!enteredOtp || !req.session.userOtp) {
            return res.json({
                success: false,
                message: "Invalid OTP verification attempt"
            });
        }

        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            return res.json({
                success: true,
                redirectUrl: "/update-email"
            });
        } else {
            return res.json({
                success: false,
                message: "The OTP you entered is incorrect. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.json({
            success: false,
            message: "An error occurred during verification. Please try again."
        });
    }
}
const getUpdateEmailPage = async (req, res) => {
    try {
        if (!req.session.userOtp) {
            return res.redirect('/change-email');
        }
        return res.render('update-email',{message:null});
    } catch (error) {
        console.error("Error loading update email page:", error);
        return res.redirect("/pageNotFound");
    }
};
const updateEmail = async (req, res) => {
    try {

        const newEmail = req.body.email;
        const userId = req.session.user;

        const emailExists = await User.findOne({ email: newEmail, _id: { $ne: userId } });

        if (emailExists) {
            return res.render("update-email", { message: "This email already exists. Please try again with a new email." });
        }

        await User.findByIdAndUpdate(userId, { email: newEmail });
        return res.redirect("/userProfile?tab=dashboard")

    } catch (error) {
        console.error("The error is here", error)
        return res.redirect("/pageNotFound")
    }
}


const changePassword = async (req, res) => {
    try {

        return res.render("change-password")

    } catch (error) {

        return res.redirect("/pageNotFound")

    }
}

const changePasswordValid = async (req, res) => {
    try {

        const { email } = req.body;
        const userId = req.session.user

        const currentUser = await User.findOne({ _id: userId })

        if (!currentUser) {
            return res.render("change-password", { message: "User not exist with this email" })
        }

        if (currentUser.email !== email) {
            return res.render("change-password", { message: "Please enter current email" })
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;

            console.log("OTP:", otp)
            return res.render("change-password-otp");
        } else {
            return res.json({
                success: false,
                message: "Failed to send OTP. Please try again"
            })
        }

    } catch (error) {

        console.error("Error in change password validation", error);
        return res.redirect("/pageNotFound")
    }
}

const verifyChangePassOtp = (req, res) => {
    try {

        const enteredOtp = req.body.otp;

        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            return res.json({
                success: true,
                redirectUrl: "/reset-password"
            });
        } else {
            return res.json({
                success: false,
                message: "The OTP you entered is incorrect. Please try again."
            });
        }

    } catch (error) {

        return res.json({
            success: false,
            message: "An error occurred during verification. Please try again."
        });

    }
}

const addAddress = async (req, res) => {
    try {

        const user = req.session.user;
        return res.render("add-address", { user: user })

    } catch (error) {
        return res.redirect("pageNotFound")
    }
}


const postAddAddress = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            })
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        return res.redirect("/userProfile?tab=address")
    } catch (error) {
        console.error("Error adding address:", error)
        return res.redirect("/pageNotFound")
    }
}


const editAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id": addressId,
        });
        if (!currAddress) {
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();
        })

        if (!addressData) {
            return res.redirect("/pageNotFound")
        }


        return res.render("edit-address", { address: addressData, user: user });

    } catch (error) {
        console.log("Error in edit address", error)
        return res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req, res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.redirect("/pageNotFound")
        }
        await Address.updateOne({ "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        pincode: data.pincode,
                        state: data.state,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    }
                }

            }
        )

        return res.redirect("/userProfile?tab=address")

    } catch (error) {
        console.error("Error in edit address", error);
        res.redirect("/pageNotFound")
    }
}

const deleteAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send("Address not found")
        }

        await Address.updateOne({
            "address._id": addressId
        },
            {
                $pull: {
                    address: {
                        _id: addressId,
                    }
                }
            })

        return res.redirect("/userProfile?tab=address")

    } catch (error) {
        console.error("Error in delete address:", error);
        return res.redirect("/pageNotFound")
    }
}


const viewOrderDetails = async (req,res) => {
    try {
        
        const {orderId} = req.params;
        const order = await Order.findOne({ orderId })
        .populate({
        path:'orderedItems.product',
        select:'productName price sizeVariants productImage'
    });


        if(!order){
            return res.status(404).json({message:'Order not found'})
        }

        return res.json(order);

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Error fetching order details' });
    }
}
const cancelSingleProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancelReason, productId } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find(item => 
            item.product._id.toString() === productId
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }

        const itemTotal = item.price * item.quantity;
        
        const remainingItems = order.orderedItems.filter(orderItem => 
            orderItem.product._id.toString() !== productId &&
            orderItem.status !== 'Cancelled' &&
            orderItem.status !== 'Returned'
        );
        
        const remainingTotal = remainingItems.reduce((total, orderItem) => 
            total + (orderItem.price * orderItem.quantity), 0);


        console.log("the coupon minimum price is ",order.couponMinPrice)

        const meetsMinimumAmount = remainingTotal >= (order.couponMinPrice|| 0);


        let refundAmount;
        if (!meetsMinimumAmount && order.discount) {
            refundAmount = itemTotal - order.discount;
            order.discount = 0; 
        } else {
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


const productReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { returnReason, productId, } = req.body; 
        const userId = req.session.user;


        const order = await Order.findOne({ orderId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const orderItem = order.orderedItems.find(
            item => item.product._id.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        if (orderItem.status === 'Returned' || orderItem.status === 'Return Request') {
            return res.status(400).json({
                success: false,
                message: 'This item is already in return process'
            });
        }

        if (orderItem.status !== 'Delivered') {
            return res.status(400).json({
                success: false,
                message: `Cannot return product in ${orderItem.status} status`
            });
        }

        orderItem.status = 'Return Request';
        orderItem.returnReason = returnReason;

        order.status = 'Return Request';
        order.returnStatus = 'Pending';
        order.returnReason = returnReason;

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
            redirectUrl: '/userProfile?tab=orders'
        });

    } catch (error) {
        console.error('Error in returnProduct:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the return request'
        });
    }
};



module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    updateProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    getUpdateEmailPage,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    viewOrderDetails,
    cancelSingleProduct,
    productReturn
}

