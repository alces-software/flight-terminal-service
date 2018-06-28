const debug = require('debug')('FlightTerminalService:auth');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const config = require('./config.json');

const JSON_WEB_TOKEN_SECRET =
  process.env.JSON_WEB_TOKEN_SECRET ||
  "cabfa4559f1d674ee86e423a4a849f450393630dfc2c48b2a949efb8df510357f602b5cab6584668452d7e0eba961d5c88be6194d978eb1d7d5d55ce5ecbc204"

function authenticate(socket, data, callback) {
  jwt.verify(data.jwt, JSON_WEB_TOKEN_SECRET, (err, decodedJwt) => {
    if (err) {
      debug("Authentication failed: %o", err);
      return callback(err);
    } else {
      debug("Socket authenticated with JWT: %o", decodedJwt);
      fetchCenterUser(data.jwt)
        .then(({ site, user }) => {
          const permissions = user.permissions;
          const flightDirectory = site.flight_directory;
          if (permissions.accessFlightDirectory && flightDirectory.hostname) {
            storeUser(socket.client, user, site, decodedJwt);
            configureCmd(socket.client, flightDirectory);
            return callback(null, true);
          } else {
            return callback(null, false);
          }
        })
        .catch((err) => {
          debug("Authentiation failed: %o", err);
          return callback(err);
        });
    }
  });
}

function fetchCenterUser(cookie) {
  const url = "http://center.alces-flight.lvh.me:3003/users";
  return fetch(url, {
    headers: {
      Cookie: `flight_sso=${cookie}`
    }
  })
    .then(resp => resp.json());
}

function storeUser(store, user, site, decodedJwt) {
  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.centerUser = user;
  store.__terminalService__.centerSite = site;
  store.__terminalService__.ssoUser = decodedJwt;
}

function configureCmd(store, flightDirectory) {
  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.cmd = {
    args: [
      '-l', flightDirectory.username,
      flightDirectory.hostname,
    ]
  };
}

module.exports = exports = authenticate;
