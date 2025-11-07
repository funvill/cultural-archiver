#!/usr/bin/env node

/**
 * Production deployment script that reads environment variables from .env file
 * and sets the correct Clerk production key for deployment
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  // Parse .env file
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
      envVars[key.trim()] = value.trim();
    }
  });
  
  return envVars;
}

// Run command with environment variables
function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ...env }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function main() {
  try {
    console.log('🚀 Starting production deployment with environment-based Clerk keys...');
    
    // Load environment variables
    const envVars = loadEnvFile();
    
    // Verify required environment variables
    if (!envVars.VITE_CLERK_PUBLISHABLE_KEY_PROD) {
      console.error('❌ Missing VITE_CLERK_PUBLISHABLE_KEY_PROD in .env file');
      process.exit(1);
    }
    
    console.log('🔑 Using production Clerk key from .env file');
    
    // Set the production Clerk key and run deployment
    const deployEnv = {
      VITE_CLERK_PUBLISHABLE_KEY: envVars.VITE_CLERK_PUBLISHABLE_KEY_PROD
    };
    
    await runCommand('npm', ['run', 'deploy:manual'], deployEnv);
    
    console.log('🎉 Production deployment completed successfully!');
    
  } catch (error) {
    console.error('💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
main();