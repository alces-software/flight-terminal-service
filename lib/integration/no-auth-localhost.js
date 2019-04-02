const debug = require('debug')('FlightTerminalService:integration:no-auth-localhost');

// This integration always authenticates the request and runs the command
// that is defined in config.json.
//
// `socket` is the socketIO socket.
// `data` is the authentication data provided by the client, possibly an empty
// hash.
// `callback` is a function to call to signal whether authentication was
// successful or not.
//
// See https://www.npmjs.com/package/socketio-auth for more details.
function authenticate(socket, data, callback) {
  // We can configure the command to run, as follows.  If we don't do so, we
  // use the cmd defined in `config.json`.
  //
  //    utils.storeConfiguration(socket, {
  //      cmd: {
  //        exe: "/usr/bin/ssh",
  //        args: [
  //          "-o", "IdentitiesOnly=yes",
  //          "-F", "/dev/null",
  //          "-o", "UserKnownHostsFile=/dev/null",
  //          "-o", "StrictHostKeyChecking=no",
  //          "localhost"
  //        ],
  //        env: {
  //        }
  //      },
  //    });

  // Other things we might want to configure are:
  // 
  //   `onStreamEnd`: the function to call when the stream ends.
  //   `needsReconfigure`: does this socket need reconfiguring.
  //   `reconfigure`: the function to call to reconfigure a socket.
  //
  // The Flight Center integration makes use of these to download, delete and
  // redownload an SSH key to use the for the connection.

  callback(null, true)
}

module.exports = exports = authenticate;
