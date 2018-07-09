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
      debug("Socket %s authentication failed: %o", socket.id, err);
      callback({ message: err });
    } else {
      debug("Socket %s authenticated with JWT: %o", socket.id, decodedJwt);
      fetchTerminalServicesConfig(data.jwt, data.siteId)
        .then(({ flight_directory_config, site }) => {
          const flightDirectoryConfig = flight_directory_config;
          if (flightDirectoryConfig != null) {
            storeUser(socket.client, flightDirectoryConfig, site, decodedJwt);
            configureCmd(socket.client, flightDirectoryConfig);
            callback(null, true);
          } else {
            callback(null, false);
          }
        })
        .catch((err) => {
          debug("Socket %s authentiation failed: %o", socket.id, err);
          callback({ message: err });
        });
    }
  });
}

const centerBaseUrl = process.env.CENTER_BASE_URL;

function fetchTerminalServicesConfig(cookie, siteId) {
  let url;
  if (siteId == null) {
    url = `${centerBaseUrl}/terminal_services`;
  } else {
    url = `${centerBaseUrl}/sites/${siteId}/terminal_services`;
  }
  return fetch(url, {
    headers: {
      Cookie: `flight_sso=${cookie}`
    }
  })
    .then((resp) => {
      if (resp.ok) {
        return resp.json();
      } else if (resp.status === 404) {
        return Promise.reject('Flight Center user does not exist or terminal services config not found');
      } else if (resp.status === 403) {
        return Promise.reject('Not authorised to access terminal services');
      } else {
        return resp.text().then(t => Promise.reject(t));
      }
    });
}

function storeUser(store, flightDirectoryConfig, site, decodedJwt) {
  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.flightDirectoryConfig = flightDirectoryConfig;
  store.__terminalService__.site = site;
  store.__terminalService__.ssoUser = decodedJwt;
}

function configureCmd(store, flightDirectoryConfig) {
  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.cmd = {
    args: [
      "-o", "IdentitiesOnly yes",
      "-o", "UserKnownHostsFile=/dev/null",
      "-o", "StrictHostKeyChecking=no",
      "-l", flightDirectoryConfig.username,
      flightDirectoryConfig.hostname,
    ]
  };
}

module.exports = exports = authenticate;
