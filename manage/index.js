PROJECT = {
  name: "اپفورال",
  user: "PROJECT",
  pass: "",
  host: "PROJECT.127.0.0.1.xip.io:3069",
  url_landing: "http://localhost:8069/static/landing.html",
  url_welcome: "http://localhost:8069/static/welcome.html",
  active: true
}

TRIFORK = {
  name: "ترایفورک",
  user: "PROJECT",
  pass: "",
  host: "trifork.127.0.0.1.xip.io:3069",
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


var EarlyAdopter = mongoose.model('EarlyAdopter', {
  referer: {
    type: mongoose.Schema.Types.ObjectId, ref: 'EarlyAdopter'
  },
  email: String,
  created_at: Date,
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User'
  },
  _id: {
    type: require('mongoose-shortid'),
    len: 6,
    base: 16,
    alphabet: undefined,
    retries: 10
  }
})

User.remove({}, function(err) {
  User.create(TRIFORK)
  User.create(PROJECT, function(err, obj) {
    EarlyAdopter.remove({}, function(err) {
      JOHN_DOE = {
        referer: null,
        email: "foo@example.com",
        created_at: Date.now(),
        user: obj._id,
      }

      EarlyAdopter.create(JOHN_DOE, function() {
        EarlyAdopter.find(function(err, objs) {
          console.log(objs)
        })
      })
    })

    User.find(function(err, objs) {
      console.log(objs)
    })
  })
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

app.get("/r/:short_id", function(req, res) {
  var short_id = req.param("short_id")

  EarlyAdopter.findOne({_id: short_id}, function(err, adopter) {
    if(!adopter) {
      res.send("invalid id")
    } else {
      res.cookie('referer', adopter._id)
      res.redirect('/')
    }
  })
})

var server = app.listen(3069, function() {
  console.log('Listening on port %d', server.address().port);
})
