const test = require('ava');
const mongoose = require('mongoose');
const embedPermissions = require('../src/embedPermissions');

test.before((t) => {
  const schema = new mongoose.Schema({ friend: String });
  schema.permissions = {
    default: {},
    manager: {
      read: ['friend'],
      write: ['friend'],
      create: true,
      remove: true,
      actions: ['like'],
    },
  };
  t.context.schema = schema;
});

test('No schema', (t) => {
  const blankDoc = { _id: 'someId' };
  embedPermissions(false, { permissions: true }, ['manager'], blankDoc);
  t.deepEqual(blankDoc, { _id: 'someId' }, 'Nothing should have been added to doc');
});

test('No document', (t) => {
  t.notThrows(() => { embedPermissions(t.context.schema, { permissions: true }, ['manager'], false); });
});

test('Do not embed permissions if doc is empty', (t) => {
  const doc = {};
  embedPermissions(t.context.schema, { permissions: true }, ['manager'], doc);

  t.deepEqual(doc, {}, 'Should not add permissions when doc is empty object');
});

test('Options say to do nothing', (t) => {
  const blankDoc = { _id: 'someId' };
  embedPermissions(t.context.schema, false, ['manager'], blankDoc);
  t.deepEqual(blankDoc, { _id: 'someId' }, 'Should not add permissions for false options');

  embedPermissions(t.context.schema, {}, ['manager'], blankDoc);
  t.deepEqual(blankDoc, { _id: 'someId' }, 'Should not add permissions for {} options');

  embedPermissions(t.context.schema, { permissions: false }, ['manager'], blankDoc);
  t.deepEqual(blankDoc, { _id: 'someId' }, 'Should not add permissions for { permissions: false} options');
});

test('Permissions embedded under default key', (t) => {
  const managerDoc = { _id: 'someId' };
  embedPermissions(t.context.schema, { permissions: true }, ['manager'], managerDoc);
  t.deepEqual(
    managerDoc.permissions,
    {
      read: ['friend'],
      write: ['friend'],
      remove: true,
      actions: ['like'],
    },
    'Incorrect permissions embedded',
  );

  const defaultDoc = { _id: 'someId' };
  embedPermissions(t.context.schema, { permissions: true }, [], defaultDoc);
  t.deepEqual(
    defaultDoc.permissions,
    {
      read: [],
      write: [],
      remove: false,
      actions: [],
    },
    'Incorrect permissions embedded',
  );
});
test('Permissions embedded under custom key', (t) => {
  const managerDoc = { _id: 'someId' };
  embedPermissions(t.context.schema, { permissions: 'customKey' }, ['manager'], managerDoc);
  t.deepEqual(
    managerDoc.customKey,
    {
      read: ['friend'],
      write: ['friend'],
      remove: true,
      actions: ['like'],
    },
    'Incorrect permissions embedded',
  );

  const defaultDoc = { _id: 'someId' };
  embedPermissions(t.context.schema, { permissions: 'customKey' }, [], defaultDoc);
  t.deepEqual(
    defaultDoc.customKey,
    {
      read: [],
      write: [],
      remove: false,
      actions: [],
    },
    'Incorrect permissions embedded',
  );
});

test('If there\'s already a permissions field', (t) => {
  const doc = { permissions: 'app level info' };
  t.throws(
    () => {
      embedPermissions(t.context.schema, { permissions: true }, ['manager'], doc);
    },
    null,
    'An error should be thrown when a permissions key is already present in the target object',
  );
});

test('Verify that the permissions data cannot be changed', (t) => {
  const doc = { _id: 'foobar' };
  embedPermissions(t.context.schema, { permissions: true }, ['manager'], doc);

  t.throws(
    () => { doc.permissions = {}; },
    null,
    'The permissions object shouldn\'t be writable overall',
  );

  t.throws(
    () => { doc.permissions.read = []; },
    null,
    'The permissions object shouldn\'t be writable [read]',
  );

  t.throws(
    () => { doc.permissions.write = []; },
    null,
    'The permissions object shouldn\'t be writable [write]',
  );

  t.throws(
    () => { doc.permissions.remove = false; },
    null,
    'The permissions object shouldn\'t be writable [remove]',
  );

  t.throws(
    () => { doc.permissions.actions = []; },
    null,
    'The permissions object shouldn\'t be writable [actions]',
  );

  t.throws(
    () => { doc.permissions = {}; },
    null,
    'The permissions field should not be writable',
  );

  // Try to directly edit the fields. These won't throw, but also shouldn't
  // affect the permissions on the object.
  doc.permissions.read.push('foo');
  doc.permissions.write.push('foo');
  doc.permissions.actions.push('foo');
  doc.permissions.read.shift();
  doc.permissions.write.shift();
  doc.permissions.actions.shift();
  t.deepEqual(
    doc.permissions,
    {
      read: ['friend'],
      write: ['friend'],
      remove: true,
      actions: ['like'],
    },
    'Permissions able to be mutated when they should not be.',
  );
});

test.todo('Make sure enumerable is set to true for the embedded permissions');
