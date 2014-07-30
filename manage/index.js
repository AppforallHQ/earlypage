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
  user: "trifork",
  pass: "t",
  host: "trifork.127.0.0.1.xip.io:3069",
  url_landing: "http://localhost:8069/static/landing-ajax.html",
  url_welcome: null,
  active: true
}

var mongoose = require("mongoose")
mongoose.connect("mongodb://localhost/earlypage")

var User = mongoose.model('User', {
  name: String,
  user: {
    type: String,
    unique: true
  },
  pass: String,
  host: String,
  url_landing: String,
  url_welcome: String,
  active: Boolean
})

var ShortID = require('mongoose-shortid')

var EarlyAdopter = mongoose.model('EarlyAdopter', {
  referer: {
    type: ShortID, ref: 'EarlyAdopter'
  },
  email: String,
  created_at: Date,
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User'
  },
  _id: {
    type: ShortID,
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
    app = express(),
    passport = require("passport"),
    BasicStrategy = require('passport-http').BasicStrategy

app.use(passport.initialize());
app.use(require("cookie-parser")("super-secret-string"))
app.use(require("body-parser")());

//TODO: Add nice stylish 500 errors
//      Return proper status codes

app.use(function(req, res, next) {
  User.findOne({host: req.headers.host}, function(err, user) {
    if (!user) {
      res.status(500).send("Host not configured")
    } else if (!user.active) {
      var msg = "You are accessing page for " +
                user.name + ", but the earlypage is not active"
      res.status(500).send(msg)
    } else {
      req.ep_user = user
      next()
    }
  })
})

app.use(function(req, res, next) {
  EarlyAdopter.findOne({_id: req.cookies.referer}, function(err, obj) {
    if(!obj) {
      res.clearCookie("referer")
    }
    next()
  })
})

var Mustache = require("mustache")
var request = require("request")

var render_landing_page = function (req, res, context) {
  request(req.ep_user.url_landing, function(_l_err, _l_resp, _l_body) {
    if (_l_err) {
      return res.status(500).send('Couldnt access landing static page')
    } else {
      return res.send(Mustache.render(_l_body, context))
    }
  })
}

app.get("/", function(req, res) {
  //TODO: MIGHT NEED REFACTOR, ALONG WITH THE PART OF CODE LABLED WITH XXXXXX
  var context = {
    "name": req.ep_user.name,
    "form_action": "/"
  }
  return render_landing_page(req, res, context)
})

var validator = require('validator')

var get_welcome_page_context = function(req, res, callback) {
  EarlyAdopter.count({user: req.ep_user._id}, function(err, count) {
    var context = {
      "queue_length": count,
      "share_url": (req.protocol + '://' + req.get('host') + req.originalUrl)
    }
    callback(context)
  })
}

app.post("/", function(req, res) {
  var adopter_obj = {
    referer: req.cookies.referer,
    email: req.body.email,
    created_at: Date.now(),
    user: req.ep_user._id,
  }

  var adopter_query =  {user: adopter_obj.user, email: adopter_obj.email}

  //TODO: MIGHT NEED REFACTOR SOMEHOW (XXXXXX)
  var context = {
    "name": req.ep_user.name,
    "form_action": "/",
  }

  if (!validator.isEmail(adopter_obj.email)) {
    //TODO: MIGHT NEED REFACTOR SOMEHOW (XXXXXX)
    context["errors"] = [{"code": "invalid-email-address"}]

    if (req.xhr) {
      return res.status(400).json(context)
    } else {
      return render_landing_page(req, res, context)
    }
  }

  EarlyAdopter.findOne(adopter_query, function(err, obj) {
    if(!obj) {
      EarlyAdopter.create(adopter_obj, function(err, obj) {
        res.cookie('current_adopter_id', obj._id)
        var share_url = '/r/' + obj._id

        if (req.xhr) {
          get_welcome_page_context(req, res, function(context) {
            res.json(context)
          })
        } else {
          res.redirect(share_url)
        }
      })
    } else {
      context["errors"] = [{"code": "already-registered"}]

      if (req.xhr) {
        return res.status(400).json(context)
      } else {
        return render_landing_page(req, res, context)
      }
    }
  })
})

app.get("/r/:short_id", function(req, res) {
  var short_id = req.param("short_id")

  EarlyAdopter.findOne({user: req.ep_user._id, _id: short_id}, function(err, adopter) {
    if(!adopter) {
      res.status(400).send("ERROR: Invalid referer ID")
    } else if(req.ep_user.url_welcome != null && short_id == req.cookies.current_adopter_id) {
      request(req.ep_user.url_welcome, function(_w_err, _w_resp, _w_body) {
        if (_w_err) {
          res.status(500).send('ERROR: Cannot access welcome static page')
        } else {
          get_welcome_page_context(req, res, function(context) {
            res.send(Mustache.render(_w_body, context))
          })
        }
      })
    } else {
      res.cookie('referer', adopter._id)
      res.redirect('/')
    }
  })
})

passport.use(new BasicStrategy(
  function(user, pass, done) {
    User.findOne({ user: user }, function (err, user) {
      if (err) { return done(err) }
      if (!user) { return done(null, false) }
      if (user.pass != pass) { return done(null, false); }
      return done(null, user);
    });
  }
));

app.get("/list.json",
  passport.authenticate("basic", {session: false}),
  function(req, res) {
    //DANGER ZONE
    //MUST DO BETTER THAN THIS
    //MAYBE ANOTHER PASSPORT STRATEGY WHICH ALLOWS US TO CHECK FOR REUQUEST PARAMS
    //OR HANDLE IT IN A MIDDLEWARE
    if (req.user && !req.ep_user._id.equals(req.user._id)) {
      return res.status(403).send("ERROR: Invalid user")
    }
    //END DANGER ZONE

    EarlyAdopter.find({user: req.ep_user._id}).lean().exec(function(err, objs) {
      return res.end(JSON.stringify(objs))
    })
  }
)

var server = app.listen(3069, function() {
  console.log('Listening on port %d', server.address().port);
})
