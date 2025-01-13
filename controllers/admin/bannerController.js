const Banner = require("../../models/bannerSchema");
const path = require("path");
const fs = require("fs");



const getBannerPage = async (req,res) => {
    try {
        
        const findBanner = await Banner.find({});
       return res.render("banner",{data:findBanner});

    } catch (error) {
        return res.redirect("admin/pageerror")
    }
}


const getAddBannerPage = async (req,res) => {
    try {
        
        return res.render("addBanner")

    } catch (error) {
        return res.redirect("admin/pageerror")
    }
}

const addBanner = async (req, res) => {
    try {
        console.log("Request body:", req.body);
        console.log("Request file:", req.file);
        
        if (!req.file) {
            console.log("No file uploaded");
            return res.status(400).json({ error: 'Image is required' });
        }

        const { title, description, startDate, endDate, link } = req.body;
        
        if (!title || !description || !startDate || !endDate || !link) {
            console.log("Missing required fields");
            return res.status(400).json({ error: 'All fields are required' });
        }

        const newBanner = new Banner({
            title,
            description,
            startDate: new Date(startDate + "T00:00:00"),
            endDate: new Date(endDate + "T00:00:00"),
            link,
            image: req.file.filename
        });

        console.log("Attempting to save banner:", newBanner);

        const savedBanner = await newBanner.save();
        console.log("Banner saved successfully:", savedBanner);

        return res.status(200).json({ 
            success: true, 
            message: 'Banner added successfully',
            data: savedBanner 
        });

    } catch (error) {
        console.error("Error in addBanner:", error);
        return res.status(500).json({ 
            error: 'Server error', 
            details: error.message 
        });
    }
}

module.exports = {
    getBannerPage,
    getAddBannerPage,
    addBanner
}