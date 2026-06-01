# 🛍️ FashionKart

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/EJS-B4CA65?style=for-the-badge&logo=ejs&logoColor=black" alt="EJS" />
</div>

<br />

A robust, full-stack e-commerce platform built with the MEN stack (MongoDB, Express.js, Node.js) and EJS templates. FashionKart delivers a seamless online shopping experience with secure authentication, intuitive product discovery, and comprehensive admin controls.

## ✨ Key Features

### 👤 User Experience
* **Secure Authentication:** Standard email/password login and Google OAuth integration via Passport.js.
* **Demo Login:** One-click demo credentials access for rapid testing.
* **Product Catalog:** Browse products, view detailed descriptions, and filter by categories.
* **Shopping Cart & Wishlist:** Easily manage saved items and prepare for checkout.
* **Checkout & Payments:** Seamless checkout process integrated with Razorpay for secure transactions.
* **Order Management:** Track order history, download invoices (PDF), and manage returns.
* **User Profile:** Manage personal details, addresses, and account security.

### 🛡️ Admin Dashboard
* **Dashboard Analytics:** Comprehensive overview of sales, user growth, and order statistics.
* **Product & Inventory Management:** Add, edit, or remove products. Crop and process product images with Sharp.
* **Category & Offer Management:** Organize the catalog and apply global or category-specific discounts.
* **Coupon System:** Create and manage promotional coupons.
* **Order Fulfillment:** View, process, update, and manage customer orders.
* **Sales Reports:** Generate and download detailed sales reports in Excel and PDF formats.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB (with Mongoose ORM)
* **View Engine:** EJS (Embedded JavaScript templates)
* **Authentication:** Passport.js (Local Strategy & Google OAuth2.0), bcrypt
* **File Uploads & Processing:** Multer, Sharp
* **Payments:** Razorpay
* **Report Generation:** ExcelJS, PDFKit
* **Security:** Helmet, Express-Session, Connect-Mongo

## 🚀 Getting Started

### Prerequisites
* Node.js (v16 or higher)
* MongoDB database (Local or Atlas)
* Razorpay Account (for payment gateway credentials)
* Google Cloud Console Account (for OAuth credentials)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "First Project"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add the required variables. (See [Environment Variables](#-environment-variables) section below).

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will run on `http://localhost:3000` (or your configured port).

## 🔐 Environment Variables

Create a `.env` file in the root of your project and configure the following:

```env
# Server
PORT=3000
SESSION_SECRET=your_session_secret

# Database
MONGODB_URI=your_mongodb_connection_string

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## 📁 Project Structure

```text
├── config/             # Database and third-party service configurations
├── controllers/        # Route controllers (Admin & User)
├── helpers/            # Reusable utility functions
├── middlewares/        # Custom Express middlewares (Auth, etc.)
├── models/             # Mongoose database schemas
├── public/             # Static assets (CSS, JS, Images)
├── routes/             # Express route definitions
├── views/              # EJS templates (Admin & User layouts)
├── index.js            # Application entry point
└── package.json        # Project metadata and scripts
```

## 📄 License

This project is licensed under the ISC License.
