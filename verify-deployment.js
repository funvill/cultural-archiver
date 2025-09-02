#!/usr/bin/env node
/**
 * Deployment verification script for Cultural Archiver API
 * This script helps verify and diagnose deployment configuration issues
 * 
 * Usage: node verify-deployment.js [environment]
 * Examples:
 *   node verify-deployment.js production
 *   node verify-deployment.js staging
 *   node verify-deployment.js development
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseToml(content) {
  const lines = content.split('\n');
  const config = {};
  let currentSection = null;
  let arraySection = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Section headers
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const section = trimmed.slice(1, -1);
      if (section.includes('.')) {
        const parts = section.split('.');
        if (parts[0] === 'env') {
          const envName = parts[1];
          if (!config.env) config.env = {};
          if (!config.env[envName]) config.env[envName] = {};
          currentSection = config.env[envName];
          
          // Handle subsections like d1_databases, kv_namespaces, etc.
          if (parts.length > 2) {
            const subsection = parts[2];
            if (!currentSection[subsection]) currentSection[subsection] = [];
            arraySection = { parent: currentSection[subsection], type: subsection };
          } else {
            arraySection = null;
          }
        }
      } else if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
        // Array section like [[env.production.d1_databases]]
        const section = trimmed.slice(2, -2);
        const parts = section.split('.');
        if (parts[0] === 'env') {
          const envName = parts[1];
          const subsection = parts[2];
          if (!config.env) config.env = {};
          if (!config.env[envName]) config.env[envName] = {};
          if (!config.env[envName][subsection]) config.env[envName][subsection] = [];
          
          // Add new object to array
          const newObj = {};
          config.env[envName][subsection].push(newObj);
          arraySection = { parent: newObj, type: 'object' };
        }
      } else {
        if (!config[section]) config[section] = {};
        currentSection = config[section];
        arraySection = null;
      }
      continue;
    }
    
    // Key-value pairs
    if (trimmed.includes(' = ')) {
      const [key, ...valueParts] = trimmed.split(' = ');
      let value = valueParts.join(' = ').trim();
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      const target = arraySection && arraySection.type === 'object' ? arraySection.parent : 
                    currentSection || config;
      target[key.trim()] = value;
    }
  }
  
  return config;
}

function verifyEnvironment(env, envConfig) {
  console.log(`\n🔍 Verifying ${env} environment configuration...`);
  
  const issues = [];
  const warnings = [];
  
  // Check required bindings
  const requiredBindings = {
    'd1_databases': ['DB'],
    'kv_namespaces': ['SESSIONS', 'CACHE', 'RATE_LIMITS', 'MAGIC_LINKS'],
    'r2_buckets': ['PHOTOS_BUCKET']
  };
  
  for (const [bindingType, requiredNames] of Object.entries(requiredBindings)) {
    const bindings = envConfig[bindingType] || [];
    const bindingNames = bindings.map(b => b.binding);
    
    for (const required of requiredNames) {
      if (!bindingNames.includes(required)) {
        issues.push(`Missing ${bindingType} binding: ${required}`);
      } else {
        const binding = bindings.find(b => b.binding === required);
        
        // Check for placeholder values
        if (bindingType === 'd1_databases' && (!binding.database_id || binding.database_id === '')) {
          issues.push(`D1 database ${required} has empty database_id`);
        }
        if (bindingType === 'kv_namespaces' && (!binding.id || binding.id.includes('placeholder'))) {
          warnings.push(`KV namespace ${required} has placeholder ID: ${binding.id}`);
        }
        if (bindingType === 'r2_buckets' && !binding.bucket_name) {
          issues.push(`R2 bucket ${required} has empty bucket_name`);
        }
      }
    }
  }
  
  // Check environment variables
  const envVars = envConfig.vars || {};
  const requiredVars = ['ENVIRONMENT', 'FRONTEND_URL', 'API_VERSION'];
  
  for (const required of requiredVars) {
    if (!envVars[required]) {
      warnings.push(`Missing environment variable: ${required}`);
    }
  }
  
  // Check worker name
  if (!envConfig.name) {
    issues.push('Missing worker name');
  } else if (envConfig.name.includes('placeholder')) {
    warnings.push(`Worker name appears to be placeholder: ${envConfig.name}`);
  }
  
  return { issues, warnings };
}

function main() {
  const targetEnv = process.argv[2] || 'production';
  
  console.log('🚀 Cultural Archiver Deployment Configuration Verification');
  console.log(`📍 Target Environment: ${targetEnv}`);
  console.log('='.repeat(70));
  
  // Read wrangler.toml
  const configPath = path.join(__dirname, 'src', 'workers', 'wrangler.toml');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ wrangler.toml not found at:', configPath);
    process.exit(1);
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  const config = parseToml(configContent);
  
  console.log('✅ Found wrangler.toml configuration');
  console.log(`📊 Base worker name: ${config.name || 'not set'}`);
  console.log(`📊 Main file: ${config.main || 'not set'}`);
  console.log(`📊 Compatibility date: ${config.compatibility_date || 'not set'}`);
  
  // Check if target environment exists
  if (!config.env || !config.env[targetEnv]) {
    console.error(`❌ Environment '${targetEnv}' not found in configuration`);
    console.log('Available environments:', Object.keys(config.env || {}));
    process.exit(1);
  }
  
  const envConfig = config.env[targetEnv];
  const { issues, warnings } = verifyEnvironment(targetEnv, envConfig);
  
  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(70));
  
  if (issues.length === 0) {
    console.log('✅ No critical configuration issues found!');
  } else {
    console.log(`❌ Found ${issues.length} critical issue(s):`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} warning(s):`);
    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  // Deployment guidance
  console.log('\n' + '='.repeat(70));
  console.log('🔧 DEPLOYMENT GUIDANCE');
  console.log('='.repeat(70));
  
  if (issues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES DETECTED');
    console.log('These issues will likely cause deployment failures or "hello world" responses:');
    console.log('');
    console.log('💡 TO FIX:');
    console.log('1. Fill in all empty database_id values in wrangler.toml');
    console.log('2. Replace placeholder KV namespace IDs with real ones from Cloudflare dashboard');
    console.log('3. Ensure all R2 bucket names are set correctly');
    console.log('');
    console.log('📚 See: docs/deployment.md for detailed setup instructions');
  } else {
    console.log('\n✅ Configuration appears ready for deployment');
    console.log('');
    console.log('🚀 TO DEPLOY:');
    console.log(`cd src/workers && wrangler deploy --env ${targetEnv}`);
    console.log('');
    console.log('🔍 TO VERIFY:');
    console.log(`node debug-deployment.js https://your-domain.com`);
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    console.log('These may not prevent deployment but should be addressed:');
    warnings.forEach(warning => console.log(`- ${warning}`));
  }
  
  console.log('\n📚 For more help, see: docs/deployment.md');
  console.log('🔗 Run again with: node verify-deployment.js [environment]');
}

main();