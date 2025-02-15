const Category = require('../../models/categorySchema');
const Product = require("../../models/productSchema");


const pageerror = async (req, res) => {

    res.render("pageerror")
  
  }
  
const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalCategories: totalCategories,
            totalPages: totalPages
        });

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror")
    }
}

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {

      const existingCategory = await Category.findOne({ 
        categoryName: { $regex: new RegExp(`^${name}$`, 'i') }
      })
      
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" })
        }
        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save();
        return res.json({ message: "Category added successfully" })
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" })
    }
}


const addCategoryOffer = async (req, res) => {
    try {
      const percentage = parseInt(req.body.percentage);
      const categoryId = req.body.categoryId;
  
      if (isNaN(percentage) || percentage <= 0 || percentage >= 100) {
        return res.status(400).json({ 
          status: false, 
          message: "Offer percentage must be between 1 and 99" 
        });
      }
  
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ status: false, message: "Category not found" });
      }
  
      const products = await Product.find({ category: category._id });
      
      const hasProductOffer = products.some(product => product.productOffer > 0);
      if (hasProductOffer) {
        return res.json({ 
          status: false, 
          message: "Cannot add category offer when products have individual offers" 
        });
      }
  
      await Category.updateOne(
        { _id: categoryId }, 
        { $set: { categoryOffer: percentage } }
      );
  
      for (const product of products) {
        product.productOffer = 0;
        const discountAmount = Math.floor((product.regularPrice * percentage) / 100);
        product.salePrice = Math.max(0, product.regularPrice - discountAmount);
        await product.save();
      }
  
      res.json({ status: true, message: "Category offer added successfully" });
    } catch (error) {
      console.error("Error in addCategoryOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  };
  
  const removeCategoryOffer = async (req, res) => {
    try {
      const categoryId = req.body.categoryId;
      
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ status: false, message: "Category not found" });
      }
  
      const products = await Product.find({ category: category._id });
  
      for (const product of products) {
        if (!product.productOffer) { 
          product.salePrice = product.regularPrice;
        }
        await product.save();
      }
  
      category.categoryOffer = 0;
      await category.save();
  
      res.json({ status: true, message: "Category offer removed successfully" });
    } catch (error) {
      console.error("Error in removeCategoryOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  };
const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const getEditCategory = async (req, res) => {
    try {

        const id = req.query.id;
        const category = await Category.findOne({ _id: id })
        res.render("edit-category", { category: category });

    } catch (error) {

        res.redirect("/admin/pageerror")

    }
}


const editCategory = async (req, res) => {
  try {
      const id = req.params.id;
      const { categoryName, description } = req.body;

      const existingCategory = await Category.findOne({ categoryName });
      if (existingCategory) {
        return res.status(400).json({ error: "Category already exists, please choose another name" });
      }
     
      const updateCategory = await Category.findByIdAndUpdate(id, {
          name: categoryName,
          description: description
      }, { new: true });

      if (updateCategory) {
          return res.json({ success: true, message: "Category updated successfully" });
      } else {
          return res.status(404).json({ error: "Category not found" });
      }
  } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
  }
};



module.exports = {
    pageerror,
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}