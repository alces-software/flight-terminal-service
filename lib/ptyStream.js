const child_pty = require('child_pty');
const debug = require('debug')('FlightTerminalService:ptyStream');
const socketio = require('socket.io');
const socketio_auth = require('socketio-auth');
const ss = require('socket.io-stream');
const jwt = require('jsonwebtoken');

const config = require('./config.json');
const ptys = require('./ptysRegistry');

const JSON_WEB_TOKEN_SECRET =
  process.env.JSON_WEB_TOKEN_SECRET ||
  "cabfa4559f1d674ee86e423a4a849f450393630dfc2c48b2a949efb8df510357f602b5cab6584668452d7e0eba961d5c88be6194d978eb1d7d5d55ce5ecbc204"

function authenticate(socket, data, callback) {
  jwt.verify(data.jwt, JSON_WEB_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      debug("Authentication failed: %o", err);
      return callback(err);
    } else {
      debug("Socket authenticated with JWT: %o", decoded);
      return callback(null, decoded.username === 'fred');
    }
  });
}

function ptyStream(server) {
  const io = socketio(server, {path: config.socketIO.path})
    .of(config.socketIO.namespace);
  socketio_auth(io, {
    authenticate: authenticate,

    postAuthenticate: (socket, data) => {
      ss(socket).on('new', function(stream, options) {
        debug('New stream %o', ptys.streamDebug(stream));

        const cmd = [config.cmd.exe, config.cmd.args, options];
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
