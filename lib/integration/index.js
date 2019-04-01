if (process.env.INTEGRATION == null) {
  throw new Error("Environment variable INTEGRATION is not set");
}
const debug = require('debug')('FlightTerminalService:integration');
debug("Using integration %s", process.env.INTEGRATION);

module.exports = exports = require(`./${process.env.INTEGRATION}`);
