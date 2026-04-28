const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")

const loadCoupon = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const findCoupons = await Coupon.find({})
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalCoupons / limit);

        return res.render("coupon", { 
            coupons: findCoupons, 
            currentPage: page, 
            totalPages: totalPages 
        });
    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}


const createCoupon = async (req,res) => {
    try {
        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate + "T00:00:00"),
            endDate : new Date(req.body.endDate + "T00:00:00"),
            offerPrice : parseInt(req.body.offerPrice),
            minimumPrice : parseInt(req.body.minimumPrice)
        }

        if (data.startDate >= data.endDate) {
            return res.status(400).send("End date must be after the start date");
        }

        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expireOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        })
        await newCoupon.save();
        return res.redirect("/admin/coupon");

    } catch (error) {
        console.error(error);
        return res.redirect("/admin/pageerror")
    }
}

const editCoupon = async (req,res) => {
    try {
        
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});
        return res.render('edit-coupon',{
            findCoupon:findCoupon,
        })

    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}

const updateCoupon = async (req,res) => {
    try {
        
        couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id:oid});
        if(selectedCoupon){
            const startDate = new Date(req.body.startDate + "T00:00:00")  
            const endDate = new Date(req.body.endDate + "T00:00:00")

            if (startDate >= endDate) {
                return res.status(400).send("End date must be after the start date");
            }
            const updateCoupon = await Coupon.updateOne(
                {_id:oid},
                {
                    $set:{
                        name: req.body.couponName,
                        createdOn: startDate,
                        expireOn:endDate,
                        offerPrice:parseInt(req.body.offerPrice),
                        minimumPrice:parseInt(req.body.minimumPrice),
                    },
                },{new:true}
            );

            if(updateCoupon!==null){
                return res.send("Coupon updated successfully")
            }else{
                res.status(500).send("Coupon update failed")
            }

        }


    } catch (error) {

        console.log(error)
        return res.redirect("/admin/pagerror")
    }
}

const deleteCoupon = async (req,res) => {
    try {
        
        const id = req.query.id;
        await Coupon.deleteOne({_id:id});
        return res.status(200).send({success:true,message:"Coupon deleted successfully"});

    } catch (error) {
        console.error("Error deleting coupon:",error);
        return res.status(500).send({success:false,message:"Failed to delete coupon"})
    }
}

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,
}