#!/usr/bin/env node

/**
 * Simple test runner for the /api/apis/generate-tests endpoint
 * This script can run tests without Jest
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'deploy-zen-five.vercel.app';
const ENDPOINT = '/api/apis/generate-tests';
const PORT = 443; // HTTPS port

// Test data
const VALID_API_ID = 'api_1754385443768_48ytmmxhy'; // Example valid API ID
const INVALID_API_ID = 'invalid_api_id_12345';
const EMPTY_API_ID = '';

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Utility functions
function logResult(testName, passed, errorMessage = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✓ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`✗ ${testName}`);
    if (errorMessage) {
      console.log(`  Error: ${errorMessage}`);
    }
  }
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Test functions
async function testMissingApiId() {
  const testName = 'Should return 400 when API ID is missing';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options, JSON.stringify({}));
    
    const passed = response.statusCode === 400 && 
                  response.data && 
                  response.data.success === false && 
                  response.data.error === 'API ID is required';
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testEmptyApiId() {
  const testName = 'Should return 400 when API ID is empty';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options, JSON.stringify({ apiId: EMPTY_API_ID }));
    
    const passed = response.statusCode === 400 && 
                  response.data && 
                  response.data.success === false && 
                  response.data.error === 'API ID is required';
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testInvalidApiId() {
  const testName = 'Should return 404 when API ID is not found';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options, JSON.stringify({ apiId: INVALID_API_ID }));
    
    const passed = response.statusCode === 404 && 
                  response.data && 
                  response.data.success === false && 
                  response.data.error === 'API not found';
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testWrongMethod() {
  const testName = 'Should return 405 for non-POST requests';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options);
    
    const passed = response.statusCode === 405 || response.statusCode === 404;
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testMalformedJson() {
  const testName = 'Should return 400 for malformed JSON';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options, '{"apiId":}'); // Invalid JSON
    
    const passed = response.statusCode === 400;
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testCorsHeaders() {
  const testName = 'Should have appropriate CORS headers';
  
  try {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const response = await makeRequest(options, JSON.stringify({ apiId: INVALID_API_ID }));
    
    const corsHeader = response.headers['access-control-allow-origin'];
    const passed = corsHeader === '*';
    
    logResult(testName, passed);
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('Running API tests for /api/apis/generate-tests endpoint...\n');
  
  // Run all tests
  await testMissingApiId();
  await testEmptyApiId();
  await testInvalidApiId();
  await testWrongMethod();
  await testMalformedJson();
  await testCorsHeaders();
  
  // Print summary
  console.log('\n--- Test Results ---');
  console.log(`Total tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  
  if (testResults.failed === 0) {
    console.log('\nAll tests passed! 🎉');
  } else {
    console.log(`\n${testResults.failed} test(s) failed. Please review.`);
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
if (require.main === module) {
  runTests();
}

// Export for use in other scripts
module.exports = {
  runTests,
  testResults
};