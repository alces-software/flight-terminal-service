const child_pty = require('child_pty');
const child_process = require('child_process');
const debug = require('debug')('FlightTerminalService:ptyStream');
const socketio = require('socket.io');
const socketio_auth = require('socketio-auth');
const ss = require('socket.io-stream');

const integration = require('./integration');
const ptys = require('./ptysRegistry');
const staticConfig = require('./config.json');
const utils = require('./utils');

function buildCmd(integrationConfig, staticConfig, options) {
  integrationConfig = integrationConfig || { cmd: {} };
  return [
    integrationConfig.cmd.exe || staticConfig.cmd.exe,
    [ ...( integrationConfig.cmd.args || staticConfig.cmd.args ) ],
    { 
      ...options,
      env: {
        ...options.env || {},
        ...integrationConfig.cmd.env || {}
      }
    }
  ];
}

const defaultIntegrationConfig = { cmd: {} };

function ptyStream(server) {
  const io = socketio(server, {path: staticConfig.socketIO.path})
    .of(staticConfig.socketIO.namespace);
  io.on('connection', function(socket) {
    debug('Socket %s connected awaiting authentication', socket.id);
  });
  socketio_auth(io, {
    authenticate: integration.authenticate,

    timeout: 4000,

    postAuthenticate: (socket, data) => {
      const integrationConfig = utils.getConfiguration(socket)
        || defaultIntegrationConfig;

      socket.on('disconnect', () => {
        ptys.killSocket(socket);
        if (integrationConfig.onStreamEnd) {
          integrationConfig.onStreamEnd();
        }
      });

      ss(socket).on('new', function(stream, options) {
        debug('New stream %o', ptys.streamDebug(stream));
        reconfigureIfNecessary(integrationConfig).then(() => {
          const cmd = buildCmd(integrationConfig, staticConfig, options);
          debug('Running %o', cmd);
          const pty = child_pty.spawn(...cmd);

          pty.stdout.pipe(stream).pipe(pty.stdin);
          ptys.register(socket, stream, pty);
          stream.on('end', function() {
            debug('Stream ended (%o)', stream);
            ptys.killStream(stream);
            if (integrationConfig.onStreamEnd) {
              integrationConfig.onStreamEnd();
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

function reconfigureIfNecessary(integrationConfig) {
  if (integrationConfig.needsReconfigure) {
    debug('Reconfiguration of stream required');
    return integrationConfig.reconfigure();
  } else {
    return Promise.resolve(null);
  }
}

process.on('exit', () => { ptys.killAll(); });
process.on('SIGINT', () => { process.exit(); });

module.exports = exports = ptyStream;
