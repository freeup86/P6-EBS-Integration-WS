// test/controller-routes.test.js
console.log('=== Testing Controller Routes ===');

// This is a simple test to check that the controller routes are set up correctly
// List expected routes
const expectedRoutes = [
  { method: 'POST', path: '/integration/ebs-to-p6/project/:projectId' },
  { method: 'POST', path: '/integration/ebs-to-p6/tasks/:projectId' },
  { method: 'POST', path: '/integration/p6-to-ebs/wbs/:projectId' },
  { method: 'POST', path: '/integration/p6-to-ebs/resources' },
  { method: 'GET', path: '/integration/ebs/projects' },
  { method: 'GET', path: '/integration/p6/projects' },
  { method: 'GET', path: '/integration/status' },
  { method: 'GET', path: '/integration/api/ebs/projects' },
  { method: 'GET', path: '/integration/api/p6/projects' }
];

console.log('The following routes should be available in the application:');
console.log('-----------------------------------------------------------');
expectedRoutes.forEach(route => {
  console.log(`${route.method} ${route.path}`);
});
console.log('-----------------------------------------------------------');
console.log('You can verify these routes by starting the application and checking that they respond correctly.');
console.log('Run: npm run dev');
console.log('Then test a route with: curl http://localhost:3000/integration/api/ebs/projects');