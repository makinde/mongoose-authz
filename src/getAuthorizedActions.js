const _ = require('lodash');
const cleanAuthLevels = require('./cleanAuthLevels');

function getAuthorizedActions(schema, authLevels) {
  const cleanedLevels = cleanAuthLevels(schema, authLevels);

  return _.chain(cleanedLevels)
    .flatMap(level => schema.permissions[level].actions)
    .filter()
    .uniq() // dropping duplicates
    .value();
}

module.exports = getAuthorizedActions;
