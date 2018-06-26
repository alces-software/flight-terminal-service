const child_pty = require('child_pty');
const debug = require('debug')('FlightTerminalService:ptyStream');
const socketio = require('socket.io');
const ss = require('socket.io-stream');

const config = require('./config.json');
const ptys = require('./ptysRegistry');

function ptyStream(server) {
  socketio(server, {path: config.socketIO.path})
    .of(config.socketIO.namespace)
    .on('connection', (socket) => {
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
}

process.on('exit', function() {
  ptys.killAll();
});

module.exports = exports = ptyStream;
