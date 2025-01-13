const User = require("../../models/userSchema");
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config();
const session = require("express-session");

function generateOtp(){

    const digits = "1234567890"
    let otp = ""
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp
}

const sendVerificationEmail = async (email,otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })
     const mailOptions = {
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"Your OTP for password reset",
        text:`Your OTP is ${otp}`,
        html:`<b><h4>Your OTP:${otp}</h4><br></b>`
     }
    const info = await transporter.sendMail(mailOptions);
    console.log("email sent :",info.messageId);

    return true

    } catch (error) {
        console.error("error sending email",error);
        return false
    }
}

const securePassword = async (password)=> {
    try {
        
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    } catch (error) {
        
    }
}


const getForgotPassPage = async (req,res) => {
    try {
        
        res.render("forgot-password");

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid = async (req,res) => {
    try {
        
     const {email} = req.body;
     const findUser = await User.findOne({email:email})
     if(findUser){
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            req.session.userOtp = otp;
            req.session.email = email;
            res.render("forgotPass-otp");
            console.log("OTP:",otp)
        }else{
            return res.json({success:false,message:"Failed to send otp. Please try again"});
        }
     }else{
        return res.render("forgot-password",{message:"User with this email does not exist"});
     }

    } catch (error) {
        return res.redirect("/pageNotFound")
    }
}


const verifyForgotPassOtp = async (req,res) => {
    try {
        
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            return res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"});
        }

    } catch (error) {
        return res.status(500).json({success:false,message:"An error occured. Please try again"})
    }
}


const getResetPassPage = async (req,res) => {
    try {

        return res.render("reset-password")

    } catch (error) {
        
        return res.redirect("/pageNotFound")
    }
}


const resendOtp = async (req,res) => {
    console.log("Resend otp is working, sending the request");
    try {

        const otp = generateOtp();
        console.log("resend otp generate",otp)
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            return res.status(200).json({success:true,message:"Resend otp successful"});
        }else {
           return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
        
    } catch (error) {
        
        console.error("Error in resend otp",error)
        return res.status(500).json({success:false,message:"Internal Server Error"});
    }
}

const postNewPassword = async (req,res) => {
    try {
        
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},{$set:{password:passwordHash}}
            )
            return res.redirect("/login")
        }else{
            return res.render("reset-password",{message:'Passwords do not match'});
        }

    } catch (error) {
        return res.redirect("/PageNotFound")
    }
}

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    
}