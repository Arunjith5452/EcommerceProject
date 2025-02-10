const User = require("../../models/userSchema");



const pageerror = async (req, res) => {

    res.render("pageerror")
  
  }
  

const customerInfo = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 10;

        const userData = await User.find({
            isAdmin: false,
            $or: [

                { username: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ],
        })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [

                { username: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ],
        }).countDocuments();

        res.render("customers", {
            data: userData,
            totalPages:Math.ceil(count / limit),
            currentPage: page,
        })

    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(500).send("Internal Server Error");
    }
}


const customerBlocked = async (req, res) => {
    try {

        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/users")

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}


const customerunBlocked = async (req, res) => {
    try {

        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/users")

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

module.exports = {
    pageerror,
    customerInfo,
    customerBlocked,
    customerunBlocked
}