// Metro, taught about the monorepo.
//
// The app imports `@nemcina/core` from `packages/core` and the content JSON from
// `app/data`, both outside this directory. Metro only watches the project folder
// by default, so without this the bundler simply cannot see them.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// One copy of every package: two copies of React in a monorepo is a hook error
// that takes an afternoon to understand.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
