const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema")
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");



const pageerror = async (req, res) => {

    res.render("pageerror")

}

const getProductAddPage = async (req, res) => {
    try {

        const category = await Category.find({ isListed: true })
        res.render("product-add", {
            cat: category,
        });
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
};
const addProducts = async (req, res) => {
    try {

        const {
            productName,
            description,
            category: categoryName,
            regularPrice,
            salePrice,
            color,
            sizes,
            quantities
        } = req.body;



        if (!productName || !categoryName || !regularPrice) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const sizeVariants = [];
        if (Array.isArray(sizes) && Array.isArray(quantities)) {
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && quantities[i]) {
                    sizeVariants.push({
                        size: sizes[i],
                        quantity: parseInt(quantities[i])
                    });
                }
            }
        }

        const uniqueSizes = new Set(sizeVariants.map(entry => entry.size));
        if (uniqueSizes.size !== sizeVariants.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate sizes are not allowed"
            });
        }

        const productExists = await Product.findOne({ productName });
        if (productExists) {
            return res.status(400).json({ success: false, message: "Product already exists" });
        }

        const images = [];
        if (req.files && req.files.length > 0) {

            const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
            // Create directories recursively if they don't exist
            fs.mkdirSync(uploadDir, { recursive: true });


            for (const file of req.files) {
                try {
                    const fileName = `${Date.now()}-${file.originalname}`;
                    const filePath = path.join(uploadDir, fileName);


                    await sharp(file.path)
                        .resize(440, 440, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .toFile(filePath);


                    images.push(fileName);


                } catch (error) {
                    console.error("Error processing image:", error);
                }
            }
        }


        const category = await Category.findOne({ name: categoryName });
        if (!category) {
            return res.status(400).json({ success: false, message: "Invalid category" });
        }


        const newProduct = new Product({
            productName,
            description,
            category: category._id,
            regularPrice,
            salePrice,
            createdOn: new Date(),
            sizeVariants: sizeVariants,
            color,
            productImage: images,
            status: "Available"
        });

        await newProduct.save();



        return res.status(200).json({
            success: true,
            message: "Product added successfully"
        });

    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const getAllProducts = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 5;

        const productData = await Product.find({

            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },

            ],

        }).limit(limit * 1).skip((page - 1) * limit).populate("category").exec();

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ],
        }).countDocuments();


        const category = await Category.find({ isListed: true });
        if (category) {
            res.render("products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,

            })
        } else {
            res.render("pageerror");
        }

    } catch (error) {
        res.redirect("/admin/pageerror");
    }
}

const addProductOffer = async (req, res) => {
    try {
      const { productId, percentage } = req.body;
      
      if (isNaN(percentage) || percentage <= 0 || percentage >= 100) {
        return res.status(400).json({ 
          status: false, 
          message: "Offer percentage must be between 1 and 99" 
        });
      }
  
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ status: false, message: "Product not found" });
      }
  
      const category = await Category.findById(product.category);
      if (!category) {
        return res.status(404).json({ status: false, message: "Category not found" });
      }
  
      if (category.categoryOffer >= percentage) {
        return res.json({
          status: false,
          message: "Category offer is already equal or better than the proposed product offer"
        });
      }
  
      const newSalePrice = Math.floor(product.regularPrice * (1 - percentage / 100));
      if (newSalePrice < 0) {
        return res.status(400).json({ 
          status: false, 
          message: "Offer would result in negative price" 
        });
      }
  
      product.salePrice = newSalePrice;
      product.productOffer = percentage;
      await product.save();
  
      if (category.categoryOffer > 0) {
        category.categoryOffer = 0;
        await category.save();
      }
  
      return res.json({ 
        status: true, 
        message: "Product offer added successfully" 
      });
    } catch (error) {
      console.error("Error in addProductOffer:", error);
      return res.status(500).json({ status: false, message: "Internal server error" });
    }
  };
  
  const removeProductOffer = async (req, res) => {
    try {
      const { productId } = req.body;
      
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ status: false, message: "Product not found" });
      }
  
      const category = await Category.findById(product.category);
      if (!category) {
        return res.status(404).json({ status: false, message: "Category not found" });
      }
  
      product.productOffer = 0;
  
      if (category.categoryOffer > 0) {
        const discountAmount = Math.floor((product.regularPrice * category.categoryOffer) / 100);
        product.salePrice = Math.max(0, product.regularPrice - discountAmount);
      } else {
        product.salePrice = product.regularPrice;
      }
  
      await product.save();
      
      return res.json({ 
        status: true, 
        message: "Product offer removed successfully" 
      });
    } catch (error) {
      console.error("Error in removeProductOffer:", error);
      return res.status(500).json({ status: false, message: "Internal server error" });
    }
  };

const blockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        return res.redirect("/admin/products")

    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}


const unblockProduct = async (req, res) => {
    try {

        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        return res.redirect("/admin/products")

    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({});
        return res.render("edit-product", {
            product: product,
            cat: category,
        })
    } catch (error) {
        return res.redirect("/admin/pageerror")
    }
}

const editProduct = async (req, res) => {
    try {



        const id = req.params.id;
        console.log("id",id)
        const product = await Product.findOne({ _id: id });
        const data = req.body;


        let sizeVariants = [];
        try {
            if (data.sizeVariantsData) {
                sizeVariants = JSON.parse(data.sizeVariantsData);
            }
        } catch (error) {
            console.error("Error parsing size variants:", error);
        }

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({
                error: "Product with this name already exists. Please try with another name"
            });
        }

        const images = [];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            category: data.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            color: data.color,
            sizeVariants: sizeVariants
        };

        console.log("Update fields:", updateFields);


        if (images.length > 0) {
            await Product.findByIdAndUpdate(
                id,
                {
                    ...updateFields,
                    $push: { productImage: { $each: images } }
                },
                { new: true }
            );
        } else {
            await Product.findByIdAndUpdate(
                id,
                updateFields,
                { new: true }
            );
        }
        console.log("Product update completed successfully");
        res.redirect("/admin/products");

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

const deleteSingleImage = async (req, res) => {
    try {

        const { imageNameToServer, productIdToServer } = req.body
        const product = await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } })
        const imagePath = path.join("public", 'uploads', 're-image', imageNameToServer);
        if (fs.existsSync(imagePath)) {
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        } else {
            console.log(`Image ${imageNameToServer} not found`)
        }
        return res.send({ status: true });

    } catch (error) {
        return res.redirect("/admin/pageerror")
    }

}

const deleteProduct = async (req, res) => {
    try {

        const { productId } = req.body;
        console.log("product id is ", productId)

        const product = await Product.findByIdAndDelete(productId)

        if (product) {
            return res.json({ status: true })
        } else {
            return res.json({ status: false })
        }

    } catch (error) {
        console.error('Product delete error', error)
        return res.json({ status: false });
    }
}

module.exports = {
    pageerror,
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    deleteProduct

}