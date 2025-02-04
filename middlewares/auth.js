const User = require("../models/userSchema")


const userAuth = async (req, res, next) => {
    try {
      if (req.session.user) {
        const userData = await User.findById(req.session.user) 
        
        if (!userData || userData.isBlocked) {
          req.session.destroy((err) => {
            if (err) {
              return res.status(500).send("Error destroying session")
            }
            return res.redirect('/login')
          });
        } else {
          return next()
        }
      } else {
        return res.redirect('/login')
      }
    } catch (err) {
      console.error("User authentication error:", err)
      return res.status(500).send("Internal Server Error")
    }
  }
  

  const adminAuth = async (req, res, next) => {
    try {
      if (req.session.admin) {
        const adminUser = await User.findById(req.session.admin)
        
        if (!adminUser || !adminUser.isAdmin) {
          return res.redirect('/admin/login')
        }
        
        next();
      } else {
        return res.redirect('/admin/login');
      }
    } catch (error) {
      console.error("Admin authentication error:", error)
      return res.status(500).send("Internal Server Error")
    }
  }


module.exports = {
    userAuth,
    adminAuth
}