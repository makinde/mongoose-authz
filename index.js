const _ = require('lodash');
const getAuthorizedFields = require('./src/getAuthorizedFields');
const hasPermission = require('./src/hasPermission');
const authIsDisabled = require('./src/authIsDisabled');
const sanitizeDocumentList = require('./src/sanitizeDocumentList');
const getUpdatePaths = require('./src/getUpdatePaths');
const resolveAuthLevel = require('./src/resolveAuthLevel');
const getEmbeddedPermission = require('./src/getEmbeddedPermission');
const PermissionDeniedError = require('./src/PermissionDeniedError');
const IncompatibleMethodError = require('./src/IncompatibleMethodError');

const docOptionsSymbol = Symbol('documentOptions');

module.exports = (schema, installationOptions) => {
  async function save(doc, options) {
    let authorizedFields = getEmbeddedPermission(doc, options, 'write');
    let canCreate = false;

    if (authorizedFields === undefined) {
      const authLevels = await resolveAuthLevel(schema, options, doc);
      authorizedFields = getAuthorizedFields(schema, authLevels, 'write');
      canCreate = hasPermission(schema, authLevels, 'create');
    }

    if (doc.isNew && !canCreate) {
      throw new PermissionDeniedError('create');
    }

    const modifiedPaths = doc.modifiedPaths();
    const discrepancies = _.difference(modifiedPaths, authorizedFields);

    if (discrepancies.length > 0) {
      throw new PermissionDeniedError('write', discrepancies);
    }
  }

  async function removeQuery(query) {
    const authLevels = await resolveAuthLevel(schema, query.options);
    if (!hasPermission(schema, authLevels, 'remove')) {
      throw new PermissionDeniedError('remove');
    }
  }

  async function removeDoc(doc, options) {
    let canRemove = getEmbeddedPermission(doc, options, 'remove');

    if (canRemove === undefined) {
      const authLevels = await resolveAuthLevel(schema, options, doc);
      canRemove = hasPermission(schema, authLevels, 'remove');
    }

    if (!canRemove) {
      throw new PermissionDeniedError('remove');
    }
  }

  async function find(query, docs) {
    return sanitizeDocumentList(schema, query.options, docs);
  }

  async function update(query) {
    const authLevels = await resolveAuthLevel(schema, query.options);
    // If this is an upsert, you'll need the create permission
    // TODO add some tests for the upset case
    if (
      query.options
      && query.options.upsert
      && !hasPermission(schema, authLevels, 'create')
    ) {
      throw new PermissionDeniedError('create');
    }

    const authorizedFields = getAuthorizedFields(schema, authLevels, 'write');

    // check to see if the group is trying to update a field it does not have permission to
    const modifiedPaths = getUpdatePaths(query._update);
    const discrepancies = _.difference(modifiedPaths, authorizedFields);
    if (discrepancies.length > 0) {
      throw new PermissionDeniedError('write', discrepancies);
    }

    // TODO handle the overwrite option
    // TODO handle Model.updateOne
    // TODO handle Model.updateMany

    // Detect which fields can be returned if 'new: true' is set
    const authorizedReturnFields = getAuthorizedFields(schema, authLevels, 'read');

    // create a sanitizedReturnFields object that will be used to return only the fields that a
    // group has access to read
    const sanitizedReturnFields = {};
    authorizedReturnFields.forEach((field) => {
      if (!query._fields || query._fields[field]) {
        sanitizedReturnFields[field] = 1;
      }
    });
    query._fields = sanitizedReturnFields;
  }

  // Find paths with permissioned schemas and store those so deep checks can be done
  // on the right paths at call time.
  schema.pathsWithPermissionedSchemas = {};
  schema.eachPath((path, schemaType) => {
    const subSchema = schemaType.schema;
    if (subSchema && subSchema.permissions) {
      schema.pathsWithPermissionedSchemas[path] = subSchema;
    }
  });

  // PRE- DOCUMENT hooks
  // We do a bit of manual promise handling for these two (pre-save and pre-remove)
  // because the only way to get mongoose to pass in an options dict on document middleware
  // is to have arguments to the middleware function. If we have arguments, mongoose
  // assume we want to use a `next()` function. FML
  schema.pre('save', function preSave(next, options) {
    // If we don't have options saved in the doc already, put whatever options
    // we have now in there. This way there are always options saved in the doc.
    if (!this[docOptionsSymbol]) this[docOptionsSymbol] = options;

    // If auth is disabled, don't store the options in the doc. This will leave options
    // that have been stored when the doc was retrieved (if any).
    if (authIsDisabled(options)) { return next(); }

    // Okay, we are not disabled, so definitely use these options going forward.
    this[docOptionsSymbol] = options;

    return save(this, options)
      .then(() => next())
      .catch(next);
  });
  schema.post('save', (doc, next) => {
    const options = doc[docOptionsSymbol];
    if (authIsDisabled(options)) { return next(); }

    // Nothing will likely be removed, but this allows people to specify that
    // permissions should be returned, so this will recalculate permissions
    // with the new  document data (after changes) and embed it if asked for
    return sanitizeDocumentList(schema, options, doc)
      .then(() => next())
      .catch(next);
  });
  // TODO, WTF, how to prevent someone from Model.find().remove().exec(); That doesn't
  // fire any remove hooks. Does it fire a find hook?
  schema.pre('remove', function preRemove(next, options) {
    if (authIsDisabled(options)) { return next(); }
    return removeDoc(this, options)
      .then(() => next())
      .catch(next);
  });
  schema.pre('findOneAndRemove', async function preFindOneAndRemove() {
    if (authIsDisabled(this.options)) { return; }
    await removeQuery(this);
  });
  schema.post('find', async function postFind(docs) {
    if (authIsDisabled(this.options)) { return; }

    // Store the options in the doc in case we do a write operation later on.
    // If that write skips authz checks, it'll be able to use these options to
    // recalculate permissions.
    if (this.options && docs && docs.forEach) {
      docs.forEach((doc) => { doc[docOptionsSymbol] = this.options; });
    }

    await find(this, docs);
  });
  schema.post('findOne', async function postFindOne(doc) {
    if (authIsDisabled(this.options)) { return; }

    // Store the options in the doc in case we do a write operation later on.
    // If that write skips authz checks, it'll be able to use these options to
    // recalculate permissions.
    if (this.options && doc) {
      doc[docOptionsSymbol] = this.options;
    }

    await find(this, doc);
  });
  schema.pre('update', async function preUpdate() {
    if (authIsDisabled(this.options)) { return; }
    await update(this);
  });
  schema.pre('findOneAndUpdate', async function preFindOneAndUpdate() {
    if (authIsDisabled(this.options)) { return; }
    await update(this);
  });

  schema.query.setAuthLevel = function setAuthLevel(authLevel) {
    this.options.authLevel = authLevel;
    return this;
  };

  const allowedMethods = _.get(installationOptions, 'allowedMethods');
  if (!_.includes(allowedMethods, 'create')) {
    schema.statics.create = function cannotCreate() {
      throw new IncompatibleMethodError('Model.create');
    };
  }

  if (!_.includes(allowedMethods, 'remove')) {
    schema.statics.remove = function cannotRemove() {
      throw new IncompatibleMethodError('Model.remove');
    };
  }
};
