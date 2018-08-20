const http = require('http');
const debug = require('debug')('FlightTerminalService:server');
const fs = require('fs');

const config = require('./config.json');

const interface = process.env.INTERFACE || config.interface;
const port = process.env.PORT || config.port;

const routeMap = [
  {
    re: new RegExp('^/status(/)?$'),
    server: statusServer,
  },
  {
    re: new RegExp('^/' + config.staticFiles.prefix + '/static/(.*)'),
    server: (req, res, match) => {
      const file = '/public/static/' + match[1];
      staticFileServer(res, file);
    },
  },
  {
    re: new RegExp('^/' + config.staticFiles.prefix + '(/(index.html)?)?$'),
    server: (req, res, match) => {
      const file = '/public/static/index.html';
      staticFileServer(res, file);
    }
  },
];

function router(req, res) {
  debug('Request for %s', req.url);
  for ( var i=0; i<routeMap.length; i+=1) {
    var route = routeMap[i];
    var match = req.url.match(route.re);
    if (match) {
      debug('Matched by route %o', route);
      route.server(req, res, match);
      return;
    }
  }
  debug('Not matched by any route');
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('404 Not Found');
}

function statusServer(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('200 OK');
}

function staticFileServer(res, file) {
  const readStream = fs.createReadStream(__dirname + file);
  readStream.on('error', (err) => {
    if (err.code === 'ENOENT') {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('404 Not Found');
    } else {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end('500 Internal Server Error');
    }
  });
  readStream.pipe(res);
}

const server = http.createServer();

server
  .on('request', router)
  .listen(port, interface);

debug('Listening on %s:%s', interface, port);

module.exports = server;
