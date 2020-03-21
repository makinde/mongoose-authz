const test = require('ava');
const goodSchema = require('./exampleSchemas/goodSchema');
const bareBonesSchema = require('./exampleSchemas/bareBonesSchema');
const getAuthorizedActions = require('../src/getAuthorizedActions');

test('No matching authLevels', (t) => {
  t.deepEqual(
    getAuthorizedActions(bareBonesSchema, 'foobar'),
    [],
  );
});

test('Handles non-existent authLevels', (t) => {
  t.deepEqual(
    getAuthorizedActions(goodSchema, ['defaults', 'foobar']),
    ['wave'],
  );
});

test('Combines basic authLevel actions', (t) => {
  t.deepEqual(
    getAuthorizedActions(goodSchema, ['defaults', 'admin']).sort(),
    ['combine', 'wave'].sort(),
  );
});

test('Handles authLevels that have no actions specified', (t) => {
  t.deepEqual(
    getAuthorizedActions(goodSchema, ['defaults', 'stranger']),
    ['wave'],
  );
});

test('Correctly deduping actions that are mentioned in multiple authLevels', (t) => {
  t.deepEqual(
    getAuthorizedActions(goodSchema, ['defaults', 'self', 'admin']).sort(),
    ['combine', 'wave'].sort(),
  );
});
