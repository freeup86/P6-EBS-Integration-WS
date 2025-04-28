const express = require('express');
const router = express.Router();
const axios = require('axios'); // <-- ADD THIS LINE
const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const syncTrackingService = require('../services/sync-tracking-service');
const mockEBSService = require('../services/mock/mock-ebs-service');
const useMockServices = require('../utils/service-switch');

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
        await ebsClient.get('/projects', { timeout: 5000 });
        logger.debug('EBS health check successful.');
        return true;
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
// ... (These remain as they were, including improved logging/await) ...
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
          const successCount = result.results?.filter(r => r.success).length || 0;
          const failCount = result.results?.filter(r => !r.success).length || 0;
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
    // Direct mock data (temporary solution)
    const projects = [
      {
        projectNumber: 'EBS1001',
        projectName: 'Office Building Construction',
        projectStatus: 'APPROVED',
        plannedStart: '2025-05-01',
        plannedFinish: '2026-01-15'
      },
      {
        projectNumber: 'EBS1002',
        projectName: 'Data Center Renovation',
        projectStatus: 'PENDING',
        plannedStart: '2025-06-15',
        plannedFinish: '2025-12-31'
      },
      {
        projectNumber: 'EBS1003',
        projectName: 'Campus Expansion',
        projectStatus: 'APPROVED',
        plannedStart: '2025-07-01',
        plannedFinish: '2026-05-30'
      }
    ];

    logger.info(`Returning ${projects.length} hard-coded mock EBS projects`);
    res.json(projects);
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
              // Correct the Fields list: Replace PlannedFinishDate with FinishDate
              Fields: 'Name,ObjectId,Status,PlannedStartDate,FinishDate', // <-- CORRECTED
              OrderBy: 'ObjectId desc' // Assuming this is valid based on previous tests
          }
      });

      // Log for debugging if needed
      // logger.debug('--- P6 API /restapi/project response.data: ---');
      // logger.debug(JSON.stringify(response.data, null, 2));

      if (!Array.isArray(response.data)) {
          logger.error('P6 API did not return an array for projects:', response.data);
          throw new Error('Unexpected response format from P6 API.');
      }

      // Adjust the map to use the corrected field name
      const projects = response.data.map(project => ({
          id: project.ObjectId,
          name: project.Name,
          status: project.Status || 'Unknown',
          startDate: project.PlannedStartDate,
          finishDate: project.FinishDate
      }));

      res.json(projects);
  } catch (error) {
      logger.error('Error fetching P6 projects for API', { /* ... */ });
      res.status(error.response?.status || 500).json({ /* ... */ });
  }
});


/**
 * Render EBS Projects Page
 */
router.get('/ebs/projects', async (req, res) => {
  try {
    let projectsData;
    
    if (useMockServices.ebs) {
      // Get data directly from mock service
      const projects = mockEBSService.getProjects();
      projectsData = projects.map(project => ({
        projectNumber: project.PROJECT_ID,
        projectName: project.NAME,
        projectStatus: project.STATUS_CODE,
        plannedStart: project.START_DATE,
        plannedFinish: project.COMPLETION_DATE
      }));
    } else {
      // Use the internal API endpoint
      const port = config.app.port || 3000;
      const apiUrl = `http://localhost:${port}/integration/api/ebs/projects`;
      logger.info(`Calling internal API: ${apiUrl}`);
      const projectsResponse = await axios.get(apiUrl);
      projectsData = projectsResponse.data;
    }
    
    res.render('ebs-projects', {
      title: 'EBS Projects',
      projects: projectsData
    });
  } catch (error) {
    logger.error('Error rendering EBS projects page', error.message);
    const apiErrorDetails = error.response?.data?.details || error.message;
    res.render('error', {
      message: `Unable to load EBS projects: ${apiErrorDetails}`,
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * Render P6 Projects Page
 */
router.get('/p6/projects', async (req, res) => {
    logger.info("Accessing P6 projects page render function");
    try {
        const port = config.app.port || 3000;
        const apiUrl = `http://localhost:${port}/integration/api/p6/projects`;
        logger.info(`Calling internal API: ${apiUrl}`);
        // V-- This was line 360 where the error occurred --V
        const projectsResponse = await axios.get(apiUrl); // <<< axios is used here

        logger.info(`Rendering p6-projects view with ${projectsResponse.data?.length || 0} projects.`);
        res.render('p6-projects', {
            title: 'P6 Projects',
            projects: projectsResponse.data
        });
    } catch (error) {
        logger.error('Error rendering P6 projects page:', {
            errorMessage: error.message,
            apiResponseStatus: error.response?.status,
            apiResponseData: error.response?.data
        });
        const apiErrorDetails = error.response?.data?.details || error.message;
        // Log the specific error before rendering the error page
        console.error("--- ERROR in GET /integration/p6/projects (Render Step) ---", error.message);
         if (error.response) {
             console.error("--- Internal API Response Status:", error.response.status);
             console.error("--- Internal API Response Data:", JSON.stringify(error.response.data, null, 2));
         }

        res.render('error', {
            message: `Unable to load P6 projects: ${apiErrorDetails}`,
            error: process.env.NODE_ENV === 'development' ? error : {}
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
      ebsStatus: isEBSConnected ? 'Connected' : 'Disconnected'
    });
  } catch (error) {
     console.error('--- ERROR CAUGHT IN CONTROLLER /integration/status ---');
     console.error(error);
     logger.error('Error rendering sync status page', { /* ... */ });
     res.render('error', { /* ... */ });
  }
});


module.exports = router;