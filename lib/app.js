const server = require('./server');
const ptyStream = require('./ptyStream');

ptyStream(server);
