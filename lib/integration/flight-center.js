const debug = require('debug')('FlightTerminalService:integration:flight-center');
const fetch = require('node-fetch');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const tmp = require('tmp');
const ursa = require('ursa');
const { spawn, spawnSync } = require('child_process');

const config = require('../config.json');

if (process.env.JSON_WEB_TOKEN_SECRET == null) {
  throw new Error("Environment variable JSON_WEB_TOKEN_SECRET is not set");
}
const JSON_WEB_TOKEN_SECRET = process.env.JSON_WEB_TOKEN_SECRET;

if (process.env.RSA_PRIVATE_KEY == null) {
  throw new Error("Environment variable RSA_PRIVATE_KEY is not set");
}
const privateKey = ursa.createPrivateKey(process.env.RSA_PRIVATE_KEY);

function authenticate(socket, authData, callback) {
  jwt.verify(authData.jwt, JSON_WEB_TOKEN_SECRET, (err, ssoUser) => {
    if (err) {
      debug("Socket %s authentication failed: %o", socket.id, err);
      callback({ message: err });
    } else {
      debug("Socket %s authenticated with JWT: %o", socket.id, ssoUser);
      fetchTerminalServicesConfig(
        authData.jwt,
        authData.scope,
      )
        .then((terminalServiceConfig) => {
          return configure(
            authData,
            terminalServiceConfig,
            ssoUser,
            socket.client,
          );
        })
        .then(isConfigured => callback(null, isConfigured))
        .catch((err) => {
          debug("Socket %s authentiation failed: %o", socket.id, err);
          callback({ message: err });
        });
    }
  });
}

const centerBaseUrl = process.env.CENTER_BASE_URL;

function fetchTerminalServicesConfig(cookie, scope) {
  let prefix;
  if (scope.type != null) {
    prefix = `${centerBaseUrl}/${scope.type}/${scope.id}`;
  } else {
    prefix = `${centerBaseUrl}`;
  }
  const url = `${prefix}/terminal_services?service_type=${scope.serviceType}`;
  debug('Fetching terminal services configuration from %s', url);
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

function reconfigure(store) {
  const authData = store.__terminalService__.authData;
  const ssoUser = store.__terminalService__.ssoUser;
  return fetchTerminalServicesConfig(
    authData.jwt,
    authData.scope,
  )
    .then((terminalServiceConfig) => {
      return configure(
        authData,
        terminalServiceConfig,
        ssoUser,
        store,
      );
    })
}

function configure(authData, terminalServiceConfig, ssoUser, store) {
  if (terminalServiceConfig.ssh != null) {
    storeAuthData(store, authData, ssoUser);
    configureCmd(store, terminalServiceConfig.ssh, ssoUser);
    return true;
  } else {
    return false;
  }
}

function storeAuthData(store, authData, ssoUser) {
  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.authData = authData;
  store.__terminalService__.ssoUser = ssoUser;
}

function configureCmd(store, sshConfig, ssoUser) {
  const sshKey = privateKey.decrypt(
    sshConfig.key,
    'base64',
    'utf8',
    ursa.RSA_PKCS1_PADDING
  );
  const tmpobj = tmp.fileSync();
  fs.writeSync(tmpobj.fd, sshKey);
  const [hostname, port=22] = sshConfig.hostname.split(':');

  store.__terminalService__ = store.__terminalService__ || {};
  store.__terminalService__.needsReconfigure = false;
  store.__terminalService__.cmd = {
    args: [
      "-o", "UserKnownHostsFile=/dev/null",
      "-o", "StrictHostKeyChecking=no",
      "-o", "Loglevel=ERROR",
      "-o", "SendEnv=FC_*",
      "-i", tmpobj.name,
      "-l", sshConfig.username,
      "-p", port,
      hostname,
    ],
    env: {
      FC_USER: ssoUser.username,
    }
  };
  store.__terminalService__.onStreamEnd = () => {
    debug('Removing SSH key %s', tmpobj.name);
    tmpobj.removeCallback();
    store.__terminalService__.needsReconfigure = true;
  };
  store.__terminalService__.reconfigure = () => reconfigure(store);
}

module.exports = exports = authenticate;
