const mongoose = require("mongoose");
const { Schema } = mongoose;

const sizeSchema = new Schema({
    stock: [{
        size: {
            type: String,
            required: true 
        },
        quantity: {
            type: Number, 
            required: true 
        }
    }]
});

const Size = mongoose.model("Size", sizeSchema);

module.exports = Size;
