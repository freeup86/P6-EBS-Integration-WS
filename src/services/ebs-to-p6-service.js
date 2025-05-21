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
    const wbsData = [{
      Name: p6WBSData.WBS_NAME || task.TASK_NAME,
      Id: p6WBSData.WBS_ID || task.TASK_ID,
      Code: task.TASK_NUMBER || `WBS-${task.TASK_ID}`, // Required Code field
      ProjectObjectId: p6ProjectId,
      ParentObjectId: null, // Will be set if there's a parent
      Status: p6WBSData.STATUS_CODE || "Active"
    }];
    
    const wbsResponse = await p6Client.post('/restapi/wbs', wbsData);
    return wbsResponse.data[0].ObjectId;
  } catch (error) {
    logger.error(`Error finding/creating WBS for task ${task.TASK_ID}`, error);
    throw error;
  }
}

/**
 * Utility function to get standardized EBS project ID
 * @param {string} inputProjectId - Project ID in any format
 * @returns {string} - Formatted project ID that works with our services
 */
const getStandardizedProjectId = async (inputProjectId) => {
  // If not using mock service or already in EBS format, return as is
  if (!useMockServices.ebs || inputProjectId.startsWith('EBS')) {
    return inputProjectId;
  }
  
  try {
    // Get all projects from mock service
    const allProjects = mockEBSService.getProjects();
    
    // Find a matching project using various ID formats
    const matchingProject = allProjects.find(p => 
      p.PROJECT_ID === inputProjectId || 
      p.id === inputProjectId || 
      String(p.projectNumber) === String(inputProjectId)
    );
    
    if (matchingProject) {
      logger.info(`Mapped input project ID ${inputProjectId} to standard format ${matchingProject.PROJECT_ID}`);
      return matchingProject.PROJECT_ID;
    }
    
    // If no match found, return original
    logger.warn(`Could not map project ID ${inputProjectId} to standard format`);
    return inputProjectId;
  } catch (error) {
    logger.error(`Error standardizing project ID: ${error.message}`);
    return inputProjectId;
  }
};

/**
 * Synchronize project from EBS to P6
 * @param {string} ebsProjectId - Project ID in EBS
 * @returns {Promise<Object>} - Sync result
 */
const syncProjectFromEBSToP6 = async (ebsProjectId) => {
  try {
    // Standardize the project ID format
    const standardizedId = await getStandardizedProjectId(ebsProjectId);
    logger.info(`Using standardized project ID: ${standardizedId} (original: ${ebsProjectId})`);
    
    // 1. Fetch project details from EBS (real or mock)
    let ebsProject;
    
    if (useMockServices.ebs) {
      // Use mock service
      ebsProject = mockEBSService.getProject(standardizedId);
      if (!ebsProject) {
        // Try with original ID as fallback
        ebsProject = mockEBSService.getProject(ebsProjectId);
        if (!ebsProject) {
          throw new Error(`EBS project not found: ${standardizedId} (or original ID: ${ebsProjectId})`);
        }
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

    // 4. Create or update project in P6
    let p6ProjectId;
    if (existingP6Project) {
      // Update existing project
      const updateData = [{
        ObjectId: existingP6Project.ObjectId,
        Name: p6ProjectData.WBS_NAME || ebsProject.NAME,
        Status: p6ProjectData.STATUS_CODE || "Active"
      }];
      
      try {
        await p6Client.put('/restapi/project', updateData);
        p6ProjectId = existingP6Project.ObjectId;
        logger.info(`Updated existing project in P6: ${p6ProjectId}`);
      } catch (updateError) {
        logger.error('Error updating P6 project', {
          errorMessage: updateError.message,
          requestData: JSON.stringify(updateData),
          responseStatus: updateError.response?.status,
          responseData: updateError.response?.data
        });
        throw new Error(`Failed to update P6 project: ${updateError.message}`);
      }
    } else {
      // Create new project
      try {
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

        // Create minimal project data with just the required fields
        const createP6ProjectData = [{
          Name: p6ProjectData.WBS_NAME || ebsProject.NAME,
          Id: p6ProjectData.PROJ_ID || ebsProjectId,
          ParentEPSObjectId: parentEpsObjectId,
          Status: p6ProjectData.STATUS_CODE || "Active",
          Description: `Synchronized from EBS Project ${ebsProjectId}`
        }];
        
        // Try to create with minimal data first
        logger.info(`Attempting to create P6 project with data: ${JSON.stringify(createP6ProjectData)}`);
        
        try {
          const createResponse = await p6Client.post('/restapi/project', createP6ProjectData);
          
          // Debug the response format
          logger.info(`Project creation response:`, {
            responseData: createResponse.data,
            responseType: typeof createResponse.data
          });
          
          // Extract the ObjectId from the response
          if (createResponse.data && Array.isArray(createResponse.data) && createResponse.data.length > 0) {
            // The response format might be an array of objects with ObjectId property
            if (typeof createResponse.data[0] === 'object' && createResponse.data[0].ObjectId) {
              p6ProjectId = createResponse.data[0].ObjectId;
            } 
            // Or it might be just the ObjectId strings directly
            else if (typeof createResponse.data[0] === 'string') {
              p6ProjectId = createResponse.data[0];
            }
            // Or it might be the ID of the project we created
            else {
              // Fetch the created project to get its ObjectId
              const fetchResponse = await p6Client.get('/restapi/project', {
                params: { 
                  Fields: 'ObjectId,Id', 
                  Filter: `Id = '${ebsProjectId}'` 
                }
              });
              
              if (fetchResponse.data && Array.isArray(fetchResponse.data) && fetchResponse.data.length > 0) {
                p6ProjectId = fetchResponse.data[0].ObjectId;
              }
            }
          }
          
          logger.info(`Created new project in P6: ${p6ProjectId || 'ID not available'}`);
          
          // If we still don't have an ObjectId, use the project ID
          if (!p6ProjectId) {
            p6ProjectId = ebsProjectId;
            logger.warn(`Could not extract P6 ObjectId, using project ID instead: ${p6ProjectId}`);
          }
        } catch (createError) {
          logger.error('Error creating P6 project', {
            errorMessage: createError.message,
            requestData: JSON.stringify(createP6ProjectData),
            responseStatus: createError.response?.status,
            responseData: JSON.stringify(createError.response?.data)
          });
          
          // If the error mentions OBS is required, try to find a default OBS node
          if (createError.response?.data && 
              (createError.response.data.message || "").includes("OBS")) {
            logger.info("OBS appears to be required. Attempting to use default OBS node...");
            
            try {
              // Try to get OBS nodes
              const obsResponse = await p6Client.get('/restapi/obs', {
                params: {
                  Fields: 'ObjectId,Id,Name'
                }
              });
              
              if (obsResponse.data && obsResponse.data.length > 0) {
                const obsObjectId = obsResponse.data[0].ObjectId;
                logger.info(`Using OBS node: ${obsResponse.data[0].Name} (ObjectId: ${obsObjectId})`);
                
                // Add OBS to the project data
                createP6ProjectData[0].OBSObjectId = obsObjectId;
              } else {
                // If no OBS nodes found, try with a default value
                logger.warn("No OBS nodes found. Trying with default OBS ID 1...");
                createP6ProjectData[0].OBSObjectId = 1;
              }
              
              // Try creating again with OBS
              const retryResponse = await p6Client.post('/restapi/project', createP6ProjectData);
              p6ProjectId = retryResponse.data[0].ObjectId;
              logger.info(`Created new project in P6 with OBS: ${p6ProjectId}`);
            } catch (retryError) {
              logger.error('Error creating P6 project with OBS', {
                errorMessage: retryError.message,
                responseData: JSON.stringify(retryError.response?.data)
              });
              throw new Error(`Failed to create P6 project: ${retryError.message}`);
            }
          } else {
            throw new Error(`Failed to create P6 project: ${createError.message}`);
          }
        }
      } catch (error) {
        logger.error('Error in project creation process', error);
        throw error;
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
    // Log the incoming project ID
    logger.info(`Starting task sync for EBS project ID: ${ebsProjectId}`);
    logger.info(`Using mock EBS service: ${useMockServices.ebs}`);
    
    // Standardize the project ID format using our utility function
    const standardizedId = await getStandardizedProjectId(ebsProjectId);
    logger.info(`Using standardized project ID for task sync: ${standardizedId} (original: ${ebsProjectId})`);
    
    // 1. Fetch tasks from EBS (real or mock)
    let ebsTasks;
    
    if (useMockServices.ebs) {
      // Use mock service with standardized ID
      logger.info(`Fetching tasks from mock EBS service for project: ${standardizedId}`);
      ebsTasks = mockEBSService.getTasks(standardizedId);
      
      // If no tasks found with standardized ID, try original as fallback
      if ((!ebsTasks || ebsTasks.length === 0) && standardizedId !== ebsProjectId) {
        logger.info(`No tasks found with standardized ID, trying original ID: ${ebsProjectId}`);
        ebsTasks = mockEBSService.getTasks(ebsProjectId);
      }
      
      // Debug the mock service output
      logger.info(`Mock service task search result:`, {
        taskCount: Array.isArray(ebsTasks) ? ebsTasks.length : 'not an array',
        taskDataType: typeof ebsTasks,
        standardizedId: standardizedId,
        originalProjectId: ebsProjectId
      });
    } else {
      // Use real service
      logger.info(`Fetching tasks from real EBS service for project: ${ebsProjectId}`);
      const ebsTasksResponse = await ebsClient.get(`/projects/${ebsProjectId}/tasks`);
      ebsTasks = ebsTasksResponse.data;
    }
    
    // Check if tasks were found
    if (!ebsTasks || !Array.isArray(ebsTasks) || ebsTasks.length === 0) {
      logger.warn(`No tasks found for EBS project ${ebsProjectId}`);
      return { 
        success: true, 
        message: `No tasks found for EBS project ${ebsProjectId}`,
        results: {
          success: 0,
          failed: 0
        }
      };
    }

    logger.info(`Retrieved ${ebsTasks.length} tasks from EBS project ${ebsProjectId}`);

    // 2. Find corresponding P6 project - try with both standardized and original IDs
    let p6Project = null;
    let p6ProjectId = null;
    
    // Try multiple strategies to find the P6 project
    
    // Strategy 1: Try direct match on ID
    const p6ProjectsResponse = await p6Client.get('/restapi/project', {
      params: { 
        Fields: 'ObjectId,Id,Name',
        Filter: `Id = '${standardizedId}'` 
      }
    });
    
    if (p6ProjectsResponse.data && Array.isArray(p6ProjectsResponse.data) && p6ProjectsResponse.data.length > 0) {
      p6Project = p6ProjectsResponse.data[0];
      p6ProjectId = p6Project.ObjectId;
      logger.info(`Found P6 project by standard ID match: ${p6ProjectId}`);
    }
    // Strategy 2: If standardized ID is different, try with original ID
    else if (standardizedId !== ebsProjectId) {
      const altResponse = await p6Client.get('/restapi/project', {
        params: { 
          Fields: 'ObjectId,Id,Name',
          Filter: `Id = '${ebsProjectId}'` 
        }
      });
      
      if (altResponse.data && Array.isArray(altResponse.data) && altResponse.data.length > 0) {
        p6Project = altResponse.data[0];
        p6ProjectId = p6Project.ObjectId;
        logger.info(`Found P6 project by original ID match: ${p6ProjectId}`);
      }
    }
    
    // Strategy 3: Try to find by name search (more lenient)
    if (!p6Project) {
      // We might need to get the project name from EBS first
      let projectName = "";
      if (useMockServices.ebs) {
        // Use mock service
        const ebsProject = mockEBSService.getProject(standardizedId) || mockEBSService.getProject(ebsProjectId);
        if (ebsProject) {
          projectName = ebsProject.NAME;
        }
      }
      
      if (projectName) {
        const nameResponse = await p6Client.get('/restapi/project', {
          params: { 
            Fields: 'ObjectId,Id,Name'
          }
        });
        
        if (nameResponse.data && Array.isArray(nameResponse.data)) {
          // Find project with matching name or similar name
          const matchingProject = nameResponse.data.find(p => 
            p.Name === projectName || 
            p.Name.includes(projectName) || 
            projectName.includes(p.Name)
          );
          
          if (matchingProject) {
            p6Project = matchingProject;
            p6ProjectId = matchingProject.ObjectId;
            logger.info(`Found P6 project by name match: ${p6ProjectId}`);
          }
        }
      }
    }
    
    // Strategy 4: Use a default or fall back to the ID
    if (!p6Project) {
      logger.warn(`No P6 project found for EBS project ${ebsProjectId}. Using EBS project ID as fallback.`);
      p6ProjectId = standardizedId || ebsProjectId;
    }
    
    logger.info(`Using P6 project with ID: ${p6ProjectId} for WBS creation`);

    // Create a map to store WBS ObjectIds by task ID
    const wbsObjectIdMap = {};
    let successCount = 0;
    let failCount = 0;

    // 3. Process root tasks first (tasks with no parent)
    const rootTasks = ebsTasks.filter(task => !task.PARENT_TASK_ID);
    const childTasks = ebsTasks.filter(task => task.PARENT_TASK_ID);
    
    logger.info(`Processing ${rootTasks.length} root tasks and ${childTasks.length} child tasks`);
    
    // Process root tasks
    for (const task of rootTasks) {
      try {
        const p6WBSData = dataMapping.mapEBSTaskToP6WBS(task);
        
        // Create WBS data
        const rootWbsData = [{
          Name: p6WBSData.WBS_NAME || task.TASK_NAME,
          Id: task.TASK_ID,
          Code: task.TASK_NUMBER || `WBS-${task.TASK_ID}`,
          ProjectObjectId: p6ProjectId,
          Status: p6WBSData.STATUS_CODE || "Active"
        }];
        
        logger.info(`Creating WBS for root task ${task.TASK_ID}: ${JSON.stringify(rootWbsData)}`);
        
        try {
          // Create the WBS element
          const response = await p6Client.post('/restapi/wbs', rootWbsData);
          
          // Log the complete response data
          logger.info(`WBS creation response: ${JSON.stringify(response.data)}`);
          
          // The response is an array of strings containing the ObjectIds
          const wbsObjectId = response.data[0]; // Just take the first item directly
          
          // Verify we got a valid ObjectId
          if (!wbsObjectId) {
            logger.error(`Failed to get WBS ObjectId from response for task ${task.TASK_ID}, response: ${JSON.stringify(response.data)}`);
            failCount++;
            continue;
          }
          
          // Store the WBS ObjectId for this task
          wbsObjectIdMap[task.TASK_ID] = wbsObjectId;
          successCount++;
          
          logger.info(`Created WBS for task ${task.TASK_ID} with ObjectId ${wbsObjectId}`);
        } catch (postError) {
          // More detailed error logging
          logger.error(`Error posting WBS for task ${task.TASK_ID}:`, {
            errorMessage: postError.message,
            responseStatus: postError.response?.status,
            responseData: JSON.stringify(postError.response?.data),
            requestData: JSON.stringify(rootWbsData)
          });
          failCount++;
        }
      } catch (taskError) {
        logger.error(`Error mapping task ${task.TASK_ID} to WBS:`, {
          error: taskError.message
        });
        failCount++;
      }
    }
    
    // Process child tasks after root tasks (ensures parents exist first)
    for (const task of childTasks) {
      try {
        const p6WBSData = dataMapping.mapEBSTaskToP6WBS(task);
        const parentObjectId = wbsObjectIdMap[task.PARENT_TASK_ID];
        
        if (!parentObjectId) {
          logger.warn(`Parent WBS not found for task ${task.TASK_ID}, parent task ID: ${task.PARENT_TASK_ID}`);
          failCount++;
          continue; // Skip this task if parent not found
        }
        
        // Create WBS data
        const childWbsData = [{
          Name: p6WBSData.WBS_NAME || task.TASK_NAME,
          Id: task.TASK_ID,
          Code: task.TASK_NUMBER || `WBS-${task.TASK_ID}`, // Required Code field
          ProjectObjectId: p6ProjectId,
          ParentObjectId: parentObjectId,
          Status: p6WBSData.STATUS_CODE || "Active"
        }];
        
        logger.info(`Creating WBS for child task ${task.TASK_ID} with parent ${task.PARENT_TASK_ID}: ${JSON.stringify(childWbsData)}`);
        
        try {
          // Create the WBS element
          const response = await p6Client.post('/restapi/wbs', childWbsData);
          
          // The response is an array of strings containing the ObjectIds
          const wbsObjectId = response.data[0]; // Just take the first item directly
          
          // Store the WBS ObjectId for this task
          wbsObjectIdMap[task.TASK_ID] = wbsObjectId;
          successCount++;
          
          logger.info(`Created WBS for task ${task.TASK_ID} with parent ${task.PARENT_TASK_ID}, ObjectId ${wbsObjectId}`);
        } catch (postError) {
          logger.error(`Error posting WBS for child task ${task.TASK_ID}:`, {
            errorMessage: postError.message,
            responseStatus: postError.response?.status,
            responseData: JSON.stringify(postError.response?.data),
            requestData: JSON.stringify(childWbsData)
          });
          failCount++;
        }
      } catch (taskError) {
        logger.error(`Error mapping child task ${task.TASK_ID} to WBS:`, {
          error: taskError.message
        });
        failCount++;
      }
    }

    return { 
      success: true, 
      message: `Synchronized ${successCount} tasks as WBS elements, ${failCount} failed`,
      results: {
        success: successCount,
        failed: failCount,
        wbsMap: wbsObjectIdMap
      }
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

/**
 * Check P6 API health
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
const checkP6Health = async () => {
  try {
    await p6Client.get('/restapi/project', { 
      timeout: 5000, 
      params: { Fields: 'ObjectId', PageSize: 1 } 
    });
    return true;
  } catch (error) {
    logger.warn('P6 health check failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
    return false;
  }
};

/**
 * Check EBS API health
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
const checkEBSHealth = async () => {
  try {
    if (useMockServices.ebs) {
      // Use mock service directly
      const projects = mockEBSService.getProjects();
      return true;
    } else {
      await ebsClient.get('/projects', { timeout: 5000 });
      return true;
    }
  } catch (error) {
    logger.warn('EBS health check failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
    return false;
  }
};

/**
 * Get all projects from EBS
 * @returns {Promise<Array>} List of EBS projects
 */
const getAllEBSProjects = async () => {
  try {
    if (useMockServices.ebs) {
      return mockEBSService.getProjects();
    } else {
      const response = await ebsClient.get('/projects');
      return response.data;
    }
  } catch (error) {
    logger.error('Error getting all EBS projects:', error);
    throw error;
  }
};

/**
 * Get tasks for a specific EBS project
 * @param {string} projectId - Project ID in EBS
 * @returns {Promise<Array>} List of tasks for the project
 */
const getEBSProjectTasks = async (projectId) => {
  try {
    // Standardize the project ID format
    const standardizedId = await getStandardizedProjectId(projectId);
    
    if (useMockServices.ebs) {
      return mockEBSService.getTasks(standardizedId);
    } else {
      const response = await ebsClient.get(`/projects/${projectId}/tasks`);
      return response.data;
    }
  } catch (error) {
    logger.error(`Error getting tasks for EBS project ${projectId}:`, error);
    throw error;
  }
};

module.exports = {
  syncProjectFromEBSToP6,
  syncTasksFromEBSToP6WBS,
  authenticateEBS,
  authenticateP6,
  checkP6Health,
  checkEBSHealth,
  getAllEBSProjects,
  getEBSProjectTasks
};