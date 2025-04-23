const dataMapping = require('../src/services/data-mapping-service');

// Test data
const sampleP6Project = {
  PROJ_ID: 'P1001',
  WBS_NAME: 'Office Building Construction',
  ANTICIPATED_START_DATE: '2025-05-01',
  ANTICIPATED_FINISH_DATE: '2026-01-15',
  STATUS_CODE: 'Active',
  RSRC_ID: 'PM1001',
  OBS_ID: 'OBS1'
};

// Test mapping functions
console.log('Testing P6 Project to EBS mapping:');
const ebsProject = dataMapping.mapP6ProjectToEBS(sampleP6Project);
console.log(JSON.stringify(ebsProject, null, 2));

console.log('\nTesting status mapping:');
console.log('P6 Active -> EBS:', dataMapping.mapP6StatusToEBSStatus('Active'));
console.log('EBS APPROVED -> P6:', dataMapping.mapEBSStatusToP6Status('APPROVED'));

console.log('\nTesting duration calculation:');
const days = dataMapping.calculateDurationInDays('2025-05-01', '2025-05-15');
console.log('Duration between 2025-05-01 and 2025-05-15:', days, 'days');