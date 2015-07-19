var fixtures = []

fixtures["PROJECT"] = {
  name: "PROJECT",
  user: "PROJECT",
  pass: "",
  host: "127.0.0.1:4000/PROJECT",
  url_landing: "http://cdn.PROJECT.com/earlypage/index.html",
  url_welcome: "http://cdn.PROJECT.com/earlypage/single.html",
  active: true
}

fixtures["PROJECT2"] = {
  name: "PROJECT2",
  user: "PROJECT2",
  pass: "",
  host: "127.0.0.1:4000/PROJECT2",
  url_landing: "http://cdn.PROJECT.com/earlypage/index.html",
  url_welcome: "http://cdn.PROJECT.com/earlypage/single.html",
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
  jsonp: Boolean,
  url_landing: String,
  url_welcome: String,
  url_social_redirect: String,
  twitter_consumer_key: String,
  twitter_consumer_secret: String,
  google_client_id: String,
  google_client_secret: String,
  facebook_app_id: String,
  facebook_app_secret: String,
  refid_param: String,
  active: Boolean
})

var shortId = require('shortid');

var EarlyAdopter = mongoose.model('EarlyAdopter', {
  referrer: {
    type: String, ref: 'EarlyAdopter'
  },
  email: String,
  twitter: String,
  facebook: mongoose.Schema.Types.Mixed,
  google: String,
  created_at: Date,
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User'
  },
  _id: {
    type: String,
    unique: true,
    'default': shortId.generate
  },
  token: {
    type: String,
    unique: true,
    'default': shortId.generate
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

        if(obj.google_client_id != null) {
          console.log('creating passport google for ' + obj.name)

          passport.use('google-' + obj.name, new GoogleStrategy({
              clientID: obj.google_client_id,
              clientSecret: obj.google_client_secret,
              callbackURL: "http://" + obj.host + "/auth/google/callback"
            },
            function(token, tokenSecret, profile, done) {
              done(null, profile)
            }
          ))
        }

        if(obj.facebook_app_id != null) {
          console.log('creating passport facebook for ' + obj.name)

          passport.use('facebook-' + obj.name, new FacebookStrategy({
              clientID: obj.facebook_app_id,
              clientSecret: obj.facebook_app_secret,
              callbackURL: "http://" + obj.host + "/auth/facebook/callback"
            },
            function(token, tokenSecret, profile, done) {
              done(null, profile)
            }
          ))
        }

      }

      if(!obj) {
        console.log('inserting ' + fixture.name)
        User.create(fixture, function(err, obj) {
          //FIXME: we must create passport twitter strategies in another way
          create_passport(fixture)
        })
      } else {
        console.log('updating ' + obj.name)
        User.update(obj, fixture, function(err, obj) {
          create_passport(fixture)
        })
      }
    })
  })(fixture)
}

var express = require("express"),
    app = express(),
    Router = express.Router(),
    passport = require("passport"),
    BasicStrategy = require('passport-http').BasicStrategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    url = require("url"),
    util = require("util")

app.use(require('express-session')({secret: 'flying omnibus'}))
app.use(passport.initialize())
app.use(passport.session())
app.use(require("cookie-parser")("super-secret-string"))
app.use(require("body-parser")())
app.use('/[A-Za-z0-9_]+', Router)

//TODO: Add nice stylish 500 errors
//      Return proper status codes

Router.use(function(req, res, next) {
    var user = req.originalUrl.substr(0, req.originalUrl.indexOf('/', 1));
	  var host = req.headers.host + user;
    User.findOne({host: host}, function(err, user) {
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

Router.use(function(req, res, next) {
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

var get_base_context_based_on_req = function(req) {
  var context = {
    "name": req.ep_user.name,
    "form_action": build_full_url(req, "/signup")
  }

  return context
}

var build_full_url = function(req, path) {
  return (req.protocol + '://' + req.get('host') + path)
}

Router.get("/", function(req, res) {
  //TODO: MIGHT NEED REFACTOR, ALONG WITH THE PART OF CODE LABLED WITH XXXXXX
  var context = get_base_context_based_on_req(req)
  return render_landing_page(req, res, context)
})

var context_from_adopter_obj = function(req, obj, callback, error) {

  var context = get_base_context_based_on_req(req)
  context.error = error

  var share_url = '/r/' + obj._id

    //ZOMG THIS IS DIRTY
  context["share_url"] = build_full_url(req, share_url)
  context["encoded_share_url"] = encodeURIComponent(context["share_url"])
  context["invite_code"] = obj._id

  get_queue_length(req, function(count) {
    context["queue_length"] = count
    return callback(context)
  })
}

Router.get("/query", function(req, res) {
  EarlyAdopter.findOne({token: req.query.token, _id: req.query.invite_code}, function(err, obj) {
    if(obj) {
      context_from_adopter_obj(req, obj, function(context) {
        res.jsonp(context)
      })
    } else {
      return res.jsonp({'error': 'no-such-user'})
    }
  })
})

var validator = require('validator')
var get_referrer_from_url = function(req) {
  if (req.headers.referer) {
    return url.parse(req.headers.referer, true).query[req.ep_user.refid_param]
  } else {
    return null
  }
}

var get_queue_length = function(req, callback) {
  EarlyAdopter.count({user: req.ep_user._id}, function(err, count) {
    callback(count)
  })
}

var sign_up = function(registration_data, req, res, callback) {

  var context = {}

  var referrer_from_url = get_referrer_from_url(req);

  var adopter_obj = {
    referrer: req.cookies.referrer || registration_data.referrer || referrer_from_url,
    
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
  } else if(registration_data.type == "google") {
    adopter_obj.google = registration_data.value
    adopter_query.google = registration_data.value
  } else if(registration_data.type == "facebook") {
    adopter_obj.facebook = registration_data.value
    adopter_query.facebook = registration_data.value
  }

  EarlyAdopter.findOne(adopter_query, function(err, obj) {
    if(!obj) {
      EarlyAdopter.create(adopter_obj, function(err, obj) {
        context_from_adopter_obj(req, obj, callback)
      })
    } else {
      context_from_adopter_obj(req, obj, callback, "already-registered")
    }
  })
}

Router.post("/signup", function(req, res) {
  sign_up({type: "email", value: req.body.email}, req, res, function(context) {
    if(context["error"] != null) {
      return render_landing_page(req, res, context)
    } else {
      res.cookie('current_adopter_id', context.invite_code)
      res.redirect(context.share_url)
    }
  })
})

Router.get("/signup", function(req, res) {
  //TODO: MIGHT NEED REFACTOR SOMEHOW (XXXXXX)
  sign_up({type: "email", value: req.query.email}, req, res, function(context) {
    if(context["error"] != null) {
      return res.jsonp(context)
    } else {
      res.jsonp(context)
    }
  })
})

Router.get('/twitter-success', function(req, res) {
  if(req.user) {
    sign_up({type: "twitter", value: req.user}, req, res, function(context) {
      EarlyAdopter.findOne({_id: context.invite_code}, function(err, obj) {
        var path = util.format(req.ep_user.url_social_redirect, context.invite_code, obj.token)
        res.redirect(path)
      })
    })
  } else {
    res.redirect('/twitter-failure')
  }
})

Router.get('/google-success', function(req, res) {
  if(req.user) {
    sign_up({type: "google", value: req.user}, req, res, function(context) {
      EarlyAdopter.findOne({_id: context.invite_code}, function(err, obj) {
        var path = util.format(req.ep_user.url_social_redirect, context.invite_code, obj.token)
        res.redirect(path)
      })
    })
  } else {
    res.redirect('/google-failure')
  }
})

Router.get('/facebook-success', function(req, res) {
  if(req.user) {
    sign_up({type: "facebook", value: req.user}, req, res, function(context) {
      EarlyAdopter.findOne({_id: context.invite_code}, function(err, obj) {
        var path = util.format(req.ep_user.url_social_redirect, context.invite_code, obj.token)
        res.redirect(path)
      })
    })
  } else {
    res.redirect('/facebook-failure')
  }
})


passport.serializeUser(function(user, done) {
  if(user.provider == "facebook") {
    var info = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      name: user.name,
      profileUrl: user.profileUrl
    }

    done(null, info)
  }
  if(user.provider == "google") {
    done(null, user._json.email)
  } else {
    done(null, user.username)
  }
})

passport.deserializeUser(function(id, done) {
  done(null, id)
});

Router.get("/auth/twitter", function(req, res, next) {
  var referrer = get_referrer_from_url(req)
  res.cookie('referrer', referrer)
  passport.authenticate('twitter-'+req.ep_user.name)(req, res, next)
})

Router.get("/auth/google", function(req, res, next) {
  var referrer = get_referrer_from_url(req)
  res.cookie('referrer', referrer)
  passport.authenticate('google-'+req.ep_user.name,
    {scope: 'https://www.google.com/m8/feeds https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'}
  )(req, res, next)
})

Router.get("/auth/facebook", function(req, res, next) {
  var referrer = get_referrer_from_url(req)
  res.cookie('referrer', referrer)
  passport.authenticate('facebook-'+req.ep_user.name
  )(req, res, next)
})

Router.get('/auth/twitter/callback', function(req, res, next) {
  passport.authenticate('twitter-' + req.ep_user.name, {
    successRedirect: '/twitter-success',
    failureRedirect: '/twitter-failure'
  })(req, res, next)
})

Router.get('/auth/google/callback', function(req, res, next) {
  passport.authenticate('google-' + req.ep_user.name, {
    successRedirect: '/google-success',
    failureRedirect: '/google-failure'
  })(req, res, next)
})

Router.get('/auth/facebook/callback', function(req, res, next) {
  passport.authenticate('facebook-' + req.ep_user.name, {
    successRedirect: '/facebook-success',
    failureRedirect: '/facebook-failure'
  })(req, res, next)
})


Router.get("/r/:short_id", function(req, res) {
  var short_id = req.param("short_id")

  EarlyAdopter.findOne({user: req.ep_user._id, _id: short_id}, function(err, adopter) {
    if(!adopter) {
      res.status(400).send("ERROR: Invalid referrer ID")
    } else if(req.ep_user.url_welcome != null && short_id == req.cookies.current_adopter_id) {
      request(req.ep_user.url_welcome, function(_w_err, _w_resp, _w_body) {
        if (_w_err) {
          res.status(500).send('ERROR: Cannot access welcome static page')
        } else {
          context_from_adopter_obj(req, adopter, function(context) {
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

Router.get("/list.json",
  passport.authenticate("basic", {session: false}),
  function(req, res) {
    //DANGER ZONE
      console.log('here')
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


Router.get("/*/api/landing",
  passport.authenticate("basic", {session: false}),
  function(req, res) {
    if (req.user && !req.ep_user._id.equals(req.user._id)) {
      return res.status(403).send("ERROR: Invalid user")
    }
    var ret = {}
    var short_id = req.param('referrer')
    EarlyAdopter.findOne({user: req.ep_user._id, _id: short_id}, function(err, adopter) {
      if(adopter && (req.ep_user.url_welcome == null || short_id != req.param('current_adopter_id'))) {
        ret.referrer = adopter._id;
      }
      EarlyAdopter.count({user: req.ep_user._id},function(err,c){
        ret.query_length = c;
        return res.end(JSON.stringify(ret))
      });
    });
  }
)



Router.get("/*/api/welcome",
  passport.authenticate("basic", {session: false}),
  function(req, res) {
    if (req.user && !req.ep_user._id.equals(req.user._id)) {
      return res.status(403).send("ERROR: Invalid user")
    }
    var short_id = req.param("referrer");
    EarlyAdopter.findOne({user: req.ep_user._id, _id: short_id}, function(err, adopter) {
      var referrer = null;
      if(adopter && (req.ep_user.url_welcome == null || short_id != req.param('current_adopter_id'))) {
        referrer = adopter._id;
      }
      sign_up({type: "email", value: req.param('email'), referrer: referrer}, req, res, function(context) {
        if (req.param("share_url") && context["error"]==null) {
          context["share_url"] = req.param("share_url").replace("{{ref_id}}",context["invite_code"]);
          context["encoded_share_url"] = encodeURIComponent(context["share_url"])
        }
        //To set cookie on client
        context['current_adopter_id']=context.invite_code;
        return res.jsonp(context)
      })
    });
  }
)




var server = app.listen(process.env.PORT, function() {
  console.log('Listening on port %d', server.address().port);
})
