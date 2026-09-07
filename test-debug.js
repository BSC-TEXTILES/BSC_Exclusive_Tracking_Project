const http = require('http');

let cookies = '';

async function testEndpoint(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookies = setCookie.map(c => c.split(';')[0]).join('; ');
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, cookies });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, cookies });
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

async function login(username, password) {
  const result = await testEndpoint('/api/auth/login', 'POST', { username, password });
  return result;
}

async function debugTests() {
  console.log('=== Debug Tests ===\n');
  
  // Login as admin
  await login('admin', 'Admin@123456');
  
  // Test 23: Admittance code creation
  console.log('1. Testing admittance code creation...');
  const users = (await testEndpoint('/api/admin/users')).data.data.users;
  const user = users.find(u => u.username === 'john.doe');
  const locations = (await testEndpoint('/api/admin/locations')).data.data.locations;
  if (user && locations.length > 0) {
    console.log(`   User ID: ${user.id}`);
    console.log(`   Location ID: ${locations[0].id}`);
    const result = await testEndpoint('/api/admin/admittance-codes', 'POST', {
      userId: user.id,
      locationId: locations[0].id
    });
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test 24: Checkpoint submit with missing compliance details
  console.log('\n2. Testing checkpoint submit with missing compliance details...');
  await login('john.doe', 'User@123456');
  const userSubmissions = (await testEndpoint('/api/submissions/history')).data.data.items;
  const draftSub = userSubmissions.find(s => s.status === 'DRAFT');
  if (draftSub) {
    console.log(`   Submission ID: ${draftSub.id}`);
    console.log(`   Submission Status: ${draftSub.status}`);
    console.log(`   Compliance Status: ${draftSub.complianceStatus}`);
    console.log(`   Accuracy Status: ${draftSub.accuracyStatus}`);
    // Try to submit without compliance details
    const result = await testEndpoint(`/api/submissions/${draftSub.id}/submit`, 'POST');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log('   No draft submission found');
    // Check all submissions
    console.log('   All submissions:', userSubmissions.map(s => ({id: s.id, status: s.status, compliance: s.complianceStatus, accuracy: s.accuracyStatus})));
  }
  
  // Test 15: Notification read non-existent
  console.log('\n3. Testing notification read non-existent...');
  await login('admin', 'Admin@123456');
  let result = await testEndpoint('/api/notifications/00000000-0000-0000-0000-000000000000/read', 'PATCH');
  console.log(`   Status: ${result.status}`);
  console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  
  // Test: Check if notification exists
  console.log('\n4. Checking notification count...');
  result = await testEndpoint('/api/notifications');
  console.log(`   Unread count: ${result.data?.data?.unreadCount}`);
  console.log(`   Items count: ${result.data?.data?.items?.length}`);
  
  console.log('\n=== Debug Complete ===');
}

debugTests().catch(console.error);