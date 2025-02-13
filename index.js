const express = require('express')
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db');
const nocache = require("nocache");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const errorHandler = require("./middlewares/errorHandler");
const helmet = require("helmet")

app.use(helmet)
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000 
    }
}))

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static(path.join(__dirname, "./public")));


app.use("/admin", adminRouter);
app.use("/", userRouter);

app.use(nocache());

app.use(errorHandler);
app.use((req, res, next) => {
    const isAdminRoute = req.originalUrl.startsWith('/admin');
    const redirectUrl = isAdminRoute ? '/admin/dashboard' : '/'; 
    
    res.status(404).render(isAdminRoute ? "pageerror" : "page-404", { 
        title: "Page Not Found", 
        message: "The page you are looking for does not exist.",
        status: 404,
    })
})


db();

app.listen(process.env.PORT, () => {
    console.log('Server running on port', process.env.PORT)
})
