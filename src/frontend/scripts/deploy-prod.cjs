#!/usr/bin/env node

/**
 * Frontend production deployment script that ensures production Clerk keys are used
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from root .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at project root');
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
    console.log(`🚀 Frontend Deploy: ${command} ${args.join(' ')}`);
    
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
    console.log('🔑 Frontend: Loading production Clerk keys...');
    
    // Load environment variables
    const envVars = loadEnvFile();
    
    // Verify required environment variables
    if (!envVars.VITE_CLERK_PUBLISHABLE_KEY_PROD) {
      console.error('❌ Missing VITE_CLERK_PUBLISHABLE_KEY_PROD in .env file');
      process.exit(1);
    }
    
    console.log('✅ Using production Clerk key for frontend deployment');
    
    // Set the production Clerk key and run deployment
    const deployEnv = {
      VITE_CLERK_PUBLISHABLE_KEY: envVars.VITE_CLERK_PUBLISHABLE_KEY_PROD,
      NODE_ENV: 'production',
      CI: 'true'
    };
    
    // Build with production environment
    await runCommand('npm', ['run', 'build:prod'], deployEnv);
    
    // Deploy with production environment
    await runCommand('npx', ['wrangler', 'deploy', '--env', 'production'], deployEnv);
    
    console.log('🎉 Frontend deployment completed successfully!');
    
  } catch (error) {
    console.error('💥 Frontend deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
main();