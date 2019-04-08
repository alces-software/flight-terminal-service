const debug = require('debug')('FlightTerminalService:integration:flight-center');
const fetch = require('node-fetch');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const tmp = require('tmp');
const ursa = require('ursa');
const { exec } = require('child_process');

const utils = require('../utils');

const JSON_WEB_TOKEN_SECRET = utils.getEnvVarOrThrow('JSON_WEB_TOKEN_SECRET');
const CENTER_BASE_URL = utils.getEnvVarOrThrow('CENTER_BASE_URL');
const CHECK_STATUS_PING_IP = utils.getEnvVarOrThrow('CHECK_STATUS_PING_IP');
const CHECK_STATUS_PING_COUNT = utils.getEnvVarOrDefault('CHECK_STATUS_PING_COUNT', 3);
const CHECK_STATUS_PING_TIMEOUT = utils.getEnvVarOrDefault('CHECK_STATUS_PING_TIMEOUT', 3);
const privateKey = ursa.createPrivateKey(utils.getEnvVarOrThrow('RSA_PRIVATE_KEY'));

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
            socket,
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

function fetchTerminalServicesConfig(cookie, scope) {
  let prefix;
  if (scope.type != null) {
    prefix = `${CENTER_BASE_URL}/${scope.type}/${scope.id}`;
  } else {
    prefix = `${CENTER_BASE_URL}`;
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

function reconfigure(socket) {
  const authData = utils.getConfiguration(socket, 'authData');
  const ssoUser = utils.getConfiguration(socket, 'ssoUser');
  return fetchTerminalServicesConfig(
    authData.jwt,
    authData.scope,
  )
    .then((terminalServiceConfig) => {
      return configure(
        authData,
        terminalServiceConfig,
        ssoUser,
        socket,
      );
    })
}

function configure(authData, terminalServiceConfig, ssoUser, socket) {
  if (terminalServiceConfig.ssh != null) {
    storeAuthData(socket, authData, ssoUser);
    configureCmd(socket, terminalServiceConfig.ssh, ssoUser);
    return true;
  } else {
    return false;
  }
}

function storeAuthData(socket, authData, ssoUser) {
  utils.storeConfiguration(socket, {authData: authData, ssoUser: ssoUser});
}

function configureCmd(socket, sshConfig, ssoUser) {
  const sshKey = privateKey.decrypt(
    sshConfig.key,
    'base64',
    'utf8',
    ursa.RSA_PKCS1_PADDING
  );
  const tmpobj = tmp.fileSync();
  fs.writeSync(tmpobj.fd, sshKey);
  const [hostname, port=22] = sshConfig.hostname.split(':');

  utils.storeConfiguration(socket, {
    needsReconfigure: false,
    cmd: {
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
    },
    onStreamEnd: () => {
      debug('Removing SSH key %s', tmpobj.name);
      tmpobj.removeCallback();
      utils.storeConfiguration(socket, { needsReconfigure: true });
    },
    reconfigure: () => reconfigure(socket)
  });
}

function checkStatus(req, res) {
  const ping_args = [
    '-c', CHECK_STATUS_PING_COUNT,
    '-W', CHECK_STATUS_PING_TIMEOUT,
    '-w', CHECK_STATUS_PING_TIMEOUT,
    CHECK_STATUS_PING_IP,
  ];
  exec(`ping ${ping_args.join(' ')}`, function(error, stdout, stderr) {
    if (error) {
      debug('Pinging VPN server %s failed', CHECK_STATUS_PING_IP);
      res.writeHead(504, {'Content-Type': 'text/plain'});
      res.end('504 Gateway Timeout');
    } else {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('200 OK');
    }
  });
}

module.exports = exports = {
  authenticate: authenticate,
  checkStatus: checkStatus,
};
