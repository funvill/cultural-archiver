#!/usr/bin/env node

/**
 * Mass Import Plugin System - CLI Entry Point
 *
 * This is the main entry point for the plugin CLI when run as a script.
 */

import { runCLI } from './plugin-cli.js';

// Execute the CLI
runCLI().catch(error => {
  console.error('CLI execution failed:', error);
  process.exit(1);
});
