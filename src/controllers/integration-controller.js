const express = require('express');
const router = express.Router();
const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const syncTrackingService = require('../services/sync-tracking-service');
const useMockServices = require('../utils/service-switch');
const mockEBSService = require('../services/mock/mock-ebs-service');

// Create API clients
const p6Client = createAdvancedApiClient(config.p6);
const ebsClient = createAdvancedApiClient(config.ebs);

// =================================================
// START: Health Check Functions (Keep from previous step)
// =================================================
async function checkP6Status() {
    try {
        logger.debug('Performing P6 health check...');
        await p6Client.get('/restapi/project', { timeout: 5000, params: { Fields: 'ObjectId', PageSize: 1 } });
        logger.debug('P6 health check successful.');
        return true;
    } catch (error) {
        logger.warn('P6 health check failed:', {
            message: error.message,
            code: error.code,
            status: error.response?.status
        });
        return false;
    }
}

async function checkEBSStatus() {
    try {
        logger.debug('Performing EBS health check...');
        if (useMockServices.ebs) {
            // Use mock service directly
            const projects = mockEBSService.getProjects();
            logger.debug('Mock EBS health check successful.');
            return true;
        } else {
            await ebsClient.get('/projects', { timeout: 5000 });
            logger.debug('EBS health check successful.');
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
}
// =================================================
// END: Health Check Functions
// =================================================

// --- Sync operation routes (POST endpoints) ---
/**
 * Sync All Projects from EBS to P6
 */
router.post('/ebs-to-p6/all-projects', async (req, res) => {
  try {
    logger.info('Request to sync all EBS projects to P6');
    
    // Get configuration options from request body
    const { syncTasks = false } = req.body;
    
    logger.info(`Sync tasks option: ${syncTasks}`);
    
    // Get all EBS projects
    let projects;
    if (useMockServices.ebs) {
      // Use mock service
      projects = mockEBSService.getProjects();
    } else {
      // Use real EBS service
      const response = await ebsClient.get('/projects');
      projects = response.data;
    }

    // Filter to only active/approved projects if needed
    const projectsToSync = projects.filter(project => {
      const status = project.STATUS_CODE || project.status;
      return status === 'APPROVED' || status === 'ACTIVE';
    });

    logger.info(`Found ${projectsToSync.length} eligible projects to sync`);

    // Keep track of results
    const results = {
      total: projectsToSync.length,
      succeeded: 0,
      failed: 0,
      details: [],
      taskSync: {
        total: 0,
        succeeded: 0,
        failed: 0
      }
    };

    // Create a sync operation record for the overall process
    const syncOperation = await syncTrackingService.logSyncOperation({
      type: syncTasks ? 'Bulk EBS to P6 Projects and Tasks' : 'Bulk EBS to P6 Projects',
      source: 'All Projects',
      status: 'In Progress'
    });

    // Process each project
    for (const project of projectsToSync) {
      try {
        // Get the project ID in the correct format - EBS projects use PROJECT_ID
        const projectId = project.PROJECT_ID || project.id || project.projectNumber;
        logger.info(`Processing project ${projectId}: ${project.NAME || project.name || project.projectName}`);
        
        // Debug project format
        logger.info('Project object structure:', {
          project: project,
          extractedId: projectId,
          availableProps: Object.keys(project)
        });
        
        // Sync project
        const result = await ebsToP6Service.syncProjectFromEBSToP6(projectId);
        
        if (result.success) {
          results.succeeded++;
          const projectDetail = {
            projectId,
            name: project.NAME || project.name,
            success: true,
            p6ProjectId: result.p6ProjectId,
            tasks: { success: false }
          };
          
          // Sync tasks if requested
          if (syncTasks) {
            try {
              // Log the result structure to debug
              logger.info(`Sync result for project ${projectId}:`, {
                resultStructure: result,
                hasP6ProjectId: !!result.p6ProjectId
              });
              
              // Get project's standardized ID if available 
              // (Could be EBS1001 in mock service, but projectNumber in our formatted data)
              let effectiveProjectId = projectId;
              
              // If we have a matching P6ProjectId, try to use it
              if (result.p6ProjectId) {
                logger.info(`Using P6 project ID for task lookup: ${result.p6ProjectId}`);
                effectiveProjectId = result.p6ProjectId;
              }
              
              // Try another format - this helps match our UI projectNumber with mock service PROJECT_ID
              if (project.PROJECT_ID && project.PROJECT_ID !== projectId) {
                logger.info(`Using PROJECT_ID from project object: ${project.PROJECT_ID}`);
                effectiveProjectId = project.PROJECT_ID;
              }
              
              // Get tasks for this project to verify there are tasks to sync
              let projectTasks = [];
              if (useMockServices.ebs) {
                // Try multiple ID formats for mock service
                logger.info(`Looking up tasks with ID: ${effectiveProjectId}`);
                projectTasks = mockEBSService.getTasks(effectiveProjectId);
                
                // If no tasks found and using different IDs, try original ID as fallback
                if ((!projectTasks || projectTasks.length === 0) && effectiveProjectId !== projectId) {
                  logger.info(`No tasks found with effective ID, trying original ID: ${projectId}`);
                  projectTasks = mockEBSService.getTasks(projectId);
                  
                  // Try standardized ID format if we still have no tasks
                  if (!projectTasks || projectTasks.length === 0) {
                    // Project IDs in mock service are in format "EBS1001" - try that pattern
                    if (typeof projectId === 'string' && !projectId.startsWith('EBS')) {
                      const mockId = `EBS${projectId}`;
                      logger.info(`Trying mock ID format: ${mockId}`);
                      projectTasks = mockEBSService.getTasks(mockId);
                    }
                  }
                }
              } else {
                const tasksResponse = await ebsClient.get(`/projects/${projectId}/tasks`);
                projectTasks = tasksResponse.data;
              }
              
              // Check actual task data
              logger.info(`Task lookup results for project ${projectId}:`, {
                taskCount: Array.isArray(projectTasks) ? projectTasks.length : 'not an array',
                taskDataSample: Array.isArray(projectTasks) && projectTasks.length > 0 
                  ? projectTasks.slice(0, 2) 
                  : projectTasks,
                effectiveProjectId
              });
              
              // Only attempt to sync if there are tasks
              if (projectTasks && Array.isArray(projectTasks) && projectTasks.length > 0) {
                logger.info(`Syncing ${projectTasks.length} tasks for project ${projectId}`);
                
                // Log the actual task data for debugging
                logger.info(`Task data sample for project ${projectId}:`, {
                  taskSample: projectTasks.slice(0, 2),
                  taskCount: projectTasks.length,
                  projectId: projectId
                });
                
                try {
                  const taskResult = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);
                  
                  // Log the complete task result for debugging
                  logger.info(`Task sync result for project ${projectId}:`, {
                    success: taskResult.success,
                    message: taskResult.message,
                    resultsDetails: taskResult.results
                  });
                  
                  // Update task sync results
                  if (taskResult.success) {
                    results.taskSync.total += (taskResult.results?.success || 0) + (taskResult.results?.failed || 0);
                    results.taskSync.succeeded += taskResult.results?.success || 0;
                    results.taskSync.failed += taskResult.results?.failed || 0;
                    
                    projectDetail.tasks = {
                      success: true,
                      synced: taskResult.results?.success || 0,
                      failed: taskResult.results?.failed || 0
                    };
                    
                    logger.info(`Successfully synced tasks for project ${projectId}: ${taskResult.results?.success || 0} succeeded, ${taskResult.results?.failed || 0} failed`);
                  } else {
                    logger.error(`Failed to sync tasks for project ${projectId}: ${taskResult.message}`);
                    projectDetail.tasks = {
                      success: false,
                      error: taskResult.message
                    };
                    results.taskSync.failed++;
                  }
                } catch (syncError) {
                  logger.error(`Exception during task sync for project ${projectId}:`, syncError);
                  projectDetail.tasks = {
                    success: false,
                    error: syncError.message
                  };
                  results.taskSync.failed++;
                }
              } else {
                logger.info(`No tasks found for project ${projectId}, skipping task sync. Task data:`, {
                  projectId: projectId,
                  taskDataType: typeof projectTasks,
                  taskCount: Array.isArray(projectTasks) ? projectTasks.length : 'not an array',
                  taskData: projectTasks
                });
                projectDetail.tasks = {
                  success: true,
                  synced: 0,
                  failed: 0,
                  message: "No tasks found for this project"
                };
              }
            } catch (taskError) {
              logger.error(`Error syncing tasks for project ${projectId}:`, taskError);
              projectDetail.tasks = {
                success: false,
                error: taskError.message
              };
              results.taskSync.failed++;
            }
          }
          
          results.details.push(projectDetail);
        } else {
          results.failed++;
          results.details.push({
            projectId,
            name: project.NAME || project.name,
            success: false,
            error: result.message
          });
        }
      } catch (error) {
        logger.error(`Error syncing project ${project.PROJECT_ID || project.id}:`, error);
        results.failed++;
        results.details.push({
          projectId: project.PROJECT_ID || project.id,
          name: project.NAME || project.name,
          success: false,
          error: error.message
        });
      }
    }

    // Update the sync operation record
    if (syncOperation?.id) {
      let detailsMessage = `Bulk project sync: ${results.succeeded} succeeded, ${results.failed} failed`;
      if (syncTasks) {
        detailsMessage += `. Tasks: ${results.taskSync.succeeded} succeeded, ${results.taskSync.failed} failed`;
      }
      
      await syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Completed',
        details: detailsMessage
      });
    }

    res.status(200).json({
      success: true,
      message: `Completed syncing ${results.total} projects: ${results.succeeded} succeeded, ${results.failed} failed`,
      results
    });
  } catch (error) {
    logger.error('Error in bulk EBS to P6 project sync endpoint:', error);
    
    const syncOperation = await syncTrackingService.logSyncOperation({
      type: 'Bulk EBS to P6 Projects',
      source: 'All Projects',
      status: 'Failed',
      details: error.message
    });
    
    res.status(500).json({ 
      success: false, 
      message: `Bulk sync failed: ${error.message}` 
    });
  }
});

/**
 * Sync Project from EBS to P6
 */
router.post('/ebs-to-p6/project/:projectId', async (req, res) => {
  const syncOperation = await syncTrackingService.logSyncOperation({ // Await the log operation
    type: 'Project EBS to P6',
    source: `Project ${req.params.projectId}`,
    status: 'In Progress'
  });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS project to P6: ${projectId}`);

    const result = await ebsToP6Service.syncProjectFromEBSToP6(projectId);

    if (result.success) {
      // Make sure syncOperation is available if logging succeeded
      if(syncOperation?.id) {
         await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Completed',
            details: `Successfully synced project from EBS to P6. P6 ObjectId: ${result.p6ProjectId || 'N/A'}`
         });
      }
      res.status(200).json(result);
    } else {
       if(syncOperation?.id) {
          await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Failed',
            details: result.message || 'Unknown error during project sync.'
          });
       }
      res.status(result.status || 500).json(result); // Use status from result if available
    }
  } catch (error) {
    logger.error('Error in EBS to P6 project sync endpoint:', error);
     if(syncOperation?.id) {
        await syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: error.message || 'Caught exception during project sync.'
        });
     }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync Tasks from EBS to P6 WBS
 */
router.post('/ebs-to-p6/tasks/:projectId', async (req, res) => {
    const syncOperation = await syncTrackingService.logSyncOperation({
        type: 'Tasks EBS to P6',
        source: `Project ${req.params.projectId}`,
        status: 'In Progress'
    });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS tasks to P6 WBS: ${projectId}`);

    const result = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);

    if (result.success) {
       if(syncOperation?.id) {
          const successCount = result.results?.success || 0;
          const failCount = result.results?.failed || 0;
          await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Completed', // Mark completed even if some tasks failed
            details: `Task sync finished. Success: ${successCount}, Failed: ${failCount}`
          });
       }
      res.status(200).json(result);
    } else {
      if(syncOperation?.id) {
         await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Failed',
            details: result.message || 'Unknown error during task sync.'
         });
      }
      res.status(result.status || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in EBS to P6 tasks sync endpoint:', error);
     if(syncOperation?.id) {
        await syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: error.message || 'Caught exception during task sync.'
        });
     }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync WBS from P6 to EBS Tasks
 */
router.post('/p6-to-ebs/wbs/:projectId', async (req, res) => {
    const syncOperation = await syncTrackingService.logSyncOperation({
        type: 'WBS P6 to EBS',
        source: `Project ${req.params.projectId}`,
        status: 'In Progress'
    });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync P6 WBS to EBS tasks: ${projectId}`);

    const result = await p6ToEBSService.syncWBSFromP6ToEBSTasks(projectId);

    if (result.success) {
       if(syncOperation?.id) {
           const successCount = result.results?.filter(r => r.success).length || 0;
           const failCount = result.results?.filter(r => !r.success).length || 0;
           await syncTrackingService.updateSyncOperation(syncOperation.id, {
                status: 'Completed',
                details: `WBS sync finished. Success: ${successCount}, Failed: ${failCount}`
           });
       }
      res.status(200).json(result);
    } else {
       if(syncOperation?.id) {
           await syncTrackingService.updateSyncOperation(syncOperation.id, {
                status: 'Failed',
                details: result.message || 'Unknown error during WBS sync.'
           });
       }
      res.status(result.status || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in P6 to EBS WBS sync endpoint:', error);
     if(syncOperation?.id) {
         await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Failed',
            details: error.message || 'Caught exception during WBS sync.'
         });
     }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync Resource Assignments from P6 to EBS
 */
router.post('/p6-to-ebs/resources', async (req, res) => {
    const syncOperation = await syncTrackingService.logSyncOperation({
        type: 'Resource Assignments P6 to EBS',
        source: 'All Projects', // Or adjust if filtered
        status: 'In Progress'
    });

  try {
    logger.info('Request to sync P6 resource assignments to EBS');

    const result = await p6ToEBSService.syncResourceAssignmentsFromP6ToEBS();

    if (result.success) {
       if(syncOperation?.id) {
          const successCount = result.results?.filter(r => r.success).length || 0;
          const failCount = result.results?.filter(r => !r.success).length || 0;
          await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Completed',
            details: `Resource assignment sync finished. Success: ${successCount}, Failed: ${failCount}`
          });
       }
      res.status(200).json(result);
    } else {
       if(syncOperation?.id) {
          await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Failed',
            details: result.message || 'Unknown error during resource assignment sync.'
          });
       }
      res.status(result.status || 500).json(result);
    }
  } catch (error) {
    logger.error('Error in P6 to EBS resource assignments sync endpoint:', error);
     if(syncOperation?.id) {
        await syncTrackingService.updateSyncOperation(syncOperation.id, {
            status: 'Failed',
            details: error.message || 'Caught exception during resource assignment sync.'
        });
     }
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============================================================
// UI Routes and API Endpoints for listing data
// ============================================================

/**
 * Get EBS Projects (Simple API for UI)
 */
router.get('/api/ebs/projects', async (req, res) => {
  try {
    let projects;
    
    if (useMockServices.ebs) {
      // Use mock service directly
      projects = mockEBSService.getProjects();
      logger.info(`Retrieved ${projects.length} projects from mock EBS service`);
    } else {
      // Use real EBS service
      const response = await ebsClient.get('/projects');
      projects = response.data;
      
      if (!Array.isArray(projects)) {
        logger.error('EBS API /projects did not return an array:', projects);
        throw new Error('Unexpected response format from EBS API.');
      }
    }

    const formattedProjects = projects.map(project => ({
      projectNumber: project.PROJECT_ID || project.code || project.id,
      projectName: project.NAME || project.name,
      projectStatus: project.STATUS_CODE || project.status || 'UNKNOWN',
      plannedStart: project.START_DATE || project.startDate,
      plannedFinish: project.COMPLETION_DATE || project.endDate
    }));

    res.json(formattedProjects);
  } catch (error) {
    logger.error('Error fetching EBS projects for API', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch EBS projects',
      details: error.message
    });
  }
});

/**
 * Get P6 Projects (Simple API for UI)
 */
router.get('/api/p6/projects', async (req, res) => {
  try {
    logger.info('Fetching P6 projects for API endpoint...');
    const response = await p6Client.get('/restapi/project', {
      params: {
        Fields: 'ObjectId,Id,Name,Status,PlannedStartDate,FinishDate',
        OrderBy: 'Id desc'
      }
    });

    if (!Array.isArray(response.data)) {
      logger.error('P6 API did not return an array for projects:', response.data);
      return res.json([]);
    }

    const projects = response.data.map(project => ({
      id: project.Id || project.ObjectId,
      name: project.Name,
      status: project.Status || 'Unknown',
      startDate: project.PlannedStartDate,
      finishDate: project.FinishDate
    }));

    res.json(projects);
  } catch (error) {
    logger.error('Error fetching P6 projects for API', error);
    res.json([]);
  }
});

/**
 * Render EBS Projects Page
 */
router.get('/ebs/projects', async (req, res) => {
  try {
    let projects;
    
    if (useMockServices.ebs) {
      // Get projects directly from mock service
      const mockProjects = mockEBSService.getProjects();
      projects = mockProjects.map(project => ({
        projectNumber: project.PROJECT_ID || project.id,
        projectName: project.NAME || project.name,
        projectStatus: project.STATUS_CODE || project.status || 'UNKNOWN',
        plannedStart: project.START_DATE || project.startDate,
        plannedFinish: project.COMPLETION_DATE || project.endDate
      }));
      logger.info(`Retrieved ${projects.length} projects from mock EBS service for UI`);
    } else {
      // Get projects from real EBS service
      const response = await ebsClient.get('/projects');
      
      if (!Array.isArray(response.data)) {
        logger.error('EBS API did not return an array for projects:', response.data);
        throw new Error('Unexpected response format from EBS API.');
      }
      
      projects = response.data.map(project => ({
        projectNumber: project.PROJECT_ID || project.code || project.id,
        projectName: project.NAME || project.name,
        projectStatus: project.STATUS_CODE || project.status || 'UNKNOWN',
        plannedStart: project.START_DATE || project.startDate,
        plannedFinish: project.COMPLETION_DATE || project.endDate
      }));
    }
    
    res.render('ebs-projects', {
      title: 'EBS Projects',
      projects: projects,
      user: null
    });
  } catch (error) {
    logger.error('Error rendering EBS projects page', error.message);
    const apiErrorDetails = error.response?.data?.details || error.message;
    res.render('error', {
      message: `Unable to load EBS projects: ${apiErrorDetails}`,
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: null
    });
  }
});

/**
 * Render P6 Projects Page
 */
router.get('/p6/projects', async (req, res) => {
  logger.info("Accessing P6 projects page render function");
  try {
    // Get projects directly from P6 API instead of through internal API
    const p6Response = await p6Client.get('/restapi/project', {
      params: {
        Fields: 'ObjectId,Id,Name,Status,PlannedStartDate,FinishDate',
        OrderBy: 'Id desc'
      }
    });
    
    // Process the response
    let projects = [];
    if (p6Response.data && Array.isArray(p6Response.data)) {
      projects = p6Response.data.map(project => ({
        id: project.Id || project.ObjectId,
        name: project.Name,
        status: project.Status || 'Unknown',
        startDate: project.PlannedStartDate,
        finishDate: project.FinishDate
      }));
    }
    
    logger.info(`Rendering p6-projects view with ${projects.length} projects.`);
    res.render('p6-projects', {
      title: 'P6 Projects',
      projects: projects,
      user: null
    });
  } catch (error) {
    logger.error('Error rendering P6 projects page:', {
        errorMessage: error.message,
        apiResponseStatus: error.response?.status,
        apiResponseData: error.response?.data
    });
    const apiErrorDetails = error.response?.data?.details || error.message;
    res.render('error', {
        message: `Unable to load P6 projects: ${apiErrorDetails}`,
        error: process.env.NODE_ENV === 'development' ? error : {},
        user: null
    });
  }
});

/**
 * Render Sync Status Page
 */
router.get('/status', async (req, res) => {
  try {
    const resultFromAwait = await syncTrackingService.getRecentSyncOperations(10);
    const plainSyncOperations = resultFromAwait;

    const isP6Connected = await checkP6Status();
    const isEBSConnected = await checkEBSStatus();

    logger.debug(`Rendering status page with P6=${isP6Connected}, EBS=${isEBSConnected}, Operations=${plainSyncOperations?.length}`);

    res.render('sync-status', {
      title: 'Integration Status',
      syncOperations: plainSyncOperations,
      p6Status: isP6Connected ? 'Connected' : 'Disconnected',
      ebsStatus: isEBSConnected ? 'Connected' : 'Disconnected',
      user: null
    });
  } catch (error) {
     console.error('--- ERROR CAUGHT IN CONTROLLER /integration/status ---');
     console.error(error);
     logger.error('Error rendering sync status page', error);
     res.render('error', {
       message: 'Error loading sync status page',
       error: process.env.NODE_ENV === 'development' ? error : {},
       user: null
     });
  }
});

module.exports = router;