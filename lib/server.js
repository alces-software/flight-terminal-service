const http = require('http');
const debug = require('debug')('FlightTerminalService:server');
const fs = require('fs');
const integration = require('./integration');

const config = require('./config.json');

const interface = process.env.INTERFACE || config.interface;
const port = process.env.PORT || config.port;

const routeMap = [
  {
    re: new RegExp('^/status(/)?$'),
    server: statusServer,
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
  if (integration.checkStatus) {
    integration.checkStatus(req, res);
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('200 OK');
  }
}

const server = http.createServer();

server
  .on('request', router)
  .listen(port, interface);

debug('Listening on %s:%s', interface, port);

module.exports = server;
