const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")


const loadCoupon = async (req,res) => {
    try {

        const findCoupons = await Coupon.find({})
        return res.render("coupon",{coupons:findCoupons})
    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}


const createCoupon = async (req,res) => {
    try {
        console.log("req.body",req.body)
        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate + "T00:00:00"),
            endDate : new Date(req.body.endDate + "T00:00:00"),
            offerPrice : parseInt(req.body.offerPrice),
            minimumPrice : parseInt(req.body.minimumPrice),
        }

        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expireOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        })
         console.log("newCoupon",newCoupon)
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
            const startDate = new Date(req.body.startDate)  
            const endDate = new Date(req.body.endDate)

            console.log(new Date(req.body.endDate)); 

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

            if(updateCoupon!=null){
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

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon
}