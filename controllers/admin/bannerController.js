const Banner = require("../../models/bannerSchema");
const path = require("path");
const fs = require("fs");


const getBannerPage = async (req, res) => {
    try {
        const findBanner = await Banner.find({}).sort({ createdAt: -1 }); // Sort by newest first
        console.log('Total banners found:', findBanner.length);
        
        if (findBanner.length === 0) {
            console.log('No banners found in database');
            return res.render("banner", { 
                data: [],
                message: "No banners found" 
            });
        }

        console.log('Found banners:', findBanner);
        return res.render("banner", { 
            data: findBanner,
            message: null 
        });
    } catch (error) {
        console.error('Error in getBannerPage:', error);
        return res.status(500).render("banner", { 
            data: [],
            message: "Error loading banners" 
        });
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
        // 1. Debug incoming data
        console.log('Received form submission');
        console.log('Body:', req.body);
        console.log('File:', req.file);
    
        console.log("Form Data:", {
            title: req.body.title,
            description: req.body.description,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            link: req.body.link
        });
        console.log("File:", req.file);

        // 2. Validate file
        if (!req.file) {
            console.error("Error: No image file uploaded");
            return res.status(400).send("Image file is required");
        }

        // 3. Create banner object with explicit data mapping
        const bannerData = {
            title: req.body.title,
            description: req.body.description,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate),
            link: req.body.link,
            image: req.file.filename
        };

        console.log("\nPrepared Banner Data:", bannerData);

        // 4. Create and save banner with error checking
        const banner = new Banner(bannerData);
        
        // 5. Validate banner before saving
        const validationError = banner.validateSync();
        if (validationError) {
            console.error("Validation Error:", validationError);
            return res.status(400).send("Validation failed: " + JSON.stringify(validationError.errors));
        }

        // 6. Save with await and error catching
        const savedBanner = await banner.save();
        console.log("\nBanner saved successfully:", savedBanner);
        
        // 7. Verify banner was saved
        const verifyBanner = await Banner.findById(savedBanner._id);
        console.log("\nVerified saved banner:", verifyBanner);

        return res.redirect('/admin/banner');

    } catch (error) {
        console.error("\nError saving banner:", error);
        // Send detailed error back for debugging
        return res.status(500).send(`Error saving banner: ${error.message}`);
    }
};
module.exports = {
    getBannerPage,
    getAddBannerPage,
    addBanner
}