const _ = require('lodash');
const getAuthorizedFields = require('./getAuthorizedFields');
const hasPermission = require('./hasPermission');

const embedPermissionsSymbol = Symbol('Embedded Permissions');

function embedPermissions(schema, options, authLevels, doc) {
  if (!schema || !options || !options.permissions || _.isEmpty(doc)) { return; }

  const permsKey = options.permissions === true ? 'permissions' : options.permissions;

  if (permsKey in doc) {
    if (!doc[embedPermissionsSymbol]) {
      // We haven't embedded permissions, but there is already a value at the path where
      // we're supposed to insert the permissions. Throw an exception for the developer
      // knows that something is wrong.
      throw new Error(`Cannot embed permissions into mongoose document at \`${permsKey}\`because the key is already present in the document. Please specify a custom key.`);
    }
  } else {
    Object.defineProperty(doc, permsKey, {
      get() { return this[embedPermissionsSymbol]; },
      set() { throw new Error('Permissions are not writable'); },
      enumerable: true,
    });
  }

  doc[embedPermissionsSymbol] = Object.freeze({
    read: getAuthorizedFields(schema, authLevels, 'read'),
    write: getAuthorizedFields(schema, authLevels, 'write'),
    remove: hasPermission(schema, authLevels, 'remove'),
  });
}

module.exports = embedPermissions;
