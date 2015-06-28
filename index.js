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

        return (bit === null) ? null : bit.charCodeAt(0);
      }

      return next();
    }
  }),
  _ = require('underscore'),
  basicAuth = require('basic-auth');

var app = express();
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use('/static', express.static(__dirname + '/static'));
app.set('views', __dirname + '/views');

app.use(bodyParser.json());

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
  console.log('tranquil-web started');
});

app.get('/', function (request, response) {
  response.render('index');
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

    connection.query('SELECT contents, approved FROM applications', function (error, results) {
      if (error)
        throw error;

      var applications = {
        applications: _.map(results, function (result) {
          var application = JSON.parse(result.contents.toString('utf8'));
          application['approved'] = result.approved;

          return application;
        })
      };

      response.render('applications', applications);

      connection.release();
    });
  })
});
