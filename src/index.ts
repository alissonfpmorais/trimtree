#!/usr/bin/env node

import chalk from 'chalk';
import { Command, Option } from 'commander';
import { Walker } from './walker';

const CWD = process.cwd();

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
      }));
      return;
    } else {
      console.log(chalk.blue(`TSConfig: ${options.tsConfig}`));
      console.log(chalk.blue(`Entrypoint: ${options.entrypoint}`));
      console.log(chalk.blue(`ExcludeNodeModules: ${excludeNodeModules}`));
      console.log('');
      console.log(chalk.blue('Dependencies graph:'));
      Object.keys(internalGraph).slice(0, 10).forEach((key) => {
        const dependencies = internalGraph[key];
        console.log(chalk.green(`- ${key}`));
        dependencies.forEach((dep) => {
          console.log(chalk.yellow(`|-- ${dep}`));
        });
      });
    }
  })

const remove = new Command()
  .command('remove <files...>')
  .addOption(tsConfigOpt)
  .addOption(entrypointOpt)
  .addOption(nodeModulesOpt)
  .addOption(formatOpt)
  .action((files, options) => {
    console.log(new Walker(CWD, options.tsConfig, options.entrypoint, !options.nodeModules).getGraphAfterDeleted(files));
  });

const graph = new Command()
  .command('graph')
  .description('Show the graph for the given entrypoint')
  .addCommand(show)
  .addCommand(remove);

const program = new Command();

program
  .name('trimtree')
  .description('CLI to help trimming the code dependency tree')
  .version('0.1.0');

program.addCommand(graph);

program.parse();
