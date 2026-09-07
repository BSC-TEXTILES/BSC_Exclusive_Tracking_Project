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
      // Save cookies from response
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
  console.log(`\n=== Logging in as ${username} ===`);
  const result = await testEndpoint('/api/auth/login', 'POST', { username, password });
  console.log(`Status: ${result.status}`);
  console.log(`Cookies: ${cookies}`);
  return result;
}

async function runAuthTests() {
  console.log('=== Authenticated API Tests ===\n');
  
  // Login as admin
  await login('admin', 'Admin@123456');
  
  // Test /api/auth/me
  console.log('\n1. Testing GET /api/auth/me...');
  let result = await testEndpoint('/api/auth/me');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test admin dashboard
  console.log('\n2. Testing GET /api/admin/dashboard...');
  result = await testEndpoint('/api/admin/dashboard');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Counts:`, JSON.stringify(result.data?.data?.counts, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test admin users
  console.log('\n3. Testing GET /api/admin/users...');
  result = await testEndpoint('/api/admin/users');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Users count: ${result.data?.data?.users?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test admin modules
  console.log('\n4. Testing GET /api/admin/modules...');
  result = await testEndpoint('/api/admin/modules');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Modules count: ${result.data?.data?.modules?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test tracking latest
  console.log('\n5. Testing GET /api/tracking/latest...');
  result = await testEndpoint('/api/tracking/latest');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Users tracked: ${result.data?.data?.users?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test notifications
  console.log('\n6. Testing GET /api/notifications...');
  result = await testEndpoint('/api/notifications');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Notifications count: ${result.data?.data?.items?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Logout
  console.log('\n7. Testing POST /api/auth/logout...');
  result = await testEndpoint('/api/auth/logout', 'POST');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Login as user
  await login('john.doe', 'User@123456');
  
  // Test user dashboard
  console.log('\n8. Testing GET /api/dashboard (user)...');
  result = await testEndpoint('/api/dashboard');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`KPIs:`, JSON.stringify(result.data?.data?.kpis, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test user modules
  console.log('\n9. Testing GET /api/modules (user)...');
  result = await testEndpoint('/api/modules');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Modules count: ${result.data?.data?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test user submissions history
  console.log('\n10. Testing GET /api/submissions/history (user)...');
  result = await testEndpoint('/api/submissions/history');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Submissions count: ${result.data?.data?.items?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test user reports
  console.log('\n11. Testing GET /api/reports (user)...');
  result = await testEndpoint('/api/reports');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Totals:`, JSON.stringify(result.data?.data?.totals, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test profile
  console.log('\n12. Testing GET /api/profile...');
  result = await testEndpoint('/api/profile');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Profile:`, JSON.stringify(result.data?.data?.profile, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Logout
  console.log('\n13. Testing POST /api/auth/logout...');
  result = await testEndpoint('/api/auth/logout', 'POST');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test supervisor login
  await login('jane.smith', 'Supervisor@123');
  
  // Test supervisor dashboard
  console.log('\n14. Testing GET /api/supervisor/dashboard...');
  result = await testEndpoint('/api/supervisor/dashboard');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Dashboard:`, JSON.stringify(result.data?.data, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test supervisor approvals
  console.log('\n15. Testing GET /api/supervisor/approvals...');
  result = await testEndpoint('/api/supervisor/approvals');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Approvals count: ${result.data?.data?.approvals?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test supervisor employees
  console.log('\n16. Testing GET /api/supervisor/employees...');
  result = await testEndpoint('/api/supervisor/employees');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Employees count: ${result.data?.data?.employees?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test supervisor projects
  console.log('\n17. Testing GET /api/supervisor/projects...');
  result = await testEndpoint('/api/supervisor/projects');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Projects count: ${result.data?.data?.projects?.length || 0}`);
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test supervisor reports
  console.log('\n18. Testing GET /api/supervisor/reports...');
  result = await testEndpoint('/api/supervisor/reports');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Reports:`, JSON.stringify(result.data?.data, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Logout
  await testEndpoint('/api/auth/logout', 'POST');
  
  // Test manager login
  await login('mike.ross', 'Manager@123');
  
  // Test manager access to admin endpoints (should fail)
  console.log('\n19. Testing GET /api/admin/dashboard (manager - should fail)...');
  result = await testEndpoint('/api/admin/dashboard');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test manager access to supervisor endpoints
  console.log('\n20. Testing GET /api/supervisor/dashboard (manager)...');
  result = await testEndpoint('/api/supervisor/dashboard');
  console.log(`Status: ${result.status}`);
  if (result.status === 200) {
    console.log(`Dashboard:`, JSON.stringify(result.data?.data, null, 2));
  } else {
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  await testEndpoint('/api/auth/logout', 'POST');
  
  console.log('\n=== All Auth Tests Complete ===');
}

runAuthTests().catch(console.error);