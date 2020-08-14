const test = require('ava');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authz = require('../../');
const IncompatibleMethodError = require('../../src/IncompatibleMethodError');

let mongoServer;

test.before(async () => {
  mongoServer = new MongoMemoryServer();
  const uri = await mongoServer.getConnectionString();
  await mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true });
});

test('Model.remove should not be callable with plugin installed', (t) => {
  const schema = new mongoose.Schema({ friend: String });
  schema.plugin(authz);
  const MyModel = mongoose.model('ModelRemovePluggedIn', schema);

  t.throws(
    () => MyModel.remove({ friend: 'bar' }).exec(),
    { instanceOf: IncompatibleMethodError },
  );
});

test('Model.remove should be callable without the plugin installed', async (t) => {
  const schema = new mongoose.Schema({ friend: String });
  const MyModel = mongoose.model('ModelRemoveWithoutPlugin', schema);

  await t.notThrowsAsync(MyModel.remove({}).exec());
});

test.after.always(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
