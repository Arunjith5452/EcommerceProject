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

    dateFilter.status = 'Delivered';

    const [
      totalOrders,
      totalRevenue,
      orderStatusCounts,
      orderDetails,
      totalUsers,
      totalProducts,
      totalCategories,
      totalCoupons
    ] = await Promise.all([
      Order.countDocuments(dateFilter),
      Order.aggregate([
        { $match: dateFilter },
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
      Order.find(dateFilter, {
        orderId: 1,
        createdOn: 1,
        totalPrice: 1,
        discount: 1,
        finalAmount: 1,
        status: 1
      })
        .sort({ createdOn: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec(),
      User.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments(),
      Coupon.countDocuments()
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
      endDate
    };

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json(responseData);
    }

    return res.render("dashboard", responseData)
  } catch (error) {
    console.log("Error loading dashboard", error)
    return res.redirect("/admin/pageerror")
  }
}

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
        amount:`₹${order.totalPrice}`,
        discount:`₹${order.discount}`,
        finalAmount:`₹${order.finalAmount}`,
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
  logout
}