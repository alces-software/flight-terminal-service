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

function getEnvVarOrThrow(varName) {
  if (process.env[varName] == null) {
    throw new Error(`Environment variable ${varName} is not set`);
  }
  return process.env[varName];
}

function getEnvVarOrDefault(varName, defaultValue) {
  if (process.env[varName] == null) {
    return defaultValue;
  }
  return process.env[varName];
}


module.exports = exports = {
  getConfiguration: getConfiguration,
  getEnvVarOrDefault: getEnvVarOrDefault,
  getEnvVarOrThrow: getEnvVarOrThrow,
  storeConfiguration: storeConfiguration,
};
