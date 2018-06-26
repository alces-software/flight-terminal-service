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
    this.ptys[stream] = pty;
  }

  kill(stream) {
    const pty = this.ptys[stream];
    debug(
      'Killing pty %o for stream %o',
      this.ptyDebug(pty),
      this.streamDebug(stream)
    );
    pty.kill('SIGHUP');
    delete this.ptys[stream];
  }

  killAll() {
    debug('Killing all ptys');
    const streams = Object.keys(this.ptys);
    for(var i = 0; i < streams.length; i++) {
      const stream = streams[i];
      const pty = this.ptys[stream];
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
      socketIOId: stream.socket.sio.id,
    };
  }
}

module.exports = exports = new PtysRegistry();
