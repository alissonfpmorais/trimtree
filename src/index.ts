#!/usr/bin/env node

import chalk from 'chalk';
import { Command, Option } from 'commander';
import { createRequire } from 'node:module';
import { Walker } from './walker.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const CWD = process.cwd();

const bold = chalk.bold;
const info = chalk.blue;
const boldInfo = bold.blue;
const success = chalk.green;
const boldSuccess = bold.green;
const warning = chalk.yellow;
const boldWarning = bold.yellow;
const error = chalk.red;
const boldError = bold.red;

const tsConfigOpt = new Option('-c, --ts-config <file_path>', 'The path to `tsconfig.json` file')
  .default(`${CWD}/tsconfig.json`);

const entrypointOpt = new Option('-e, --entrypoint <glob_pattern>', 'The entrypoint to construct the graph dependency')
  .default(`${CWD}/**/*.{ts,tsx}`);

const nodeModulesOpt = new Option('--no-node-modules', 'Whether to exclude or not the node_modules folder');

const formatOpt = new Option('-f, --format-as <choice>')
  .choices(['log', 'json'])
  .default('log');

const show = new Command()
  .command('show')
  .addOption(tsConfigOpt)
  .addOption(entrypointOpt)
  .addOption(nodeModulesOpt)
  .addOption(formatOpt)
  .action((options) => {
    const excludeNodeModules = !options.nodeModules;
    const graph = new Walker(CWD, options.tsConfig, options.entrypoint, excludeNodeModules).getGraph();
    const internalGraph = graph.getGraph();

    if (options.formatAs === 'json') {
      console.log(JSON.stringify({
        tsconfigPath: options.tsConfig,
        entrypoint: options.entrypoint,
        excludeNodeModules: excludeNodeModules,
        graph: internalGraph,
      }, null, 2));
      return;
    } else {
      console.log(info('TSConfig: ') + boldInfo(options.tsConfig));
      console.log(info('Entrypoint: ') + boldInfo(options.entrypoint));
      console.log(info('ExcludeNodeModules: ') + boldInfo(excludeNodeModules));
      console.log(info('Dependencies graph:'));
      const graphKeys = Object.keys(internalGraph);

      if (graphKeys.length <= 0) {
        console.log(boldSuccess(`It's empty here, no files found!`));
      } else {
        graphKeys.forEach((key) => {
          const dependencies = internalGraph[key];
          console.log(success('- ') + boldSuccess(key));
          dependencies.forEach((dep) => {
            console.log(warning('|-- ') + boldWarning(dep));
          });
        });
      }
    }
  })

const remove = new Command()
  .command('remove <files...>')
  .addOption(tsConfigOpt)
  .addOption(entrypointOpt)
  .addOption(nodeModulesOpt)
  .addOption(formatOpt)
  .action((files, options) => {
    const excludeNodeModules = !options.nodeModules;
    const refactorInfo = new Walker(CWD, options.tsConfig, options.entrypoint, !options.nodeModules)
      .getGraphAfterDeleted(files);

    if (options.formatAs === 'json') {
      console.log(JSON.stringify({
        tsconfigPath: options.tsConfig,
        entrypoint: options.entrypoint,
        excludeNodeModules: excludeNodeModules,
        refactorInfo: refactorInfo,
      }, null, 2));
      return;
    } else {
      const toRefactor = refactorInfo.toRefactor;
      const toExclude = refactorInfo.toExclude;

      console.log(info('TSConfig: ') + boldInfo(options.tsConfig));
      console.log(info('Entrypoint: ') + boldInfo(options.entrypoint));
      console.log(info('ExcludeNodeModules: ') + boldInfo(excludeNodeModules));
      
      Object.keys(toRefactor).forEach((key) => {
        const dependencies = toRefactor[key];
        console.log('');
        console.log(info('Files to refactor after deleting ') + boldError(key));

        if (dependencies.length <= 0) {
          console.log(boldSuccess('NONE! :)'));
        } else {
          dependencies.forEach((dep) => {
            console.log(warning('|-- ') + boldWarning(dep));
          });
        }
      });

      console.log('');
      console.log(info('Files to exclude:'));

      if (toExclude.length <= 0) {
        console.log(boldSuccess('NONE! :)'));
      } else {
        toExclude.forEach((filePath) => console.log(error('- ') + boldError(filePath)));
      }
    }
  });

const graph = new Command()
  .command('graph')
  .description('Show the graph for the given entrypoint')
  .addCommand(show)
  .addCommand(remove);

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

program.addCommand(graph);

program.parse();
