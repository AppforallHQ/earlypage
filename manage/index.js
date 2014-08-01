var fixtures = []

fixtures["PROJECT"] = {
  name: "اپفورال",
  user: "PROJECT",
  pass: "",
  host: "PROJECT.127.0.0.1.xip.io:3069",
  url_landing: "http://localhost:8069/static/landing.html",
  url_welcome: "http://localhost:8069/static/welcome.html",
  active: true
}

fixtures["TRIFORK"] = {
  name: "ترایفورک",
  user: "trifork",
  pass: "t",
  host: "trifork.127.0.0.1.xip.io:3069",
  url_landing: "http://localhost:8069/static/landing-ajax.html",
  url_welcome: null,
  active: true
}

fixtures["PROJECT3"] = {
  name: "سیرکل",
  user: "PROJECT3",
  pass: "PROJECT3",
  host: "PROJECT3.127.0.0.1.xip.io:3069",
  jsonp: true,
  url_landing: "http://localhost:8069/static/landing-jsonp.html",
  url_welcome: "http://localhost:8069/static/welcome-jsonp.html",
  url_social_redirect: "http://localhost:8080/early_acess_success_page?ref_id=%s",
  active: true,
  refid_param: "ref_id",
  twitter_consumer_key: "",
  twitter_consumer_secret: "",

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
  jsonp: Boolean,
  url_landing: String,
  url_welcome: String,
  url_social_redirect: String,
  twitter_consumer_key: String,
  twitter_consumer_secret: String,
  refid_param: String,
  active: Boolean
})

var ShortID = require('mongoose-shortid')

var EarlyAdopter = mongoose.model('EarlyAdopter', {
  referrer: {
    type: ShortID, ref: 'EarlyAdopter'
  },
  email: String,
  twitter: String,
  google: String,
  facebook: String,
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

for (var fixture in fixtures) {
  fixture = fixtures[fixture];

  (function (fixture) {
    User.findOne({name: fixture.name}, function(err, obj) {
      var create_passport = function(obj) {
        if(obj.twitter_consumer_key != null) {
          console.log('creating passport twitter for ' + obj.name)

          passport.use('twitter-' + obj.name, new TwitterStrategy({
              consumerKey: obj.twitter_consumer_key,
              consumerSecret: obj.twitter_consumer_secret,
              callbackURL: "http://" + obj.host + "/auth/twitter/callback"
            },
            function(token, tokenSecret, profile, done) {
              done(null, profile)
            }
          ))
        }
      }

      if(!obj) {
        console.log('inserting' + fixture.name)
        User.create(fixture, function(err, obj) {
          //FIXME: we must create passport twitter strategies in another way
          create_passport(fixture)
        })
      } else {
        console.log('updating ' + obj.name)
        User.update(obj, fixture)
        //FIXME: we must create passport twitter strategies in another way
        create_passport(fixture)
      }
    })
  })(fixture)
}

var express = require("express"),
    app = express(),
    passport = require("passport"),
    BasicStrategy = require('passport-http').BasicStrategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    url = require("url"),
    util = require("util")

app.use(require('express-session')({secret: 'flying omnibus'}))
app.use(passport.initialize())
app.use(passport.session())
app.use(require("cookie-parser")("super-secret-string"))
app.use(require("body-parser")())



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
  EarlyAdopter.findOne({_id: req.cookies.referrer}, function(err, obj) {
    if(!obj) {
      res.clearCookie("referrer")
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
    "form_action": "/signup"
  }
  return render_landing_page(req, res, context)
})

var validator = require('validator')
var get_referrer_from_url = function(req) {
  if (req.headers.referer) {
    return url.parse(req.headers.referer, true).query[req.ep_user.refid_param]
  } else {
    return null
  }
}

var get_queue_length = function(req, res, callback) {
  EarlyAdopter.count({user: req.ep_user._id}, function(err, count) {
    callback(count)
  })
}

var sign_up = function(registration_data, req, res, callback) {

  var context = {
    "name": req.ep_user.name,
    "form_action": "/signup",
  }

  var referrer_from_url = get_referrer_from_url(req);

  var adopter_obj = {
    referrer: req.cookies.referrer || referrer_from_url,
    // registration_data: registration_data,
    created_at: Date.now(),
    user: req.ep_user._id,
  }

  var adopter_query =  {user: adopter_obj.user}

  if (registration_data.type == "email") {
    adopter_obj.email = registration_data.value
    adopter_query.email = registration_data.value

    if (!validator.isEmail(adopter_obj.email)) {
      //TODO: MIGHT NEED REFACTOR SOMEHOW (XXXXXX)
      context["error"] = "invalid-email"

      return callback(context)
    }

  } else if(registration_data.type == "twitter") {
    adopter_obj.twitter = registration_data.value
    adopter_query.twitter = registration_data.value
  }

  var return_obj_context =  function(obj) {
    res.cookie('current_adopter_id', obj._id)
    var share_url = '/r/' + obj._id

      //ZOMG THIS IS DIRTY
    context["share_url"] = req.protocol + '://' + req.get('host') + share_url
    context["invite_code"] = obj._id
    get_queue_length(req, res, function(count) {
      context["queue_length"] = count
      return callback(context)
    })
  }

  EarlyAdopter.findOne(adopter_query, function(err, obj) {
    if(!obj) {
      EarlyAdopter.create(adopter_obj, function(err, obj) {
        return return_obj_context(obj)
      })
    } else {
      context["error"] = "already-registered"
      return return_obj_context(obj)
    }
  })
}

app.get("/signup", function(req, res) {
  //TODO: MIGHT NEED REFACTOR SOMEHOW (XXXXXX)
  sign_up({type: "email", value: req.query.email}, req, res, function(context) {
    if(context["error"] != null) {
      if (req.ep_user.jsonp === true) {
        return res.jsonp(context)
      } else {
        return render_landing_page(req, res, context)
      }
    } else {
      if (req.ep_user.jsonp === true) {
        res.jsonp(context)
      } else {
        res.redirect(share_url)
      }
    }
  })
})

app.get('/twitter-success', function(req, res) {
  if(req.user) {
    sign_up({type: "twitter", value: req.user}, req, res, function(context) {
      res.redirect(util.format(req.ep_user.url_social_redirect, context.invite_code))
      // res.json(context)
    })
  } else {
    res.redirect('/twitter-failure')
  }
})


passport.serializeUser(function(user, done) {
  done(null, user.username)
})

passport.deserializeUser(function(id, done) {
  done(null, id)
});

app.get("/auth/twitter", function(req, res, next) {
  var referrer = get_referrer_from_url(req)
  res.cookie('referrer', referrer)
  passport.authenticate('twitter-'+req.ep_user.name)(req, res, next)
})

app.get('/auth/twitter/callback', function(req, res, next) {
  passport.authenticate('twitter-' + req.ep_user.name, {
    successRedirect: '/twitter-success',
    failureRedirect: '/twitter-failure'
  })(req, res, next)
})



app.get("/r/:short_id", function(req, res) {
  var short_id = req.param("short_id")

  EarlyAdopter.findOne({user: req.ep_user._id, _id: short_id}, function(err, adopter) {
    if(!adopter) {
      res.status(400).send("ERROR: Invalid referrer ID")
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
      res.cookie('referrer', adopter._id)
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

var server = app.listen(process.env.PORT, function() {
  console.log('Listening on port %d', server.address().port);
})
