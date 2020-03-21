const _ = require('lodash');
const getAuthorizedFields = require('./getAuthorizedFields');
const getAuthorizedActions = require('./getAuthorizedActions');
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

  const read = getAuthorizedFields(schema, authLevels, 'read');
  const write = getAuthorizedFields(schema, authLevels, 'write');
  const hasRemovePermission = hasPermission(schema, authLevels, 'remove');
  const actions = getAuthorizedActions(schema, authLevels);

  doc[embedPermissionsSymbol] = Object.freeze({
    get read() { return [...read]; },
    get write() { return [...write]; },
    remove: hasRemovePermission,
    get actions() { return [...actions]; },
  });
}

module.exports = embedPermissions;
