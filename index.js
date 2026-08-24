"use strict";

const { program, Option } = require('commander');
const { initialize } = require('./initialization.js');
const { createBucket, deleteBucket } = require('/bucket.js');

const endpoint = 
  new Option('--endpoint <endpoint>', 'garage admin endpoint')
    .env('GORDON_ADMIN_ENDPOINT')
    .makeOptionMandatory();

const token = 
  new Option('--admin-token <token>', 'garage admin token')
    .conflicts('tokenFile')
    .env('GORDON_ADMIN_TOKEN');
    
const tokenFile = 
  new Option('--token-file <file>', 'file containing admin token')
    .conflicts('adminToken')
    .env('GORDON_TOKEN_FILE');


async function main() {
  program
    .name('gordon')
    .command('initialize')
    .alias('init')
    .option('-d, --debug', 'show debugging logs')
    .addOption(endpoint)
    .addOption(token)
    .addOption(tokenFile)
    .addOption(
      new Option('--num-nodes <int>', 'total number of nodes (gatway + storage)')
        .env('GORDON_EXPECTED_NODE_COUNT')
        .argParser(parseInt)
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--capacity-label <label>', 'node label defining garage capacity (example: yachts.swarm.garage.capacity)')
        .env('GORDON_CAPACITY_LABEL')
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--zone-label <label>', 'node label defining garage zone')
        .env('GORDON_ZONE_LABEL')
        .makeOptionMandatory()
    )
    .addOption(
      new Option('--tags-label <label>', 'node label defining (comma-seperated) garage tags')
        .env('GORDON_TAGS_LABEL')
    )
    .action(async (options) => {
      await initialize(options);
    });

    
  program
    .name('gordon')
    .command('bucket')
    .option('-d, --debug', 'show debugging logs')
    .addOption(endpoint)
    .addOption(token)
    .addOption(tokenFile)
    .addOption(
      new Option('--create <name>', 'create a new bucket')
        .conflicts('delete')
    )
    .addOption(
      new Option('--delete <name>', 'delete an existing bucket')
        .conflicts('create')
    )
    .action(async (options) => {
      if (options.create) {
        await createBucket(options);
      } else if (options.delete) {
          await deleteBucket(options);
      } else {
        console.error('Either --create or --delete must be specified');
      }
    });

  await program.parseAsync(process.argv);
}

main();