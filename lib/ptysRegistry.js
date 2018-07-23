const debug = require('debug')('FlightTerminalService:PtysRegistry');

class PtysRegistry {
  constructor() {
    this.ptys = {};
  }

  register(stream, pty) {
    debug(
      'Registering pty %o for stream %o',
      this.ptyDebug(pty),
      this.streamDebug(stream)
    );
    this.ptys[stream.id] = { stream, pty };
  }

  get(streamId) {
    return this.ptys[streamId];
  }

  kill(stream) {
    const { pty } = this.ptys[stream.id];
    debug(
      'Killing pty %o for stream %o',
      this.ptyDebug(pty),
      this.streamDebug(stream)
    );
    pty.kill('SIGHUP');
    delete this.ptys[stream.id];
  }

  killAll() {
    debug('Killing all ptys');
    const streamIds = Object.keys(this.ptys);
    for(var i = 0; i < streamIds.length; i++) {
      const { pty } = this.ptys[i];
      pty.kill('SIGHUP');
    }
    this.ptys = {};
  }

  ptyDebug(pty) {
    return {
      pid: pty.pid,
      spawnargs: pty.spawnargs,
      ttyname: pty.pty.ttyname,
    };
  }

  streamDebug(stream) {
    return {
      streamId: stream.id,
      socketIOId: stream.socket && stream.socket.sio.id,
    };
  }
}

module.exports = exports = new PtysRegistry();
