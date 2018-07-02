const child_pty = require('child_pty');
const debug = require('debug')('FlightTerminalService:ptyStream');
const socketio = require('socket.io');
const socketio_auth = require('socketio-auth');
const ss = require('socket.io-stream');

const config = require('./config.json');
const ptys = require('./ptysRegistry');
const authenticate = require('./auth');

function buildCmd(authConfigOverrides, config, options) {
  const authConfig = authConfigOverrides || { cmd: {} };
  return [
    authConfig.cmd.exe || config.cmd.exe,
    [ ...( authConfig.cmd.args || config.cmd.args ) ],
    options
  ];
}

function ptyStream(server) {
  const io = socketio(server, {path: config.socketIO.path})
    .of(config.socketIO.namespace);
  socketio_auth(io, {
    authenticate: authenticate,

    postAuthenticate: (socket, data) => {
      ss(socket).on('new', function(stream, options) {
        debug('New stream %o', ptys.streamDebug(stream));
        const cmd = buildCmd(socket.client.__terminalService__, config, options);
        debug('Running %o', cmd);
        const pty = child_pty.spawn(...cmd);

        pty.stdout.pipe(stream).pipe(pty.stdin);
        ptys.register(stream, pty);
        stream.on('end', function() {
          debug('Stream ended (%o)', stream);
          ptys.kill(stream);
        });
      });

    },
  });
}

process.on('exit', function() {
  ptys.killAll();
});

module.exports = exports = ptyStream;
