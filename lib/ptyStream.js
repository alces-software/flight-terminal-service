const child_pty = require('child_pty');
const child_process = require('child_process');
const debug = require('debug')('FlightTerminalService:ptyStream');
const socketio = require('socket.io');
const socketio_auth = require('socketio-auth');
const ss = require('socket.io-stream');

const config = require('./config.json');
const ptys = require('./ptysRegistry');
const authenticate = require('./integration');

function buildCmd(authConfigOverrides, config, options) {
  const authConfig = authConfigOverrides || { cmd: {} };
  return [
    authConfig.cmd.exe || config.cmd.exe,
    [ ...( authConfig.cmd.args || config.cmd.args ) ],
    { 
      ...options,
      env: {
        ...options.env || {},
        ...authConfig.cmd.env || {}
      }
    }
  ];
}

const defaultAuthConfigOverrides = { cmd: {} };

function ptyStream(server) {
  const io = socketio(server, {path: config.socketIO.path})
    .of(config.socketIO.namespace);
  io.on('connection', function(socket) {
    debug('Socket %s connected awaiting authentication', socket.id);
  });
  socketio_auth(io, {
    authenticate: authenticate,

    timeout: 4000,

    postAuthenticate: (socket, data) => {
      const authConfigOverrides = socket.client.__terminalService__
        || defaultAuthConfigOverrides;

      socket.on('disconnect', () => {
        ptys.killSocket(socket);
        if (authConfigOverrides.onStreamEnd) {
          authConfigOverrides.onStreamEnd();
        }
      });

      ss(socket).on('new', function(stream, options) {
        debug('New stream %o', ptys.streamDebug(stream));
        reconfigureIfNecessary(authConfigOverrides).then(() => {
          const cmd = buildCmd(authConfigOverrides, config, options);
          debug('Running %o', cmd);
          const pty = child_pty.spawn(...cmd);

          pty.stdout.pipe(stream).pipe(pty.stdin);
          ptys.register(socket, stream, pty);
          stream.on('end', function() {
            debug('Stream ended (%o)', stream);
            ptys.killStream(stream);
            if (authConfigOverrides.onStreamEnd) {
              authConfigOverrides.onStreamEnd();
            }
          });
        });
      });

      socket.on('resize', (streamId, size) => {
        debug('Resizing stream %s to %o', streamId, size);
        if (!ptys.has(streamId)) {
          debug('Stream %s not found. Unable to resize', streamId);
          return;
        }
        const { pty } = ptys.get(streamId);
        let args = [ '-F', pty.pty.ttyname ];
        if (size.columns != null) {
          args = args.concat(['columns', size.columns])
        }
        if (size.rows != null) {
          args = args.concat(['rows', size.rows])
        }
        child_process.spawnSync('/bin/stty', args);
      });
    },
  });
}

function reconfigureIfNecessary(authConfigOverrides) {
  if (authConfigOverrides.needsReconfigure) {
    debug('Reconfiguration of stream required');
    return authConfigOverrides.reconfigure();
  } else {
    return Promise.resolve(null);
  }
}

process.on('exit', () => { ptys.killAll(); });
process.on('SIGINT', () => { process.exit(); });

module.exports = exports = ptyStream;
