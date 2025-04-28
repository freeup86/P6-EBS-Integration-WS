const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const dataMapping = require('./data-mapping-service');
const useMockServices = require('../utils/service-switch');

// Import mock service (will be used conditionally)
const mockEBSService = require('./mock/mock-ebs-service');

// Create advanced API clients for P6 - always use real P6 in your case
const p6Client = createAdvancedApiClient(config.p6);

// For EBS, decide which client to use based on the service switch
let ebsClient;
if (useMockServices.ebs) {
  logger.info('Using MOCK EBS service');
  // No need to create an actual API client for mock
} else {
  logger.info('Using REAL EBS service');
  ebsClient = createAdvancedApiClient(config.ebs);
}

/**
 * Find or create WBS in P6
 * @param {string} p6ProjectId - P6 Project ID
 * @param {Object} task - EBS Task
 * @returns {Promise<string>} - WBS ID
 */
async function findOrCreateWBS(p6ProjectId, task) {
  try {
    // First, try to find existing WBS with external task ID
    const existingWBSResponse = await p6Client.get('/restapi/wbs', {
      params: { 
        Fields: 'ObjectId,Id,Name',
        Filter: `ProjectObjectId = ${p6ProjectId} and Id = '${task.TASK_ID}'`
      }
    });

    if (existingWBSResponse.data && existingWBSResponse.data.length > 0) {
      return existingWBSResponse.data[0].ObjectId;
    }

    // If not found, create new WBS
    const p6WBSData = dataMapping.mapEBSTaskToP6WBS(task);
    const wbsData = {
      Name: p6WBSData.WBS_NAME,
      Id: p6WBSData.WBS_ID,
      ProjectObjectId: p6ProjectId,
      ParentObjectId: null, // Will be set if there's a parent
      Status: p6WBSData.STATUS_CODE
    };
    
    const wbsResponse = await p6Client.post('/restapi/wbs', wbsData);
    return wbsResponse.data.ObjectId;
  } catch (error) {
    logger.error(`Error finding/creating WBS for task ${task.TASK_ID}`, error);
    throw error;
  }
}

/**
 * Synchronize project from EBS to P6
 * @param {string} ebsProjectId - Project ID in EBS
 * @returns {Promise<Object>} - Sync result
 */
const syncProjectFromEBSToP6 = async (ebsProjectId) => {
  try {
    // 1. Fetch project details from EBS (real or mock)
    let ebsProject;
    
    if (useMockServices.ebs) {
      // Use mock service
      ebsProject = mockEBSService.getProject(ebsProjectId);
      if (!ebsProject) {
        throw new Error(`EBS project not found: ${ebsProjectId}`);
      }
    } else {
      // Use real service
      const ebsProjectResponse = await ebsClient.get(`/projects/${ebsProjectId}`);
      ebsProject = ebsProjectResponse.data;
    }

    logger.info(`Retrieved EBS project: ${ebsProject.NAME}`);

    // 2. Map EBS project to P6 format
    const p6ProjectData = dataMapping.mapEBSProjectToP6(ebsProject);

    // 3. Check if project exists in P6
    let existingP6Project = null;
    try {
      const p6ProjectsResponse = await p6Client.get('/restapi/project', {
        params: { 
          Fields: 'ObjectId,Id,Name,Status', // Specify the fields to return
          Filter: `Id = '${ebsProjectId}'` // Use the field names defined in the schema
        }
      });
      
      // Check if any projects were returned
      if (p6ProjectsResponse.data && Array.isArray(p6ProjectsResponse.data) && p6ProjectsResponse.data.length > 0) {
        existingP6Project = p6ProjectsResponse.data[0];
        logger.info(`Found existing P6 project: ${existingP6Project.ObjectId} - ${existingP6Project.Name}`);
      } else {
        logger.info(`No matching P6 project found for EBS project ${ebsProjectId}`);
        existingP6Project = null;
      }
    } catch (projectCheckError) {
      logger.error('Error checking P6 project existence', {
        errorMessage: projectCheckError.message,
        responseStatus: projectCheckError.response?.status,
        responseData: projectCheckError.response?.data
      });
      
      // Log more detailed error information
      if (projectCheckError.response && projectCheckError.response.data) {
        logger.error('P6 API error details:', projectCheckError.response.data);
      }
    }

    // Get EPS And OBS for the Project
    // First, get available EPS nodes
    const epsResponse = await p6Client.get('/restapi/eps', {
      params: {
        Fields: 'ObjectId,Id,Name'
      }
    });

    if (!epsResponse.data || !epsResponse.data.length) {
      throw new Error('No EPS nodes found. Cannot create project without a parent EPS.');
    }

    const parentEpsObjectId = epsResponse.data[0].ObjectId;
    logger.info(`Using EPS node: ${epsResponse.data[0].Name} (ObjectId: ${parentEpsObjectId})`);

    // Next, get available OBS nodes
    const obsResponse = await p6Client.get('/restapi/obs', {
      params: {
        Fields: 'ObjectId,GUID,Name'
      }
    });

    if (!obsResponse.data || !obsResponse.data.length) {
      throw new Error('No OBS nodes found. Cannot create project without an OBS.');
    }

    const obsObjectId = obsResponse.data[0].ObjectId;
    logger.info(`Using OBS node: ${obsResponse.data[0].Name} (ObjectId: ${obsObjectId})`);


    // 4. Create or update project in P6
    let p6ProjectId;
    if (existingP6Project) {
      // Update existing project
      const updateResponse = await p6Client.patch(`/restapi/project/id=${existingP6Project.ObjectId}`, {
        Name: p6ProjectData.WBS_NAME || ebsProject.NAME,
        AnticipatedStartDate: p6ProjectData.ANTICIPATED_START_DATE || ebsProject.START_DATE,
        AnticipatedFinishDate: p6ProjectData.ANTICIPATED_FINISH_DATE || ebsProject.COMPLETION_DATE,
        Status: p6ProjectData.STATUS_CODE || "Active"
      });
      p6ProjectId = existingP6Project.ObjectId;
      logger.info(`Updated existing project in P6: ${p6ProjectId}`);
    } else {
      // Create new project
      const createP6ProjectData = [{
        Name: p6ProjectData.WBS_NAME || ebsProject.NAME,
        Id: p6ProjectData.PROJ_ID || ebsProjectId,
        ParentEPSObjectId: parentEpsObjectId,
        OBSObjectId: obsObjectId,
        Status: p6ProjectData.STATUS_CODE || "Active",
        Description: `Synchronized from EBS Project ${ebsProjectId}`
      }];
      
      try {
        const createResponse = await p6Client.post('/restapi/project', createP6ProjectData);
        p6ProjectId = createResponse.data[0].ObjectId;
        logger.info(`Created new project in P6: ${p6ProjectId}`);
      } catch (createError) {
        logger.error('Error creating P6 project', {
          errorMessage: createError.message,
          requestData: JSON.stringify(createP6ProjectData),
          responseStatus: createError.response?.status,
          responseData: JSON.stringify(createError.response?.data)
        });
        throw new Error(`Failed to create P6 project: ${createError.message}`);
      }
    }

    return { 
      success: true, 
      message: 'Project synchronized successfully', 
      p6ProjectId 
    };

  } catch (error) {
    logger.error('Project sync error', { 
      ebsProjectId, 
      errorMessage: error.message, 
      errorStack: error.stack 
    });

    return { 
      success: false, 
      message: `Sync failed: ${error.message}` 
    };
  }
};

/**
 * Synchronize tasks from EBS to P6 WBS
 * @param {string} ebsProjectId - Project ID in EBS
 * @returns {Promise<Object>} - Sync result
 */
const syncTasksFromEBSToP6WBS = async (ebsProjectId) => {
  try {
    // 1. Fetch tasks from EBS (real or mock)
    let ebsTasks;
    
    if (useMockServices.ebs) {
      // Use mock service
      ebsTasks = mockEBSService.getTasks(ebsProjectId);
    } else {
      // Use real service
      const ebsTasksResponse = await ebsClient.get(`/projects/${ebsProjectId}/tasks`);
      ebsTasks = ebsTasksResponse.data;
    }

    logger.info(`Retrieved ${ebsTasks.length} tasks from EBS project`);

    // 2. Find corresponding P6 project
    const p6ProjectsResponse = await p6Client.get('/restapi/project', {
      params: { 
        Fields: 'ObjectId,Id,Name',
        Filter: `Id = '${ebsProjectId}'` 
      }
    });
    
    if (!p6ProjectsResponse.data || !Array.isArray(p6ProjectsResponse.data) || p6ProjectsResponse.data.length === 0) {
      throw new Error(`No corresponding P6 project found for EBS project ${ebsProjectId}`);
    }
    
    const p6Project = p6ProjectsResponse.data[0];
    const p6ProjectId = p6Project.ObjectId;

    // 3. Process tasks
    const syncResults = await Promise.all(
      ebsTasks.map(async (task) => {
        try {
          const p6WBSData = dataMapping.mapEBSTaskToP6WBS(task);

          // Find parent WBS if applicable
          let parentWBSId = null;
          if (p6WBSData.PARENT_WBS_ID) {
            const parentTask = ebsTasks.find(t => t.TASK_ID === p6WBSData.PARENT_WBS_ID);
            if (parentTask) {
              parentWBSId = await findOrCreateWBS(p6ProjectId, parentTask);
            }
          }

          // Create or update WBS
          const wbsData = {
            Name: p6WBSData.WBS_NAME,
            Id: p6WBSData.WBS_ID,
            ProjectObjectId: p6ProjectId,
            ParentObjectId: parentWBSId,
            Status: p6WBSData.STATUS_CODE
          };
          
          // Check if WBS already exists
          const existingWBSResponse = await p6Client.get('/restapi/wbs', {
            params: { 
              Fields: 'ObjectId',
              Filter: `ProjectObjectId = ${p6ProjectId} and Id = '${task.TASK_ID}'`
            }
          });
          
          let wbsObjectId;
          if (existingWBSResponse.data && existingWBSResponse.data.length > 0) {
            // Update existing WBS
            wbsObjectId = existingWBSResponse.data[0].ObjectId;
            await p6Client.patch(`/restapi/wbs/id=${wbsObjectId}`, wbsData);
          } else {
            // Create new WBS
            const response = await p6Client.post('/restapi/wbs', wbsData);
            wbsObjectId = response.data.ObjectId;
          }

          return {
            taskId: task.TASK_ID,
            wbsId: wbsObjectId,
            success: true
          };
        } catch (taskSyncError) {
          logger.error(`Task sync error for task ${task.TASK_ID}`, taskSyncError);
          return {
            taskId: task.TASK_ID,
            success: false,
            error: taskSyncError.message
          };
        }
      })
    );

    return { 
      success: true, 
      results: syncResults 
    };

  } catch (error) {
    logger.error('Tasks sync error', error);
    return { 
      success: false, 
      message: `Sync failed: ${error.message}` 
    };
  }
};

/**
 * Authenticate with EBS
 * @returns {Promise<string>} - Authentication token
 */
const authenticateEBS = async () => {
  try {
    let response;
    
    if (useMockServices.ebs) {
      // Use mock authentication
      response = { data: mockEBSService.authenticate() };
    } else {
      // Use real authentication
      response = await ebsClient.post('/auth/token', {
        grant_type: 'client_credentials',
        client_id: config.ebs.clientId,
        client_secret: config.ebs.clientSecret
      });
    }

    logger.info('Successfully authenticated with EBS');
    return response.data.access_token || response.data.token;
  } catch (error) {
    logger.error('EBS Authentication Error', error);
    throw new Error('Failed to authenticate with EBS');
  }
};

/**
 * Authenticate with P6
 * @returns {Promise<string>} - Authentication token
 */
const authenticateP6 = async () => {
  try {
    const response = await p6Client.post('/auth/token', {
      grant_type: 'client_credentials',
      client_id: config.p6.clientId,
      client_secret: config.p6.clientSecret
    });

    logger.info('Successfully authenticated with P6');
    return response.data.access_token;
  } catch (error) {
    logger.error('P6 Authentication Error', error);
    throw new Error('Failed to authenticate with P6');
  }
};

module.exports = {
  syncProjectFromEBSToP6,
  syncTasksFromEBSToP6WBS,
  authenticateEBS,
  authenticateP6
};