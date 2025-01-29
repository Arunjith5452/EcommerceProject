const mongoose = require("mongoose");
// const { search } = require("..");
// const { search } = require("..");
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    mobile: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wallet: {
        type: Number,
        default: 0
    },
    walletHistory: [{
        transactionId: String,
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ["credit", "debit", "refund"], required: true }, 
        amount: { type: Number, required: true },
        status: { type: String, enum: ["Completed", "Pending"], default: "Completed" }
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    referalCode: {
        type: String,
        // required:true
    },
    redeemed: {
        type: Boolean,
        // required:true
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        // required:true
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
},{timestamps:true})




const User = mongoose.model("User", userSchema);

module.exports = User;