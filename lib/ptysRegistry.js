const debug = require('debug')('FlightTerminalService:PtysRegistry');

class PtysRegistry {
  constructor() {
    this.ptys = {};
  }

  register(socket, stream, pty) {
    debug(
      'Registering pty %o for stream %o',
      this.ptyDebug(pty),
      this.streamDebug(stream)
    );
    this.ptys[stream.id] = { stream, pty, socket };
  }

  has(streamId) {
    return this.get(streamId) != null;
  }

  get(streamId) {
    return this.ptys[streamId];
  }

  _kill(streamId) {
    if (!this.has(streamId)) {
      debug('Stream %s not found. Unable to kill', streamId);
      return;
    }
    const { pty, stream } = this.get(streamId);
    debug(
      'Killing pty %o for stream %o',
      this.ptyDebug(pty),
      this.streamDebug(stream)
    );
    pty.kill('SIGHUP');
    delete this.ptys[streamId];
  }

  killStream(stream) {
    this._kill(stream.id);
  }

  killSocket(targetSocket) {
    debug('Killing all ptys for socket %s', targetSocket.id);
    const streamIds = Object.keys(this.ptys);
    for(var i = 0; i < streamIds.length; i++) {
      const streamId = streamIds[i];
      const { socket } = this.ptys[streamId];
      if (socket === targetSocket) {
        this._kill(streamId);
      }
    }
  }

  killAll() {
    debug('Killing all ptys');
    const streamIds = Object.keys(this.ptys);
    for(var i = 0; i < streamIds.length; i++) {
      const streamId = streamIds[i];
      this._kill(streamId);
    }
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
