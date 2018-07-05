const http = require('http');
const debug = require('debug')('FlightTerminalService:server');
const fs = require('fs');

const config = require('./config.json');

const asset_re = new RegExp('^/' + config.staticFiles.prefix + '/static/(.*)');
const index_re = new RegExp('^/' + config.staticFiles.prefix + '(/(index.html)?)?');
const interface = process.env.INTERFACE || config.interface;
const port = process.env.PORT || config.port;

function staticFileServer(req, res) {
  const file = null;
  debug('Request for %s', req.url);

  const asset_match = req.url.match(asset_re);
  const index_match = req.url.match(index_re);

  if (asset_match) {
    file = '/public/static/' + asset_match[1];
  } else if (index_match) {
    file = '/public/static/index.html';
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('404 Not Found');
    return;
  }
  fs.createReadStream(__dirname + file).pipe(res);
}

const server = http.createServer();

server
  .on('request', staticFileServer)
  .listen(port, interface);

debug('Listening on %s:%s', interface, port);

module.exports = server;
