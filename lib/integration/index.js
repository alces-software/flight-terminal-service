const utils = require('../utils');
const INTEGRATION = utils.getEnvVarOrThrow('INTEGRATION');
const debug = require('debug')('FlightTerminalService:integration');
debug("Using integration %s", INTEGRATION);

module.exports = exports = require(`./${INTEGRATION}`);
