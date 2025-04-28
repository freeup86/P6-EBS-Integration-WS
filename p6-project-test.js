// p6-project-test.js
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function testP6ProjectCreation() {
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
    // Modify these credentials with your actual P6 credentials
    const username = 'admin';
    const password = 'Dc0wboy$0526';
    const database = 'orcl19c';
    
    console.log('Authenticating with P6...');
    
    // The P6 API typically uses a login endpoint like this
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
    
    // Step 2: Now try to create the project
    // Get the EPS structure to find a valid ParentEPSObjectId
    console.log('Fetching EPS nodes...');
    const epsResponse = await client.get('/restapi/eps', {
    params: {
        Fields: 'ObjectId,Id,Name'
    }
    });

    // Get the first available EPS node ObjectId
    if (!epsResponse.data || !epsResponse.data.length) {
    throw new Error('No EPS nodes found. Cannot create project without a parent EPS.');
    }

    const parentEpsObjectId = epsResponse.data[0].ObjectId;
    console.log(`Using EPS node: ${epsResponse.data[0].Name} (ObjectId: ${parentEpsObjectId})`);

    // Step 3: Get the OBS structure to find a valid OBSObjectId
    console.log('Fetching OBS nodes...');
    const obsResponse = await client.get('/restapi/obs', {
    params: {
        Fields: 'ObjectId,GUID,Name'
    }
    });

    // Get the first available OBS node ObjectId
    if (!obsResponse.data || !obsResponse.data.length) {
    throw new Error('No OBS nodes found. Cannot create project without an OBS.');
    }

    const obsObjectId = obsResponse.data[0].ObjectId;
    console.log(`Using OBS node: ${obsResponse.data[0].Name} (ObjectId: ${obsObjectId})`);


    // Note: We're sending an array of project objects now
    const projectData = [{
        Name: 'Test Project ' + Date.now(),
        Id: 'TEST' + Date.now(),
        ParentEPSObjectId: parentEpsObjectId,
        OBSObjectId: obsObjectId
      }];
    
    console.log('Attempting to create project with data:', projectData);
    const response = await client.post('/restapi/project', projectData);
    
    console.log('Project created successfully!');
    console.log('Project ObjectId:', response.data[0].ObjectId);
    
  } catch (error) {
    console.error('Error testing P6 Project creation:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testP6ProjectCreation();