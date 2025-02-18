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
        req.session.admin = admin._id;
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
    const combinedFilter = {
      ...dateFilter,
      "orderedItems.status": "Delivered"
    };

    return await Order.aggregate([
      { $match: combinedFilter },
      { $unwind: "$orderedItems" },
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
    const combinedFilter = {
      ...dateFilter,
      "orderedItems.status": "Delivered"
    };

    return await Order.aggregate([
      { $match: combinedFilter },
      { $unwind: "$orderedItems" },
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
      { $match: { _id: { $ne: null } } }, 
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
    return "%Y-%m-%d %H:00"; 
  } else if (diffDays <= 7) {
    return "%Y-%m-%d";       
  } else if (diffDays <= 31) {
    return "%Y-%m-%d";      
  } else if (diffDays <= 365) {
    return "%Y-%m";          
  } else {
    return "%Y-%m";          
  }
};

const loadDashboard = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = 6;
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

    const deliveredFilter = {
      ...dateFilter,
      "orderedItems.status": "Delivered"
    };

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
      Order.countDocuments(dateFilter),

      Order.aggregate([
        { $match: dateFilter }, 
        { $unwind: "$orderedItems" },
        { $match: { "orderedItems.status": "Delivered" } },  
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

      getBestSellingProducts(deliveredFilter),
      getBestCategories(deliveredFilter),
      getSalesData(deliveredFilter)
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


const createDateFilter = (filter, startDate, endDate) => {
  filter = filter || 'daily';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dateFilter = {};

  switch (filter.toLowerCase()) {
    case 'yearly':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      dateFilter = {
        createdOn: {
          $gte: yearStart,
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

    case 'custom':
      if (startDate && endDate) {
        const customStart = new Date(startDate);
        const customEnd = new Date(endDate);
        
        if (!isNaN(customStart.getTime()) && !isNaN(customEnd.getTime())) {
          dateFilter = {
            createdOn: {
              $gte: customStart,
              $lte: new Date(customEnd.setHours(23, 59, 59, 999))
            }
          };
        } else {
          console.warn('Invalid custom date range, falling back to daily');
          dateFilter = {
            createdOn: {
              $gte: today,
              $lte: new Date(now.setHours(23, 59, 59, 999))
            }
          };
        }
      } else {
        console.warn('Missing custom date range parameters, falling back to daily');
        dateFilter = {
          createdOn: {
            $gte: today,
            $lte: new Date(now.setHours(23, 59, 59, 999))
          }
        };
      }
      break;

    case 'daily':
    default:
      dateFilter = {
        createdOn: {
          $gte: today,
          $lte: new Date(now.setHours(23, 59, 59, 999))
        }
      };
  }

  return dateFilter;
};

const generateExcelReport = async (req, res) => {
  try {
    const filter = req.query.filter || 'daily';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;


    const dateFilter = createDateFilter(filter, startDate, endDate);
    const orders = await Order.aggregate([
      { 
        $match: {
          ...dateFilter,
          "orderedItems.status": "Delivered" 
        }
      },
      { $unwind: "$orderedItems" },
      { 
        $match: { 
          "orderedItems.status": "Delivered" 
        }
      },
      {
        $group: {
          _id: "$_id",
          orderId: { $first: "$orderId" },
          createdOn: { $first: "$createdOn" },
          status: { $first: "$orderedItems.status" },
          totalPrice: { 
            $sum: { 
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
            }
          },
          discount: { $first: "$discount" },
          finalAmount: { 
            $sum: { 
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
            }
          },
          items: { 
            $push: {
              quantity: "$orderedItems.quantity",
              price: "$orderedItems.price",
              total: { 
                $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
              }
            }
          }
        }
      },
      { $sort: { createdOn: -1 } }
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    const titleRow = worksheet.addRow(['Sales Report (Delivered Items Only)']);
    titleRow.font = { bold: true, size: 16 };
    worksheet.addRow(['Filter Type:', filter]);
    worksheet.addRow(['Date Range:', 
      `${dateFilter.createdOn.$gte.toLocaleDateString()} to ${dateFilter.createdOn.$lte.toLocaleDateString()}`
    ]);
    worksheet.addRow([]);

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Price', key: 'unitPrice', width: 12 },
      { header: 'Total Price', key: 'totalPrice', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Final Amount', key: 'finalAmount', width: 12 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    worksheet.getRow(5).font = { bold: true };
    worksheet.getRow(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    orders.forEach(order => {
      order.items.forEach(item => {
        const row = worksheet.addRow({
          orderId: order.orderId,
          date: order.createdOn.toLocaleString(),
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.total,
          discount: order.discount / order.items.length,
          finalAmount: order.finalAmount / order.items.length,
          status: order.status
        });

        const statusCell = row.getCell('status');
        statusCell.font = { color: { argb: 'FF008000' } };
        row.getCell('unitPrice').numFmt = '₹#,##0.00';
        row.getCell('totalPrice').numFmt = '₹#,##0.00';
        row.getCell('discount').numFmt = '₹#,##0.00';
        row.getCell('finalAmount').numFmt = '₹#,##0.00';
      });
    });

    worksheet.addRow([]);
    const summaryTitleRow = worksheet.addRow(['Summary']);
    summaryTitleRow.font = { bold: true, size: 12 };
    
    const summaryRows = [
      ['Total Orders:', orders.length],
      ['Total Items:', orders.reduce((sum, order) => sum + order.items.length, 0)],
      ['Total Sales:', orders.reduce((sum, order) => sum + order.totalPrice, 0)],
      ['Total Discount:', orders.reduce((sum, order) => sum + order.discount, 0)],
      ['Net Amount:', orders.reduce((sum, order) => sum + order.finalAmount, 0)]
    ];

    summaryRows.forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      if (typeof value === 'number' && label !== 'Total Orders:' && label !== 'Total Items:') {
        row.getCell(2).numFmt = '₹#,##0.00';
      }
      row.font = { bold: true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=DeliveredSalesReport.xlsx');
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error("Error generating Excel report:", error);
    return res.redirect("/admin/pageerror");
  }
};

const generatePDFReport = async (req, res) => {
  try {
    const filter = req.query.filter || 'daily';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const dateFilter = createDateFilter(filter, startDate, endDate);
    
    const orders = await Order.aggregate([
      { 
        $match: {
          ...dateFilter,
          "orderedItems.status": "Delivered" 
        }
      },
      { $unwind: "$orderedItems" },
      { 
        $match: { 
          "orderedItems.status": "Delivered" 
        }
      },
      {
        $group: {
          _id: "$_id",
          orderId: { $first: "$orderId" },
          createdOn: { $first: "$createdOn" },
          status: { $first: "$orderedItems.status" },
          totalPrice: { 
            $sum: { 
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
            }
          },
          discount: { $first: "$discount" },
          finalAmount: { 
            $sum: { 
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
            }
          },
          items: { 
            $push: {
              quantity: "$orderedItems.quantity",
              price: "$orderedItems.price",
              total: { 
                $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
              }
            }
          }
        }
      },
      { $sort: { createdOn: -1 } }
    ]);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No delivered orders found for the specified period" });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=DeliveredSalesReport.pdf');
    doc.pipe(res);

    doc.fontSize(20)
       .fillColor('#000000') 
       .text('Sales Report (Delivered Items Only)', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12)
       .fillColor('#000000')  
       .text(`Filter Type: ${filter}`);
    doc.text(`Date Range: ${dateFilter.createdOn.$gte.toLocaleDateString()} to ${dateFilter.createdOn.$lte.toLocaleDateString()}`);
    doc.moveDown();

    const table = {
      headers: [
        { label: 'Order ID', property: 'orderId', width: 80 },  
        { label: 'Date', property: 'date', width: 90 },        
        { label: 'Qty', property: 'quantity', width: 40 },
        { label: 'Price', property: 'price', width: 70 },      
        { label: 'Total', property: 'total', width: 80 },     
        { label: 'Status', property: 'status', width: 60 }
      ],
      datas: orders.flatMap(order => 
        order.items.map(item => ({
          orderId: order.orderId,
          date: order.createdOn.toLocaleDateString(),
          quantity: item.quantity.toString(),
          price: `₹${item.price.toFixed(2)}`,
          total: `₹${(item.quantity * item.price).toFixed(2)}`,
          status: {
            label: order.status,
            color: '#006400'
          }
        }))
      )
    };

    const createTable = async () => {
      await doc.table(table, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000'),
        prepareRow: (row, indexColumn, indexRow, rectRow) => {
          doc.font('Helvetica').fontSize(9);
          doc.addBackground(rectRow, indexRow % 2 ? 'white' : '#f5f5f5');
          
          if (indexColumn === 5) {  
            doc.fillColor(row.status.color);
          } else {
            doc.fillColor('#000000'); 
          }
        },
        padding: 8, 
        columnSpacing: 10  
      });
    };

    await createTable();

    doc.moveDown(2);  
    doc.fillColor('#000000') 
       .fontSize(12)
       .text('Summary', { underline: true });
    doc.moveDown(0.5);
    
    const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0);
    const totalSales = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const netAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    
    doc.fillColor('#000000')
       .fontSize(11);
    doc.text(`Total Orders: ${orders.length}`);
    doc.text(`Total Items: ${totalItems}`);
    doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
    doc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
    doc.text(`Net Amount: ₹${netAmount.toFixed(2)}`);

    doc.end();

  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({ message: "Error generating PDF report", error: error.message });
  }
};

const adminLogout = async (req, res) => {
  try {
      delete req.session.admin 
      return res.redirect('/admin/login');
  } catch (error) {
      console.log("Admin logout error", error);
      res.redirect("/pageError");
  }
};

module.exports = {
  pageerror,
  loadLogin,
  login,
  loadDashboard,
  generateExcelReport,
  generatePDFReport,
  getAnalyticsData,
  getTopPerformers,
  adminLogout
}