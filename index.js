var express = require('express'),
  hbs = require('hbs'),
  bodyParser = require('body-parser'),
  mysql = require('mysql'),
  config = require('../config')
  pool = mysql.createPool({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    typeCast: function (field, next) {
      if (field.type == "BIT" && field.length == 1) {
        var bit = field.string();

        return (bit === null) ? "pending" : bit.charCodeAt(0) === 1 ? "approved" : "declined";
      }

      return next();
    }
  }),
  _ = require('underscore'),
  basicAuth = require('basic-auth'),
  bunyan = require('bunyan'),
  passport = require('passport')
  session = require('express-session');
  bnetStrategy = require('passport-bnet').Strategy,
  cookieParser = require('cookie-parser');

var logger = bunyan.createLogger({
  name: 'tranquil-web',
  streams: [
    {
      level: 'info',
      path: config.logfile
    },
  ]
});

passport.serializeUser(function (user, done) {
  logger.info(user);
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(new bnetStrategy({
  clientID: config.bnet.key,
  clientSecret: config.bnet.secret,
  scope: "wow.profile",
  callbackURL: config.bnet.callback
}, function (accessToken, refreshToken, profile, done) {
  return done(null, profile);
}));

var app = express();
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use('/static', express.static(__dirname + '/static'));
app.set('views', __dirname + '/views');
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'blizzard', saveUninitialized: true, resave: true }));
app.use(passport.initialize());
app.use(passport.session());

var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.admin.user && user.pass === config.admin.password) {
    return next();
  } else {
    return unauthorized(res);
  };
};

var server = app.listen(config.port, function () {
  logger.info('tranquil-web started');
});

app.get('/', function (request, response) {
  logger.log('User is authenticated: ' + request.isAuthenticated());
  response.render('index', { isAuthenticated: request.isAuthenticated() });
});

app.get('/auth/bnet', passport.authenticate('bnet'));

app.get('/auth/bnet/callback', passport.authenticate('bnet', { failureRedirect: '/' }), function (request, response) {
  response.redirect('/');
});

app.post('/applications', function (request, response) {
  pool.getConnection(function (error, connection) {
    if (error)
      throw error;

    connection.query('INSERT INTO applications SET ?', {
      contents: JSON.stringify(request.body),
      created: new Date(),
    }, function (error, result) {
      if (error)
        throw error;

      response.send(request.body);

      connection.release();
    });
  });
});

app.get('/applications', auth, function (request, response) {
  pool.getConnection(function (error, connection) {
    if (error)
      throw error;

    connection.query('SELECT id, contents, approved FROM applications', function (error, results) {
      if (error)
        throw error;

      var applications = {
        applications: _.map(results, function (result) {
          var application = JSON.parse(result.contents.toString('utf8'));
          application['approved'] = result.approved;
          application['id'] = result.id;

          return application;
        })
      };

      response.render('applications', applications);

      connection.release();
    });
  });
});

app.get('/applications/:id/approve', auth, function (request, response) {
  var id = request.params.id;
  pool.getConnection(function (error, connection) {
    if (error)
      throw error;

    connection.query('UPDATE applications SET approved = ? WHERE id = ?', [1, id], function (error, results) {
      if (error)
        throw error;

      response.sendStatus(200);
    });
  });
});

app.get('/applications/:id/decline', auth, function (request, response) {
  var id = request.params.id;
  pool.getConnection(function (error, connection) {
    if (error)
      throw error;

    connection.query('UPDATE applications SET approved = ? WHERE id = ?', [0, id], function (error, results) {
      if (error)
        throw error;

      response.sendStatus(200);
    });
  });
});

app.use(function (error, request, response, next) {
  logger.error({ req: request, res: response, error: error }, error.stack);

  response.sendStatus(500);
});
