const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const dataMapping = require('./data-mapping-service');
const useMockServices = require('../utils/service-switch');

// Import mock service
const mockEBSService = require('./mock/mock-ebs-service');

// Create advanced API clients for P6 - always use real P6 in your case
const p6Client = createAdvancedApiClient(config.p6);

// For EBS, decide which client to use based on the service switch
let ebsClient;
if (useMockServices.ebs) {
  logger.info('Using MOCK EBS service in p6-to-ebs-service');
  // No need to create an actual API client for mock
} else {
  logger.info('Using REAL EBS service in p6-to-ebs-service');
  ebsClient = createAdvancedApiClient(config.ebs);
}

// Authenticate with P6
const authenticateP6 = async () => {
  try {
    const response = await p6Client.post('/auth/login', {
      username: config.p6.username,
      password: config.p6.password
    });
    
    p6Client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    logger.info('Successfully authenticated with P6');
    return response.data.token;
  } catch (error) {
    logger.error('P6 Authentication Error:', error);
    throw new Error('Failed to authenticate with P6');
  }
};

// Authenticate with EBS
const authenticateEBS = async () => {
  try {
    let response;
    
    if (useMockServices.ebs) {
      // Use mock authentication
      response = { data: mockEBSService.authenticate() };
      logger.info('Successfully authenticated with Mock EBS');
    } else {
      // Use real authentication
      response = await ebsClient.post('/auth', {
        username: config.ebs.username,
        password: config.ebs.password
      });
      
      ebsClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      logger.info('Successfully authenticated with EBS');
    }
    
    return response.data.token;
  } catch (error) {
    logger.error('EBS Authentication Error:', error);
    throw new Error('Failed to authenticate with EBS');
  }
};

/**
 * Update EBS Tasks with data from P6 WBS
 * @param {string} p6ProjectId - Project ID in P6
 */
const syncWBSFromP6ToEBSTasks = async (p6ProjectId) => {
  try {
    // 1. Authenticate with both systems
    await authenticateP6();
    if (!useMockServices.ebs) {
      await authenticateEBS();
    }
    
    // 2. Get project details from P6
    const p6ProjectResponse = await p6Client.get(`/projects/${p6ProjectId}`);
    const p6Project = p6ProjectResponse.data;
    
    // Get the EBS project ID (which is stored as the P6 project ID)
    const ebsProjectId = p6Project.Id;
    
    // 3. Get all WBS elements from P6
    const p6WBSResponse = await p6Client.get(`/projects/${p6ProjectId}/wbs`);
    const p6WBSElements = p6WBSResponse.data || [];
    logger.info(`Retrieved ${p6WBSElements.length} WBS elements from P6 project`);
    
    // 4. Process each WBS element
    const results = [];
    for (const wbs of p6WBSElements) {
      try {
        // 5. Get activities under this WBS
        const activitiesResponse = await p6Client.get(`/wbs/${wbs.ObjectId}/activities`);
        const activities = activitiesResponse.data || [];
        
        // 6. Calculate WBS metrics from activities
        let earliestStart = null;
        let latestFinish = null;
        let totalPercentComplete = 0;
        let activityCount = 0;
        
        activities.forEach(activity => {
          // Calculate earliest start date
          if (activity.StartDate && (!earliestStart || new Date(activity.StartDate) < new Date(earliestStart))) {
            earliestStart = activity.StartDate;
          }
          
          // Calculate latest finish date
          if (activity.FinishDate && (!latestFinish || new Date(activity.FinishDate) > new Date(latestFinish))) {
            latestFinish = activity.FinishDate;
          }
          
          // Sum up percent complete
          if (activity.PercentComplete !== null && activity.PercentComplete !== undefined) {
            totalPercentComplete += activity.PercentComplete;
            activityCount++;
          }
        });
        
        // Calculate average percent complete
        const averagePercentComplete = activityCount > 0 ? totalPercentComplete / activityCount : 0;
        
        // 7. Update EBS Task with calculated metrics
        // The WBS ID in P6 corresponds to the Task ID in EBS
        const ebsTaskId = wbs.Id;
        
        const updateData = {
          startDate: earliestStart,
          endDate: latestFinish, // finishDate
          percentComplete: Math.round(averagePercentComplete)
        };
        
        // Only update if we have data to update
        if (earliestStart || latestFinish || activityCount > 0) {
          if (useMockServices.ebs) {
            // Use mock EBS service
            try {
              mockEBSService.updateTask(ebsProjectId, ebsTaskId, {
                START_DATE: earliestStart,
                COMPLETION_DATE: latestFinish,
                PHYSICAL_PERCENT_COMPLETE: Math.round(averagePercentComplete)
              });
              logger.info(`Updated EBS task ${ebsTaskId} with data from P6 WBS (mock)`);
            } catch (mockError) {
              throw new Error(`Mock EBS task update failed: ${mockError.message}`);
            }
          } else {
            // Use real EBS service
            await ebsClient.put(`/projects/${ebsProjectId}/tasks/${ebsTaskId}`, updateData);
            logger.info(`Updated EBS task ${ebsTaskId} with data from P6 WBS`);
          }
          
          results.push({ 
            wbsId: wbs.Id, 
            success: true,
            updates: {
              startDate: earliestStart,
              endDate: latestFinish,
              percentComplete: Math.round(averagePercentComplete)
            }
          });
        } else {
          logger.info(`Skipped updating EBS task ${ebsTaskId} - no activity data available`);
          results.push({ 
            wbsId: wbs.Id, 
            success: true,
            skipped: true,
            reason: 'No activity data available'
          });
        }
      } catch (wbsError) {
        logger.error(`Error processing WBS ${wbs.Id}:`, wbsError);
        results.push({ 
          wbsId: wbs.Id, 
          success: false, 
          error: wbsError.message 
        });
      }
    }
    
    return { success: true, results };
    
  } catch (error) {
    logger.error('Error syncing WBS from P6 to EBS Tasks:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

/**
 * Create or update Resource Assignments in EBS from P6
 */
const syncResourceAssignmentsFromP6ToEBS = async () => {
  try {
    // 1. Authenticate with both systems
    await authenticateP6();
    if (!useMockServices.ebs) {
      await authenticateEBS();
    }
    
    // 2. Get all resource assignments from P6
    const resourceAssignmentsResponse = await p6Client.get('/resourceassignments');
    const resourceAssignments = resourceAssignmentsResponse.data || [];
    logger.info(`Retrieved ${resourceAssignments.length} resource assignments from P6`);
    
    // 3. Process each resource assignment
    const results = [];
    for (const assignment of resourceAssignments) {
      try {
        // 4. Check if resource assignment exists in EBS
        // Resource ID in P6 matches Resource ID in EBS
        let assignmentExistsInEBS = false;
        
        if (useMockServices.ebs) {
          // Use mock service to check existence
          const mockAssignments = mockEBSService.getResourceAssignments();
          assignmentExistsInEBS = mockAssignments.some(
            a => a.resourceId === assignment.ResourceId && a.activityId === assignment.ActivityId
          );
        } else {
          // Use real service
          try {
            const ebsResponse = await ebsClient.get(`/resourceassignments?resourceId=${assignment.ResourceId}&activityId=${assignment.ActivityId}`);
            assignmentExistsInEBS = ebsResponse.data && ebsResponse.data.length > 0;
          } catch (checkError) {
            logger.warn(`Error checking if resource assignment exists in EBS: ${checkError.message}`);
          }
        }
        
        // 5. Create or update resource assignment in EBS
        if (assignmentExistsInEBS) {
          // Update existing resource assignment
          const updateData = {
            actualCost: assignment.ActualCost,
            actualDuration: assignment.ActualDuration,
            actualUnits: assignment.ActualUnits,
            actualStart: assignment.ActualStartDate,
            actualFinish: assignment.ActualFinishDate
          };
          
          if (useMockServices.ebs) {
            // Use mock service
            mockEBSService.updateResourceAssignment(
              assignment.ResourceId, 
              assignment.ActivityId, 
              updateData
            );
            logger.info(`Updated resource assignment in EBS for Resource: ${assignment.ResourceId}, Activity: ${assignment.ActivityId} (mock)`);
          } else {
            // Use real service
            await ebsClient.put(`/resourceassignments/${assignment.ResourceId}/${assignment.ActivityId}`, updateData);
            logger.info(`Updated resource assignment in EBS for Resource: ${assignment.ResourceId}, Activity: ${assignment.ActivityId}`);
          }
          
          results.push({
            resourceId: assignment.ResourceId,
            activityId: assignment.ActivityId,
            action: 'updated',
            success: true
          });
        } else {
          // Create new resource assignment
          const newAssignment = {
            resourceId: assignment.ResourceId,
            activityId: assignment.ActivityId,
            actualCost: assignment.ActualCost,
            actualDuration: assignment.ActualDuration,
            actualUnits: assignment.ActualUnits,
            actualStart: assignment.ActualStartDate,
            actualFinish: assignment.ActualFinishDate
          };
          
          if (useMockServices.ebs) {
            // Use mock service
            mockEBSService.createResourceAssignment(newAssignment);
            logger.info(`Created new resource assignment in EBS for Resource: ${assignment.ResourceId}, Activity: ${assignment.ActivityId} (mock)`);
          } else {
            // Use real service
            await ebsClient.post('/resourceassignments', newAssignment);
            logger.info(`Created new resource assignment in EBS for Resource: ${assignment.ResourceId}, Activity: ${assignment.ActivityId}`);
          }
          
          results.push({
            resourceId: assignment.ResourceId,
            activityId: assignment.ActivityId,
            action: 'created',
            success: true
          });
        }
      } catch (assignmentError) {
        logger.error(`Error processing resource assignment for Resource: ${assignment.ResourceId}, Activity: ${assignment.ActivityId}:`, assignmentError);
        results.push({
          resourceId: assignment.ResourceId,
          activityId: assignment.ActivityId,
          action: 'failed',
          success: false,
          error: assignmentError.message
        });
      }
    }
    
    return { success: true, results };
    
  } catch (error) {
    logger.error('Error syncing resource assignments from P6 to EBS:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

module.exports = {
  syncWBSFromP6ToEBSTasks,
  syncResourceAssignmentsFromP6ToEBS,
  authenticateP6,
  authenticateEBS
};