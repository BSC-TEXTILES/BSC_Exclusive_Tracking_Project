const http = require('http');

async function testEndpoint(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing API Endpoints ===\n');
  
  // Test health endpoint
  console.log('1. Testing /api/health...');
  try {
    const result = await testEndpoint('/api/health');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test login with admin
  console.log('\n2. Testing POST /api/auth/login (admin)...');
  try {
    const result = await testEndpoint('/api/auth/login', 'POST', {
      username: 'admin',
      password: 'Admin@123456'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
    if (result.data?.data?.redirectUrl) {
      console.log(`   Redirect URL: ${result.data.data.redirectUrl}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test login with user
  console.log('\n3. Testing POST /api/auth/login (user)...');
  try {
    const result = await testEndpoint('/api/auth/login', 'POST', {
      username: 'john.doe',
      password: 'User@123456'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test invalid login
  console.log('\n4. Testing POST /api/auth/login (invalid credentials)...');
  try {
    const result = await testEndpoint('/api/auth/login', 'POST', {
      username: 'admin',
      password: 'wrongpassword'
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test rate limiting
  console.log('\n5. Testing rate limiting on auth...');
  for (let i = 0; i < 16; i++) {
    try {
      const result = await testEndpoint('/api/auth/login', 'POST', {
        username: 'testuser' + i,
        password: 'wrongpassword'
      });
      if (result.status === 429) {
        console.log(`   Rate limited at attempt ${i + 1}: ${result.data.message}`);
        break;
      }
    } catch (e) {
      console.log(`   Error on attempt ${i + 1}: ${e.message}`);
    }
  }
  
  // Test 404
  console.log('\n6. Testing 404 endpoint...');
  try {
    const result = await testEndpoint('/api/nonexistent');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  console.log('\n=== Test Complete ===');
}

runTests().catch(console.error);