const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');
const child_pty = require('child_pty');
const ss = require('socket.io-stream');
const debug = require('debug')('FlightTerminalService');

const config = require('./config.json');
const ptys = require('./ptysRegistry');

const server = http.createServer()
  .listen(config.port, config.interface);

const asset_re = new RegExp('^/' + config.staticFilesPrefix + '/static/(.*)');
const index_re = new RegExp('^/' + config.staticFilesPrefix + '(/(index.html)?)?');

server.on('request', function(req, res) {
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
});

socketio(server, {path: config.socketIO.path}).of('pty').on('connection', (socket) => {
  // receives a bidirectional pipe from the client see index.html
  // for the client-side
  ss(socket).on('new', function(stream, options) {
    debug('New stream %o', ptys.streamDebug(stream));

    const cmd = [
      config.ssh.path,
      [ ...config.ssh.options, config.ssh.host ],
      options
    ];
    debug('Running %o', cmd);
    const pty = child_pty.spawn(...cmd);

    pty.stdout.pipe(stream).pipe(pty.stdin);
    ptys.register(stream, pty);
    stream.on('end', function() {
      debug('Stream ended (%o)', stream);
      ptys.kill(stream);
    });
  });
});

process.on('exit', function() {
  ptys.killAll();
});

debug('Listening on %s:%s', config.interface, config.port);
