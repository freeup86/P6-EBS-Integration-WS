const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const dataMapping = require('./data-mapping-service');

// Create advanced API clients for P6 and EBS
const p6Client = createAdvancedApiClient(config.p6);
const ebsClient = createAdvancedApiClient(config.ebs);

/**
 * Find or create WBS in P6
 * @param {string} p6ProjectId - P6 Project ID
 * @param {Object} task - EBS Task
 * @returns {Promise<string>} - WBS ID
 */
async function findOrCreateWBS(p6ProjectId, task) {
  try {
    // First, try to find existing WBS with external task ID
    const existingWBSResponse = await p6Client.get('/wbs', {
      params: { 
        projectId: p6ProjectId,
        externalTaskId: task.TASK_ID 
      }
    });

    if (existingWBSResponse.data.length > 0) {
      return existingWBSResponse.data[0].id;
    }

    // If not found, create new WBS
    const p6WBSData = dataMapping.mapEBSTaskToP6WBS(task);
    const wbsResponse = await p6Client.post('/wbs', {
      ...p6WBSData,
      projectId: p6ProjectId,
      externalTaskId: task.TASK_ID
    });

    return wbsResponse.data.id;
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
    // 1. Fetch project details from EBS
    const ebsProjectResponse = await ebsClient.get(`/projects/${ebsProjectId}`);
    const ebsProject = ebsProjectResponse.data;

    logger.info(`Retrieved EBS project: ${ebsProject.name}`);

    // 2. Map EBS project to P6 format
    const p6ProjectData = dataMapping.mapEBSProjectToP6(ebsProject);

    // 3. Check if project exists in P6
    let existingP6Project = null;
    try {
      const p6ProjectsResponse = await p6Client.get('/projects', {
        params: { 
          filter: `externalId=${ebsProjectId}` 
        }
      });
      existingP6Project = p6ProjectsResponse.data.length > 0 
        ? p6ProjectsResponse.data[0] 
        : null;
    } catch (projectCheckError) {
      logger.warn('Error checking P6 project existence', projectCheckError);
    }

    // 4. Create or update project in P6
    let p6ProjectId;
    if (existingP6Project) {
      // Update existing project
      const updateResponse = await p6Client.patch(`/projects/${existingP6Project.id}`, p6ProjectData);
      p6ProjectId = existingP6Project.id;
      logger.info(`Updated existing project in P6: ${p6ProjectId}`);
    } else {
      // Create new project
      const createResponse = await p6Client.post('/projects', {
        ...p6ProjectData,
        externalId: ebsProjectId  // Store EBS project ID for future reference
      });
      p6ProjectId = createResponse.data.id;
      logger.info(`Created new project in P6: ${p6ProjectId}`);
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
    // 1. Fetch tasks from EBS
    const ebsTasksResponse = await ebsClient.get(`/projects/${ebsProjectId}/tasks`);
    const ebsTasks = ebsTasksResponse.data;

    logger.info(`Retrieved ${ebsTasks.length} tasks from EBS project`);

    // 2. Find corresponding P6 project
    const p6ProjectsResponse = await p6Client.get('/projects', {
      params: { filter: `externalId=${ebsProjectId}` }
    });
    const p6Project = p6ProjectsResponse.data[0];

    if (!p6Project) {
      throw new Error(`No corresponding P6 project found for EBS project ${ebsProjectId}`);
    }

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
              parentWBSId = await findOrCreateWBS(p6Project.id, parentTask);
            }
          }

          // Create or update WBS
          const wbsResponse = await p6Client.post('/wbs', {
            ...p6WBSData,
            projectId: p6Project.id,
            parentId: parentWBSId,
            externalTaskId: task.TASK_ID
          });

          return {
            taskId: task.TASK_ID,
            wbsId: wbsResponse.data.id,
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
    const response = await ebsClient.post('/auth/token', {
      grant_type: 'client_credentials',
      client_id: config.ebs.clientId,
      client_secret: config.ebs.clientSecret
    });

    logger.info('Successfully authenticated with EBS');
    return response.data.access_token;
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