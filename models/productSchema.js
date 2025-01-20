const mongoose = require("mongoose")
const { schema } = require("./userSchema")
const { Schema } = mongoose



const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true

    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    sizeVariants: [{
        size: {
            type: String,
            required: true,
            enum:['S', 'M', 'L', 'XL', 'XXL']
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    color: {
        type: String,
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },

}, { timestamps: true });

const Product = mongoose.model("Product", productSchema)

module.exports = Product;