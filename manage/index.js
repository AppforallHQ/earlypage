PROJECT = {
  name: "اپفورال",
  user: "PROJECT",
  pass: "",
  host: "PROJECT.127.0.0.1.xip.io:3069",
  url_landing: "http://localhost:8069/static/landing.html",
  url_welcome: "http://localhost:8069/static/welcome.html",
  active: true
}

var mongoose = require("mongoose")
mongoose.connect("mongodb://localhost/earlypage")

var User = mongoose.model('User', {
  name: String,
  user: String,
  pass: String,
  host: String,
  url_landing: String,
  url_welcome: String,
  active: Boolean
})

User.remove({}, function(err) {
  User.create(PROJECT, function() {
    User.find(function(err, objs) {
      console.log(objs)
    })
  })
})

var EarlyAdopter = mongoose.model('EarlyAdopter', {
  referer: {
    type: mongoose.Schema.Types.ObjectId, ref: 'EarlyAdopter'
  },
  email: String,
  created_at: Date,
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User'
  }
})

var express = require("express"),
    app = express()

app.use(require("cookie-parser")("super-secret-string"))

app.use(function(req, res, next) {
  User.findOne({host: req.headers.host}, function(err, user) {
    if (!user) {
      res.send("Host not configured")
    } else if (!user.active) {
      res.send("You are accessing page for " + user.name + ", but the earlypage is not active")
    } else {
      req.user = user
      next()
    }
  })
})

app.get("/", function(req, res) {
  res.send("You are accessing the page for " + req.user.name)
})

var server = app.listen(3069, function() {
  console.log('Listening on port %d', server.address().port);
})
