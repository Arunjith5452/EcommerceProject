const mongoose = require('mongoose')
const env = require('dotenv').config()



const connectDB = async () => {
  try {

    const conn = await mongoose.connect(process.env.MONGODB_URI)
    
    console.log("DB host name",conn.connection.host)
    console.log("DB name oke make sure the db name",conn.connection.name)

    console.log("DB connected")

  } catch (error) {
    console.log("DB Connection error", error.message);
    process.exit(1);

  }
}

module.exports = connectDB;