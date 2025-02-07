const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema")
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit-table');


const pageerror = async (req, res) => {

  res.render("pageerror")

}

const loadLogin = async (req, res) => {

  if (req.session.admin) {
    return res.redirect("/admin/dashboard")
  }
  res.render("admin-login", { message: null })

}

const login = async (req, res) => {
  try {

    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        console.log("the code reached here")
        return res.redirect("/admin/dashboard")
      } else {
        return res.render("admin-login", { message: "Invalid password. Please try again" })
      }

    } else {
      return res.render("admin-login", { message: "Admin not found. please check your email" })
    }

  } catch (error) {

    console.log("login error", error)
    return res.redirect("/admin/pageerror")

  }
}

const getBestSellingProducts = async (dateFilter) => {
  try {
    return await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$orderedItems" },
      { $match: { "orderedItems.status": "Delivered" } },
      {
        $group: {
          _id: "$orderedItems.product",
          unitsSold: { $sum: "$orderedItems.quantity" },
          revenue: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ["$productInfo.productName", 0] },
          unitsSold: 1,
          revenue: 1
        }
      }
    ]);
  } catch (error) {
    console.error("Error getting best selling products:", error);
    throw error;
  }
};

const getBestCategories = async (dateFilter) => {
  try {
    return await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$orderedItems" },
      { $match: { "orderedItems.status": "Delivered" } },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ["$categoryInfo._id", 0] },
          name: { $first: { $arrayElemAt: ["$categoryInfo.name", 0] } },
          unitsSold: { $sum: "$orderedItems.quantity" },
          revenue: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);
  } catch (error) {
    console.error("Error getting best categories:", error);
    throw error;
  }
};



const getSalesData = async (dateFilter) => {
  try {

    console.log('Date filter for sales data:', dateFilter);

    if (!dateFilter.createdOn || !dateFilter.createdOn.$gte || !dateFilter.createdOn.$lte) {
      console.error('Invalid date filter:', dateFilter);
      return [];
    }

    const format = getDateFormat(dateFilter.createdOn.$gte, dateFilter.createdOn.$lte);
    return await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$orderedItems" },
      { $match: { "orderedItems.status": "Delivered" } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: format,
              date: "$createdOn"
            }
          },
          revenue: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
            }
          },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } },
      {
        $project: {
          date: "$_id",
          revenue: 1,
          orderCount: 1,
          _id: 0
        }
      }
    ]);

  } catch (error) {
    console.error("Error getting sales data:", error);
    throw error;
  }
}
const getDateFormat = (startDate, endDate) => {
  const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return "%Y-%m-%d %H:00";  // Hourly format
  } else if (diffDays <= 7) {
    return "%Y-%m-%d";        // Daily format
  } else if (diffDays <= 31) {
    return "%Y-%m-%d";        // Daily format
  } else if (diffDays <= 365) {
    return "%Y-%m";           // Monthly format
  } else {
    return "%Y-%m";           // Monthly format for longer ranges
  }
};

const loadDashboard = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = 4;
    const filter = req.query.filter || 'daily';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }

    let dateFilter = {};
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'daily':
        dateFilter = {
          createdOn: {
            $gte: today,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        dateFilter = {
          createdOn: {
            $gte: weekStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFilter = {
          createdOn: {
            $gte: monthStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'yearly':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        dateFilter = {
          createdOn: {
            $gte: yearStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            createdOn: {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            }
          };
        }
        break;
    }
    const [
      totalOrders,
      totalRevenue,
      orderStatusCounts,
      orderDetails,
      totalUsers,
      totalCategories,
      totalProducts,
      totalCoupons,
      bestSellingProducts,
      bestCategories,
      salesData
    ] = await Promise.all([
      Order.countDocuments({ ...dateFilter, "orderedItems.status": "Delivered" }),

      Order.aggregate([
        {
          $match: {
            ...dateFilter,
            "orderedItems.status": "Delivered"
          }
        },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$finalAmount" },
            totalDiscount: { $sum: "$discount" }
          }
        }
      ]),

      Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: "$orderedItems.status",
            count: { $sum: 1 }
          }
        }
      ]),

      Order.find(dateFilter)
        .populate({
          path: 'orderedItems.product',
          select: 'productName price'
        })
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec(),

      User.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments(),
      Coupon.countDocuments(),

      getBestSellingProducts(dateFilter),
      getBestCategories(dateFilter),
      getSalesData(dateFilter)
    ]);

    let orderStatusData = {};
    orderStatusCounts.forEach(item => {
      orderStatusData[item._id] = item.count;
    });

    const responseData = {
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].totalSales : 0,
      totalDiscount: totalRevenue.length > 0 ? totalRevenue[0].totalDiscount : 0,
      orderStatusData,
      totalProducts,
      totalCategories,
      totalCoupons,
      orderDetails,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page),
      selectedFilter: filter,
      startDate,
      endDate,
      bestSellingProducts,
      bestCategories,
      salesData
    };

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json(responseData);
    }

    return res.render("dashboard", responseData);
  } catch (error) {
    console.log("Error loading dashboard", error);
    return res.redirect("/admin/pageerror");
  }
};

const getAnalyticsData = async (req, res) => {
  try {
    const filter = req.query.filter || 'daily';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    console.log('Received analytics request:', { filter, startDate, endDate });

    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    switch (filter) {
      case 'daily':
        dateFilter = {
          createdOn: {
            $gte: today,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        dateFilter = {
          createdOn: {
            $gte: weekStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFilter = {
          createdOn: {
            $gte: monthStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'yearly':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        dateFilter = {
          createdOn: {
            $gte: yearStart,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'custom':
        if (startDate && endDate) {
          const customStart = new Date(startDate);
          const customEnd = new Date(endDate);

          if (isNaN(customStart.getTime()) || isNaN(customEnd.getTime())) {
            throw new Error('Invalid date format provided');
          }

          dateFilter = {
            createdOn: {
              $gte: customStart,
              $lte: new Date(customEnd.setHours(23, 59, 59, 999))
            }
          };
        } else {
          dateFilter = {
            createdOn: {
              $gte: today,
              $lte: new Date(new Date().setHours(23, 59, 59, 999))
            }
          };
        }
        break;

      default:
        dateFilter = {
          createdOn: {
            $gte: today,
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        };
    }

    if (!dateFilter.createdOn || !dateFilter.createdOn.$gte || !dateFilter.createdOn.$lte) {
      dateFilter = {
        createdOn: {
          $gte: today,
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      };
    }

    const [bestSellingProducts, bestCategories, salesData] =
      await Promise.all([
        getBestSellingProducts(dateFilter),
        getBestCategories(dateFilter),
        getSalesData(dateFilter)
      ]);

    console.log('Analytics data:', {
      bestSellingProducts: bestSellingProducts.length,
      bestCategories: bestCategories.length,
      salesData: salesData.length
    });


    res.json({
      bestSellingProducts,
      bestCategories,
      salesData
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({
      error: "Error fetching analytics data",
      details: error.message
    });
  }
}

const getTopPerformers = async (req, res) => {
  try {
    const filter = req.query.filter || 'daily';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    switch (filter) {
      case 'daily':
        dateFilter = {
          createdOn: {
            $gte: today,
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
        break;
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        dateFilter = {
          createdOn: {
            $gte: weekStart,
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFilter = {
          createdOn: {
            $gte: monthStart,
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'yearly':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        dateFilter = {
          createdOn: {
            $gte: yearStart,
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
        break;

      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            createdOn: {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            }
          };
        }
        break;
    }

    const [bestProducts, bestCategories] = await Promise.all([
      getBestSellingProducts(dateFilter),
      getBestCategories(dateFilter)
    ]);

    res.json({
      products: bestProducts,
      categories: bestCategories
    });
  } catch (error) {
    console.error("Error getting top performers:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
};

const generateExcelReport = async (req, res) => {
  try {

    const orders = await Order.find({ status: "Delivered" })

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report')

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId' },
      { header: 'Date', key: 'date' },
      { header: 'Amount', key: 'amount' },
      { header: 'Discount', key: 'discount' },
      { header: 'Final Amount', key: 'finalAmount' },
      { header: 'Status', key: 'status' }
    ]

    orders.forEach(order => {
      worksheet.addRow({
        orderId: order.orderId,
        date: order.createdOn.toDateString(),
        amount: order.totalPrice,
        discount: order.discount,
        finalAmount: order.finalAmount,
        status: order.status

      })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=SaleReport.xlsx')
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.log("Error generating Excel report", error)
    return res.redirect("/admin/pageerror")
  }
}

const generatePDFReport = async (req, res) => {
  try {
    const orders = await Order.find({ status: "Delivered" }).sort({ createdOn: -1 })

    const doc = new PDFDocument({ margin: 30, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf')

    doc.pipe(res)

    doc.fontSize(20).text('Sales Report', { align: 'center' })
    doc.moveDown()

    const table = {
      title: 'Sales Report',
      headers: [
        { label: 'Order ID', property: 'orderId', width: 80 },
        { label: 'Date', property: 'date', width: 80 },
        { label: 'Amount', property: 'amount', width: 80 },
        { label: 'Discount', property: 'discount', width: 80 },
        { label: 'Final Amount', property: 'finalAmount', width: 80 },
        { label: 'Status', property: 'status', width: 80 }
      ],
      datas: orders.map(order => ({
        orderId: order.orderId,
        date: order.createdOn.toDateString(),
        amount: `₹${order.totalPrice}`,
        discount: `₹${order.discount}`,
        finalAmount: `₹${order.finalAmount}`,
        status: order.status
      }))
    };

    await doc.table(table, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.font('Helvetica').fontSize(8)
        indexColumn === 0 && doc.addBackground(rectRow, indexRow % 2 ? 'white' : '#f0f0f0')
      }
    })

    doc.end()

  } catch (error) {
    console.log("Error generating PDF report", error);
    return res.redirect("/admin/pageerror");
  }
};

const logout = async (req, res) => {
  try {

    req.session.destroy(err => {
      if (err) {
        console.log("Error destroying session", err)
        return res.redirect("/pageerror")

      }
      res.redirect("/admin/login")

    })

  } catch (error) {

    console.log("Unexpected error during logout", error)
    res.redirect("/admin/pageerror")

  }
}
module.exports = {
  pageerror,
  loadLogin,
  login,
  loadDashboard,
  generateExcelReport,
  generatePDFReport,
  getAnalyticsData,
  getTopPerformers,
  logout
}