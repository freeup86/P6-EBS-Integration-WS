// src/services/ebs-to-p6-service.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const dataMapping = require('./data-mapping-service');

// P6 API client setup
const p6Client = axios.create({
  baseURL: config.p6.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// EBS API client setup
const ebsClient = axios.create({
  baseURL: config.ebs.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

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
    const response = await ebsClient.post('/auth', {
      username: config.ebs.username,
      password: config.ebs.password
    });
    
    ebsClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    logger.info('Successfully authenticated with EBS');
    return response.data.token;
  } catch (error) {
    logger.error('EBS Authentication Error:', error);
    throw new Error('Failed to authenticate with EBS');
  }
};

/**
 * Create or update project in P6 from EBS
 * @param {string} ebsProjectId - Project ID in EBS
 */
const syncProjectFromEBSToP6 = async (ebsProjectId) => {
  try {
    // 1. Authenticate with both systems
    await authenticateEBS();
    await authenticateP6();
    
    // 2. Get project details from EBS
    const ebsProjectResponse = await ebsClient.get(`/projects/${ebsProjectId}`);
    const ebsProject = ebsProjectResponse.data;
    
    logger.info(`Retrieved EBS project: ${ebsProject.NAME}`);
    
    // 3. Map EBS project data to P6 format
    const p6ProjectData = dataMapping.mapEBSProjectToP6(ebsProject);
    
    // 4. Check if project exists in P6 (by matching EBS Project Number with P6 Project ID)
    let projectExistsInP6 = false;
    let p6ProjectId = null;
    
    try {
      const p6Response = await p6Client.get(`/projects?filter=Id=${ebsProject.PROJECT_ID}`);
      if (p6Response.data && p6Response.data.length > 0) {
        projectExistsInP6 = true;
        p6ProjectId = p6Response.data[0].ObjectId;
        logger.info(`Project found in P6 with ID: ${p6ProjectId}`);
      }
    } catch (error) {
      logger.warn('Error checking if project exists in P6:', error.message);
    }
    
    // 5. Create or update project in P6
    if (projectExistsInP6) {
      // Update existing project with mapped fields
      const updateData = {
        Name: p6ProjectData.WBS_NAME,
        PlannedStartDate: p6ProjectData.ANTICIPATED_START_DATE,
        PlannedFinishDate: p6ProjectData.ANTICIPATED_FINISH_DATE,
        ProjectManager: p6ProjectData.RSRC_ID,
        Status: p6ProjectData.STATUS_CODE
      };
      
      await p6Client.put(`/projects/${p6ProjectId}`, updateData);
      logger.info(`Updated project in P6 with ID: ${p6ProjectId}`);
      
      return { success: true, message: 'Project updated in P6', p6ProjectId };
      
    } else {
      // Create new project with mapped fields
      const newProject = {
        Id: p6ProjectData.PROJ_ID,
        Name: p6ProjectData.WBS_NAME,
        PlannedStartDate: p6ProjectData.ANTICIPATED_START_DATE,
        PlannedFinishDate: p6ProjectData.ANTICIPATED_FINISH_DATE,
        ProjectManager: p6ProjectData.RSRC_ID,
        Status: p6ProjectData.STATUS_CODE,
        OBS: p6ProjectData.OBS_ID // Responsible manager
      };
      
      const createResponse = await p6Client.post('/projects', newProject);
      p6ProjectId = createResponse.data.ObjectId;
      logger.info(`Created new project in P6 with ID: ${p6ProjectId}`);
      
      return { success: true, message: 'Project created in P6', p6ProjectId };
    }
    
  } catch (error) {
    logger.error('Error syncing project from EBS to P6:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

/**
 * Create or update WBS elements in P6 from EBS Tasks
 * @param {string} ebsProjectId - Project ID in EBS
 */
const syncTasksFromEBSToP6WBS = async (ebsProjectId) => {
  try {
    // 1. Authenticate with both systems
    await authenticateEBS();
    await authenticateP6();
    
    // 2. Get project details from EBS to find corresponding P6 project
    const ebsProjectResponse = await ebsClient.get(`/projects/${ebsProjectId}`);
    const ebsProject = ebsProjectResponse.data;
    
    // 3. Find corresponding P6 project
    const p6Response = await p6Client.get(`/projects?filter=Id=${ebsProject.PROJECT_ID}`);
    if (!p6Response.data || p6Response.data.length === 0) {
      throw new Error(`P6 project not found for EBS project: ${ebsProjectId}`);
    }
    const p6ProjectId = p6Response.data[0].ObjectId;
    
    // 4. Get all tasks from EBS project
    const ebsTasksResponse = await ebsClient.get(`/projects/${ebsProjectId}/tasks`);
    const ebsTasks = ebsTasksResponse.data;
    logger.info(`Retrieved ${ebsTasks.length} tasks from EBS project`);
    
    // 5. Get existing WBS elements from P6
    const p6WBSResponse = await p6Client.get(`/projects/${p6ProjectId}/wbs`);
    const p6WBSElements = p6WBSResponse.data || [];
    
    // 6. Map existing WBS elements by ID for quick lookup
    const wbsMap = {};
    p6WBSElements.forEach(wbs => {
      wbsMap[wbs.Id] = wbs;
    });
    
    // 7. Process each task
    const results = [];
    for (const ebsTask of ebsTasks) {
      try {
        // Map EBS task to P6 WBS format
        const p6WBSData = dataMapping.mapEBSTaskToP6WBS(ebsTask);
        
        // Check if WBS exists in P6 (by matching EBS Task ID with P6 WBS ID)
        if (wbsMap[ebsTask.TASK_ID]) {
          // Update existing WBS
          const updateData = {
            Name: p6WBSData.WBS_NAME,
            Status: p6WBSData.STATUS_CODE
          };
          
          await p6Client.put(`/wbs/${wbsMap[ebsTask.TASK_ID].ObjectId}`, updateData);
          logger.info(`Updated WBS in P6 for EBS task: ${ebsTask.TASK_ID}`);
          results.push({ taskId: ebsTask.TASK_ID, action: 'updated', success: true });
        } else {
          // Create new WBS
          const newWBS = {
            ProjectObjectId: p6ProjectId,
            Id: p6WBSData.WBS_ID,
            Name: p6WBSData.WBS_NAME,
            ShortName: p6WBSData.WBS_SHORT_NAME,
            Status: p6WBSData.STATUS_CODE,
            ParentObjectId: p6WBSData.PARENT_WBS_ID ? wbsMap[p6WBSData.PARENT_WBS_ID]?.ObjectId : null
          };
          
          const createResponse = await p6Client.post('/wbs', newWBS);
          logger.info(`Created new WBS in P6 for EBS task: ${ebsTask.TASK_ID}`);
          results.push({ taskId: ebsTask.TASK_ID, action: 'created', success: true });
          
          // Update wbsMap for potential child tasks
          wbsMap[ebsTask.TASK_ID] = {
            ObjectId: createResponse.data.ObjectId,
            Id: p6WBSData.WBS_ID
          };
        }
      } catch (taskError) {
        logger.error(`Error processing task ${ebsTask.TASK_ID}:`, taskError);
        results.push({ taskId: ebsTask.TASK_ID, action: 'failed', success: false, error: taskError.message });
      }
    }
    
    return { success: true, results };
    
  } catch (error) {
    logger.error('Error syncing tasks from EBS to P6 WBS:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

module.exports = {
  syncProjectFromEBSToP6,
  syncTasksFromEBSToP6WBS,
  authenticateP6,
  authenticateEBS
};