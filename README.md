# Earlypage

Have you ever wanter to get email address from the visitors who likes to be the
first one to informed when your new app releases? Have you ever faced a problem
and wanted to notify users when everything was OK? Earlypage is what you might
need. It provides an API to quickly switch your website to earlypage and get
emails of users in order to be notified later.

## Features

- Easy to use API
- Multi-site support
- Multi-type registeration support (twitter, facebook, google)

## Getting Started

### Prerequisities

Earlypage needs [MongoDB](http;//mongodb.com), [Nodejs](http://nodejs.org) and
it's package manager **npm** to get started.

```
# apt-get install mongodb
# apt-get install nodejs npm
```

### Installing

After taking care of prerequisities, you can clone the git repo or download a
stable version from [released versions](https://github.com/FoundersBuddy/earlypage/releases), 
and install node dependencies.

```
git clone https://github.com/FoundersBuddy/earlypage.git
cd earlypage/manage
npm install
```

### Usage

#### Configuration

###### New sites

To add a new site to the earlypage instance, you have to add a key/value pair to
`firxtures` list in `manage/index.js`, where keys are the name of the sites and
values are another object containg the site data. As an example:

```javascript
fixtures["SITE_NAME"] = {
  // Site data                **Required**
  active: true,               // The website Status
  name: "SITE_NAME",          // The site name
  user: "USERNAME",           // The username to authenticate requests
  pass: "PASSWORD",           // Password
  
  /// **Required**
  /// The url which other sites will access earlypage with. 
  /// You can use xip.io to get an internal domain forwarding like following:
  /// http://PROJECT_NAME.127.0.0.1:xip.io.4000

  host: "EARLY_PAGE_ADDRESS_FOR_THIS_SITE",
  
  // Page redirect urls      **Optional**
  refid_param: "ref_id",
  url_landing: "http://cdn.PROJECT.com/earlypage/index.html",
  url_welcome: "http://cdn.PROJECT.com/earlypage/single.html",
  url_social_redirect: "http://localhost:8080/?success=true&invite_code=%s&token=%s",
  
  // Social authentication   **Optional**
  twitter_consumer_key: "",
  twitter_consumer_secret: "",

  google_client_id: "",
  google_client_secret: "",

  facebook_app_id: "",
  facebook_app_secret: ""
}
```

Earlypage will register or update each app definition on startup and will listen to their request.

#### Run

To start the service you just need to execute `manage/index.js` using node:

```bash
$ ndoe index.js
```

#### API
##### Registration request
A valid request to register user data will be as follow:

```javascript
request.get({
  url: 'REGISTERED_URL_FOR_YOUR_WEBSITE/api/welcome',
  auth: {
    'user' : 'USERNAME',
    'pass' : 'PASSWORD'
  },
  form: {
    'email' : user_email,
    'referrer' : referrer,
    'share_url': "www.YOUR_PROJECT.com/?ref_id={{ref_id}}"
  }
}
```

The request will save form data as registered user data. In the response, the
API will send you a `share_url` as a json key which contains a url with `ref_id`
to your project that will help you to follow your users who invites their friends. 

#### List of registred

You can get a json list of registred users together with their data by sending a
`GET` request to `REGISTERED_URL_FOR_YOUR_WEBSITE/list.json`

## Contributing

- Check for open issues or start a new one about your idea/problem. Please make sure descriptive data on the topic to help others to understand it.
- Fork the repository and create a new branch from the master branch, and apply your changes.
- Write a test which shows that your new implementation is fully operational.
- Send a pull request.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/FoundersBuddy/earlypage/releases). 

## Authors

See the list of [contributors](https://github.com/FoundersBuddy/earlypage/graphs/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
