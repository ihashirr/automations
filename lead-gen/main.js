#!/usr/bin/env node

/**
 * Lead Gen Engine CLI
 * Single entry point for all pipeline operations.
 * 
 * Usage: node main.js <command> [args...]
 */

const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

const COMMANDS = {
  'auth':     'auth',
  'find':     'find',
  'collect':  'collect',
  'filter':   'filter',
  'outreach': 'outreach',
  'track':    'track',
  'update':   'update'
};

async function main() {
  if (!command || !COMMANDS[command]) {
    console.log('Lead Gen Engine v2.1');
    console.log('Usage: node main.js <command> [args...]');
    console.log('\nAvailable commands:');
    Object.keys(COMMANDS).forEach(cmd => {
      console.log(`  - ${cmd}`);
    });
    console.log('\nExample: node main.js auth myaccount');
    process.exit(1);
  }

  try {
    const cmdModule = require(path.join(__dirname, 'src', 'commands', COMMANDS[command]));
    await cmdModule.run(args);
  } catch (error) {
    console.error(`[Error] Execution failed: ${error.message}`);
    // console.error(error.stack);
    process.exit(1);
  }
}

main();
