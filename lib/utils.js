function storeConfiguration(socket, config) {
  socket.client.__terminalService__ = socket.client.__terminalService__ || {};
  return socket.client.__terminalService__ = {
    ...socket.client.__terminalService__,
    ...config,
  };
}

function getConfiguration(socket, name) {
  if (name == null) {
    return socket.client.__terminalService__;
  } else {
    return socket.client.__terminalService__[name];
  }
}

module.exports = exports = {
  getConfiguration: getConfiguration,
  storeConfiguration: storeConfiguration,
};
