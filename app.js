var http = require('http'),
  fs = require('fs'),
  socketio = require('socket.io'),
  child_pty = require('child_pty'),
  ss = require('socket.io-stream'),
  debug = require('debug')('FlightTerminalService');

var config = require('./config.json');

var server = http.createServer()
  .listen(config.port, config.interface);

var ptys = {};
var asset_re = new RegExp('^/' + config.staticFilesPrefix + '/static/(.*)');
var index_re = new RegExp('^/' + config.staticFilesPrefix + '(/(index.html)?)?');

server.on('request', function(req, res) {
  var file = null;
  debug('Request for %s', req.url);

  var asset_match = req.url.match(asset_re);
  var index_match = req.url.match(index_re);

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

socketio(server, {path: config.socketIO.path}).of('pty').on('connection', function(socket) {
  // receives a bidirectional pipe from the client see index.html
  // for the client-side
  ss(socket).on('new', function(stream, options) {
    debug('New stream %o %o', stream, options);

    var sshArgs = [];
    for (var i=0; i<config.ssh.options.length; i++) {
      sshArgs.push(config.ssh.options[i]);
    }
    sshArgs.push(config.ssh.host);
    debug('Running %s with args %o', config.ssh.path, sshArgs);
    var pty = child_pty.spawn(config.ssh.path, sshArgs, options);

    pty.stdout.pipe(stream).pipe(pty.stdin);
    ptys[stream] = pty;
    stream.on('end', function() {
      debug('Stream ended (%o)', stream);
      pty.kill('SIGHUP');
      delete ptys[stream];
    });
  });
});

process.on('exit', function() {
  var k = Object.keys(ptys);
  var i;

  for(i = 0; i < k.length; i++) {
    ptys[k].kill('SIGHUP');
  }
});

debug('Listening on %s:%s', config.interface, config.port);
