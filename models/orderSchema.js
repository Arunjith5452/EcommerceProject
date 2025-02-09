const mongoose = require("mongoose")
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid')

const orderSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        size: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned', "Failed"],
            default: 'Pending'
        },
        cancelReason: {
            type: String,
            trim: true
        },
        returnReason: {
            type: String,
            trim: true
        },
        returnStatus: {
            type: String,
            enum: ['', 'Pending', 'Approved', 'Rejected'],
            default: ''
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned', "Failed"]
    },
    cancelReason: {
        type: String,
        trim: true
    },
    returnReason: {
        type: String,
        trim: true
    },
    returnStatus: {
        type: String,
        enum: ['', 'Pending', 'Approved', 'Rejected'],
        default: ''
    },
    paymentId: String,
    paymentRetryCount: { type: Number, default: 0 },
    paymentFailureReason: String,
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'RAZORPAY', 'WALLET']
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Failed', 'Success'],
        default: 'Pending'
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    }
});

const Order = mongoose.model("Order", orderSchema)
module.exports = Order;