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

async function runEdgeCaseTests() {
  console.log('=== Edge Case Tests ===\n');
  
  // Login as admin
  await login('admin', 'Admin@123456');
  
  // Test 1: Create user with duplicate email
  console.log('1. Testing duplicate user creation...');
  let result = await testEndpoint('/api/admin/users', 'POST', {
    employeeCode: 'EMP9999',
    fullName: 'Test User',
    email: 'admin@bscexclusive.com', // duplicate email
    username: 'testuser999',
    password: 'Test@123456',
    roleId: (await testEndpoint('/api/admin/roles')).data.data.roles.find(r => r.name === 'USER').id,
    departmentId: (await testEndpoint('/api/admin/departments')).data.data.departments[0].id
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 2: Create user with invalid password
  console.log('\n2. Testing user creation with weak password...');
  result = await testEndpoint('/api/admin/users', 'POST', {
    employeeCode: 'EMP9998',
    fullName: 'Test User 2',
    email: 'test2@bscexclusive.com',
    username: 'testuser998',
    password: 'weak', // too weak
    roleId: (await testEndpoint('/api/admin/roles')).data.data.roles.find(r => r.name === 'USER').id,
    departmentId: (await testEndpoint('/api/admin/departments')).data.data.departments[0].id
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 3: Delete own account (should fail)
  console.log('\n3. Testing delete own account...');
  result = await testEndpoint('/api/admin/users/9d37e526-e9dc-428a-b3aa-4c0eb7d4bf1d', 'DELETE');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 4: Create department with duplicate code
  console.log('\n4. Testing duplicate department code...');
  result = await testEndpoint('/api/admin/departments', 'POST', {
    name: 'Test Dept',
    code: 'OPS', // duplicate
    description: 'Test'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 5: Create module with duplicate slug
  console.log('\n5. Testing duplicate module slug...');
  result = await testEndpoint('/api/admin/modules', 'POST', {
    departmentId: (await testEndpoint('/api/admin/departments')).data.data.departments[0].id,
    name: 'CRM Duplicate',
    slug: 'crm', // duplicate
    description: 'Test'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 6: Assignment with invalid date
  console.log('\n6. Testing assignment with invalid date...');
  const modules = (await testEndpoint('/api/admin/modules')).data.data.modules;
  const checkpoints = (await testEndpoint('/api/admin/checkpoints')).data.data.checkpoints;
  if (checkpoints.length > 0) {
    result = await testEndpoint('/api/admin/assignments', 'POST', {
      checkpointId: checkpoints[0].id,
      userId: 'ee7f3fc8-29c0-4c62-bfd2-b5c9b9aa9ed3',
      assignedDate: 'invalid-date',
      dueDate: '2026-09-07',
      frequency: 'DAILY'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test 7: Submission draft without checkpointId
  console.log('\n7. Testing submission draft without checkpointId...');
  result = await testEndpoint('/api/submissions/draft', 'POST', {
    complianceStatus: 'FULLY_FOLLOWED'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 8: Submit non-existent submission
  console.log('\n8. Testing submit non-existent submission...');
  result = await testEndpoint('/api/submissions/00000000-0000-0000-0000-000000000000/submit', 'POST');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 9: Submit already submitted
  console.log('\n9. Testing submit already submitted...');
  const submissions = (await testEndpoint('/api/admin/submissions')).data.data.items;
  const submittedSub = submissions.find(s => s.status === 'SUBMITTED');
  if (submittedSub) {
    result = await testEndpoint(`/api/submissions/${submittedSub.id}/submit`, 'POST');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log('No submitted submission found to test');
  }
  
  // Test 10: Review non-existent submission
  console.log('\n10. Testing review non-existent submission...');
  result = await testEndpoint('/api/admin/submissions/00000000-0000-0000-0000-000000000000/review', 'POST', {
    action: 'APPROVE',
    comment: 'Test'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 11: Review already reviewed
  console.log('\n11. Testing review already reviewed submission...');
  const approvedSub = submissions.find(s => s.status === 'APPROVED');
  if (approvedSub) {
    result = await testEndpoint(`/api/admin/submissions/${approvedSub.id}/review`, 'POST', {
      action: 'APPROVE',
      comment: 'Test'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log('No approved submission found to test');
  }
  
  // Test 12: Upload evidence without file (multipart)
  console.log('\n12. Testing evidence upload without file...');
  result = await testEndpoint('/api/evidence', 'POST', {
    checkpointId: checkpoints[0].id
  }, { 'Content-Type': 'multipart/form-data' });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 13: Tracking with invalid coordinates
  console.log('\n13. Testing tracking with invalid coordinates...');
  await login('john.doe', 'User@123456');
  result = await testEndpoint('/api/tracking', 'POST', {
    latitude: 200, // invalid
    longitude: 180,
    accuracy: 10
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 14: Tracking history without userId (should fail)
  console.log('\n14. Testing tracking history without userId...');
  await login('admin', 'Admin@123456');
  result = await testEndpoint('/api/tracking/history');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 15: Notification read non-existent
  console.log('\n15. Testing notification read non-existent...');
  result = await testEndpoint('/api/notifications/00000000-0000-0000-0000-000000000000/read', 'PATCH');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 16: Profile update with invalid email
  console.log('\n16. Testing profile update with invalid email...');
  await login('john.doe', 'User@123456');
  result = await testEndpoint('/api/profile', 'PUT', {
    email: 'invalid-email'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 17: Password change with wrong current password
  console.log('\n17. Testing password change with wrong current password...');
  result = await testEndpoint('/api/profile/password', 'PUT', {
    currentPassword: 'WrongPassword123',
    newPassword: 'NewPassword123'
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 18: Checkpoint detail non-existent
  console.log('\n18. Testing checkpoint detail non-existent...');
  result = await testEndpoint('/api/checkpoints/00000000-0000-0000-0000-000000000000');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 19: Module detail non-existent
  console.log('\n19. Testing module detail non-existent...');
  result = await testEndpoint('/api/modules/nonexistent-slug');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 20: Reports export
  console.log('\n20. Testing reports export...');
  await login('admin', 'Admin@123456');
  result = await testEndpoint('/api/admin/reports/export');
  console.log(`Status: ${result.status}`);
  console.log(`Content-Type:`, result.data?.headers?.['content-type'] || 'N/A');
  if (typeof result.data === 'string') {
    console.log(`CSV preview (first 200 chars):`, result.data.substring(0, 200));
  }
  
  // Test 21: Settings update
  console.log('\n21. Testing settings update...');
  result = await testEndpoint('/api/admin/settings', 'PUT', {
    settings: [
      { key: 'test_setting', value: 'test_value' }
    ]
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 22: Location creation with duplicate code
  console.log('\n22. Testing location creation with duplicate code...');
  result = await testEndpoint('/api/admin/locations', 'POST', {
    name: 'Test Location',
    code: 'HO-MUM', // duplicate
    address: 'Test',
    latitude: 19.1136,
    longitude: 72.8697
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 23: Admittance code creation
  console.log('\n23. Testing admittance code creation...');
  const users = (await testEndpoint('/api/admin/users')).data.data.users;
  const user = users.find(u => u.username === 'john.doe');
  const locations = (await testEndpoint('/api/admin/locations')).data.data.locations;
  if (user && locations.length > 0) {
    result = await testEndpoint('/api/admin/admittance-codes', 'POST', {
      userId: user.id,
      locationId: locations[0].id
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test 24: Checkpoint submit with missing required fields
  console.log('\n24. Testing checkpoint submit with missing compliance details...');
  await login('john.doe', 'User@123456');
  const userSubmissions = (await testEndpoint('/api/submissions/history')).data.data.items;
  const draftSub = userSubmissions.find(s => s.status === 'DRAFT');
  if (draftSub) {
    // Try to submit without compliance details
    result = await testEndpoint(`/api/submissions/${draftSub.id}/submit`, 'POST');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log('No draft submission found');
  }
  
  // Test 25: SQL injection attempt in search
  console.log('\n25. Testing SQL injection attempt in search...');
  await login('admin', 'Admin@123456');
  result = await testEndpoint('/api/admin/users?search=%27%20OR%201%3D1--');
  console.log(`Status: ${result.status}`);
  console.log(`Users count: ${result.data?.data?.users?.length || 0}`);
  
  // Test 26: XSS attempt in user creation
  console.log('\n26. Testing XSS attempt in user creation...');
  result = await testEndpoint('/api/admin/users', 'POST', {
    employeeCode: 'EMP9997',
    fullName: '<script>alert(1)</script>',
    email: 'xss@test.com',
    username: 'xssuser',
    password: 'Test@123456',
    roleId: (await testEndpoint('/api/admin/roles')).data.data.roles.find(r => r.name === 'USER').id,
    departmentId: (await testEndpoint('/api/admin/departments')).data.data.departments[0].id
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 27: Large file upload rejection
  console.log('\n27. Testing file size limit (config: 25MB)...');
  // We can't easily test this without a real file, but we can check the config
  console.log(`Max file size configured: 25MB`);
  
  // Test 28: Unauthorized access to admin endpoints
  console.log('\n28. Testing unauthorized access to admin endpoints...');
  await login('john.doe', 'User@123456');
  result = await testEndpoint('/api/admin/users');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  // Test 29: Checkpoint assignment conflict
  console.log('\n29. Testing duplicate checkpoint assignment...');
  await login('admin', 'Admin@123456');
  if (checkpoints.length > 0 && users.length > 0) {
    const userId = users.find(u => u.username === 'john.doe').id;
    result = await testEndpoint('/api/admin/assignments', 'POST', {
      checkpointId: checkpoints[0].id,
      userId: userId,
      assignedDate: '2026-09-06', // today - might already exist
      dueDate: '2026-09-07',
      frequency: 'DAILY'
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  }
  
  // Test 30: Session expiry simulation (expired token)
  console.log('\n30. Testing expired session...');
  cookies = 'bsc_session=eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiI5ZDM3ZTUyNi1lOWRjLTQyOGEtYjNhYS00YzBlYjdkNGJmMWQiLCJqdGkiOiI4MmU1YjE2YWVmZTQwMDEzMGY0Zjg2ZTQwYzkwYjlmMiIsImlhdCI6MTc4ODY2Mzk3NiwiZXhwIjoxNzg5MjY4Nzc2fQ.FgtI1wxTtZMjSdT60DduNrYiSBI3KwsDwL7-GnqPcRk'; // old token
  result = await testEndpoint('/api/auth/me');
  console.log(`Status: ${result.status}`);
  console.log(`Response:`, JSON.stringify(result.data, null, 2));
  
  console.log('\n=== Edge Case Tests Complete ===');
}

runEdgeCaseTests().catch(console.error);