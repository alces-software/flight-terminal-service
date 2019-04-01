const debug = require('debug')('FlightTerminalService:integration:no-auth-localhost');

function authenticate(socket, data, callback) {
  // This integration is always authenticates the request and runs the command
  // that is defined in config.json.
  callback(null, true)
}

module.exports = exports = authenticate;
