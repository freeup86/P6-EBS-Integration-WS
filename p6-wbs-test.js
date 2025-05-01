// p6-wbs-test.js
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const specificProjectId = 'EBS1001';
async function testP6WBSCreation() {
  try {
    // Create a cookie jar for session cookies
    const cookieJar = new tough.CookieJar();
    
    // Configure API client with cookie support
    const baseUrl = 'http://10.211.55.5:8206/p6ws';
    const client = wrapper(axios.create({
      baseURL: baseUrl,
      jar: cookieJar,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }));
    
    // Log all requests and responses for debugging
    client.interceptors.request.use(req => {
      console.log(`Request: ${req.method.toUpperCase()} ${req.url}`);
      console.log('Request Data:', JSON.stringify(req.data, null, 2));
      return req;
    });
    
    client.interceptors.response.use(
      res => {
        console.log(`Response Status: ${res.status}`);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
        return res;
      },
      err => {
        console.error('Error Status:', err.response?.status);
        console.error('Error Data:', JSON.stringify(err.response?.data, null, 2));
        return Promise.reject(err);
      }
    );
    
    // Step 1: Authenticate with P6
    const username = 'admin';
    const password = 'Dc0wboy$0526';
    const database = 'orcl19c';
    
    console.log('Authenticating with P6...');
    const loginResponse = await client.post('/restapi/login', null, {
      headers: {
        'username': username,
        'password': password
      },
      params: {
        DatabaseName: database
      }
    });
    
    console.log('Authentication successful! Session established.');
    
    // Step 2: Get a project to add WBS elements to
    console.log('Fetching projects...');
    const projectResponse = await client.get('/restapi/project', {
        params: {
          Fields: 'ObjectId,Id,Name',
          Filter: `Id = '${specificProjectId}'`
        }
      });
    
    if (!projectResponse.data || !projectResponse.data.length) {
      throw new Error('No projects found to add WBS elements to.');
    }
    
    const projectObjectId = projectResponse.data[0].ObjectId;
    console.log(`Using project: ${projectResponse.data[0].Name} (ObjectId: ${projectObjectId})`);
    
    // Step 3: Create a simple WBS element
    const wbsData = [{
        Name: 'Test WBS ' + Date.now(),
        Id: 'WBS' + Date.now(),
        Code: 'WBS-TEST-' + Date.now().toString().slice(-4), // Add the required Code field
        ProjectObjectId: projectObjectId,
        Status: 'Active'
      }];
    
    console.log('Attempting to create WBS with data:', wbsData);
    const response = await client.post('/restapi/wbs', wbsData);
    
    console.log('WBS created successfully!');
    console.log('WBS ObjectId:', response.data[0].ObjectId);
    
  } catch (error) {
    console.error('Error testing P6 WBS creation:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testP6WBSCreation();