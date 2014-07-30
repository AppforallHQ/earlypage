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
app.use(require("body-parser")());

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

var Mustache = require("mustache")
var request = require("request")

app.get("/", function(req, res) {
  request(req.user.url_landing, function(_l_err, _l_resp, _l_body) {
    if (_l_err) {
      res.status(500).send('Couldnt access landing static page')
    } else {
      var context = {
        "name": req.user.name,
        "form_action": "/"
      }
      res.send(Mustache.render(_l_body, context))
    }
  })
})

app.post("/", function(req, res) {
  var adopter_obj = {
    referer: req.cookies.adopter_referer,
    email: req.body.email,
    created_at: Date.now(),
    user: req.user._id,
  }

  var adopter_query =  {user: adopter_obj.user, email: adopter_obj.email}
  console.log(adopter_query)

  EarlyAdopter.findOne(adopter_query, function(err, obj) {
    if(!obj) {
      EarlyAdopter.create(adopter_obj, function(err, obj) {
        res.cookie('current_adopter_id', obj._id)
        var share_url = '/r/' + obj._id
        if (req.xhr) {
          //handle ajax
        } else {
          res.redirect(share_url)
        }
      })
    } else {
      res.send("ERROR: you have already registered")
    }
  })
})

app.get("/r/:short_id", function(req, res) {
  var short_id = req.param("short_id")

  EarlyAdopter.findOne({_id: short_id}, function(err, adopter) {
    if(!adopter) {
      res.send("invalid id")
    } else if(short_id == req.cookies.current_adopter_id) {
      request(req.user.url_welcome, function(_w_err, _w_resp, _w_body) {
        if (_w_err) {
          res.status(500).send('Couldnt access welcome static page')
        } else {
          var context = {
            "queue_length": 0,
            "share_url": (req.protocol + '://' + req.get('host') + req.originalUrl)
          }
          res.send(Mustache.render(_w_body, context))
        }
      })
    } else {
      res.cookie('referer', adopter._id)
      res.redirect('/')
    }
  })
})

var server = app.listen(3069, function() {
  console.log('Listening on port %d', server.address().port);
})
