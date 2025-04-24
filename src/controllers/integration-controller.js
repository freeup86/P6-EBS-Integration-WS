// src/controllers/integration-controller.js
const express = require('express');
const router = express.Router();
const { createAdvancedApiClient } = require('../utils/api-client');
const config = require('../config');
const logger = require('../utils/logger');
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const syncTrackingService = require('../services/sync-tracking-service');

// Create API clients
const p6Client = createAdvancedApiClient(config.p6);
const ebsClient = createAdvancedApiClient(config.ebs);

// =================================================
// START: Add Health Check Functions Here
// =================================================

/**
 * Performs a quick check to see if the P6 API is reachable.
 * @returns {Promise<boolean>} - True if reachable, false otherwise.
 */
async function checkP6Status() {
  try {
      // Make a simple GET request to a basic P6 endpoint.
      // '/projects' is often a good choice. Adjust if needed.
      // Use a short timeout (e.g., 5000ms = 5 seconds).
      logger.debug('Performing P6 health check...'); // Optional: Log check start
      await p6Client.get('/projects', { timeout: 5000 });
      logger.debug('P6 health check successful.'); // Optional: Log success
      return true; // Return true if the request succeeds (doesn't throw an error)
  } catch (error) {
      // Log specifics but return a simple boolean
      logger.warn('P6 health check failed:', {
          message: error.message,
          code: error.code, // e.g., 'ECONNREFUSED', 'ETIMEDOUT'
          status: error.response?.status // e.g., 401, 500
      });
      return false; // Return false for any error (timeout, connection error, HTTP error)
  }
}

/**
* Performs a quick check to see if the EBS API is reachable.
* @returns {Promise<boolean>} - True if reachable, false otherwise.
*/
async function checkEBSStatus() {
  try {
      // Make a simple GET request to a basic EBS endpoint.
      // '/projects' is used here as an example. Adjust if needed.
      // Use a short timeout.
      logger.debug('Performing EBS health check...'); // Optional: Log check start
      await ebsClient.get('/projects', { timeout: 5000 });
      logger.debug('EBS health check successful.'); // Optional: Log success
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
// END: Add Health Check Functions Here
// =================================================


/**
 * Sync Project from EBS to P6
 */
router.post('/ebs-to-p6/project/:projectId', async (req, res) => {
  const syncOperation = syncTrackingService.logSyncOperation({
    type: 'Project EBS to P6',
    source: `Project ${req.params.projectId}`,
    status: 'In Progress'
  });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS project to P6: ${projectId}`);
    
    const result = await ebsToP6Service.syncProjectFromEBSToP6(projectId);
    
    if (result.success) {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Completed',
        details: 'Successfully synced project from EBS to P6'
      });
      res.status(200).json(result);
    } else {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: result.message
      });
      res.status(500).json(result);
    }
  } catch (error) {
    syncTrackingService.updateSyncOperation(syncOperation.id, {
      status: 'Failed',
      details: error.message
    });
    logger.error('Error in EBS to P6 project sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync Tasks from EBS to P6 WBS
 */
router.post('/ebs-to-p6/tasks/:projectId', async (req, res) => {
  const syncOperation = syncTrackingService.logSyncOperation({
    type: 'Tasks EBS to P6',
    source: `Project ${req.params.projectId}`,
    status: 'In Progress'
  });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS tasks to P6 WBS: ${projectId}`);
    
    const result = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);
    
    if (result.success) {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Completed',
        details: `Successfully synced ${result.results?.length || 0} tasks from EBS to P6`
      });
      res.status(200).json(result);
    } else {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: result.message
      });
      res.status(500).json(result);
    }
  } catch (error) {
    syncTrackingService.updateSyncOperation(syncOperation.id, {
      status: 'Failed',
      details: error.message
    });
    logger.error('Error in EBS to P6 tasks sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync WBS from P6 to EBS Tasks
 */
router.post('/p6-to-ebs/wbs/:projectId', async (req, res) => {
  const syncOperation = syncTrackingService.logSyncOperation({
    type: 'WBS P6 to EBS',
    source: `Project ${req.params.projectId}`,
    status: 'In Progress'
  });

  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync P6 WBS to EBS tasks: ${projectId}`);
    
    const result = await p6ToEBSService.syncWBSFromP6ToEBSTasks(projectId);
    
    if (result.success) {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Completed',
        details: `Successfully synced ${result.results?.length || 0} WBS elements to EBS tasks`
      });
      res.status(200).json(result);
    } else {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: result.message
      });
      res.status(500).json(result);
    }
  } catch (error) {
    syncTrackingService.updateSyncOperation(syncOperation.id, {
      status: 'Failed',
      details: error.message
    });
    logger.error('Error in P6 to EBS WBS sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Sync Resource Assignments from P6 to EBS
 */
router.post('/p6-to-ebs/resources', async (req, res) => {
  const syncOperation = syncTrackingService.logSyncOperation({
    type: 'Resource Assignments P6 to EBS',
    source: 'All Projects',
    status: 'In Progress'
  });

  try {
    logger.info('Request to sync P6 resource assignments to EBS');
    
    const result = await p6ToEBSService.syncResourceAssignmentsFromP6ToEBS();
    
    if (result.success) {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Completed',
        details: `Successfully synced ${result.results?.length || 0} resource assignments`
      });
      res.status(200).json(result);
    } else {
      syncTrackingService.updateSyncOperation(syncOperation.id, {
        status: 'Failed',
        details: result.message
      });
      res.status(500).json(result);
    }
  } catch (error) {
    syncTrackingService.updateSyncOperation(syncOperation.id, {
      status: 'Failed',
      details: error.message
    });
    logger.error('Error in P6 to EBS resource assignments sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get EBS Projects (UI and API)
 */
router.get('/api/ebs/projects', async (req, res) => {
  try {
    // Fetch projects from EBS
    const response = await ebsClient.get('/projects');
    
    // Transform EBS API response to match existing frontend format
    const projects = response.data.map(project => ({
      projectNumber: project.code || project.id,
      projectName: project.name,
      projectStatus: project.status || 'UNKNOWN',
      plannedStart: project.startDate,
      plannedFinish: project.endDate
    }));
    
    res.json(projects);
  } catch (error) {
    logger.error('Error fetching EBS projects', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects', 
      details: error.message 
    });
  }
});

/**
 * Get P6 Projects (UI and API)
 */
router.get('/api/p6/projects', async (req, res) => {
  try {
    // Fetch projects from P6
    const response = await p6Client.get('/projects');
    
    // Transform P6 API response to match existing frontend format
    const projects = response.data.map(project => ({
      id: project.id,
      name: project.name,
      status: project.status || 'Unknown',
      startDate: project.plannedStartDate,
      finishDate: project.plannedFinishDate
    }));
    
    res.json(projects);
  } catch (error) {
    logger.error('Error fetching P6 projects', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects', 
      details: error.message 
    });
  }
});

/**
 * Render EBS Projects Page
 */
router.get('/ebs/projects', async (req, res) => {
  try {
    const response = await ebsClient.get('/projects');
    
    const projects = response.data.map(project => ({
      projectNumber: project.code || project.id,
      projectName: project.name,
      projectStatus: project.status || 'UNKNOWN',
      plannedStart: project.startDate,
      plannedFinish: project.endDate
    }));
    
    res.render('ebs-projects', { 
      title: 'EBS Projects', 
      projects: projects 
    });
  } catch (error) {
    logger.error('Error rendering EBS projects page', error);
    res.render('error', { 
      message: 'Unable to load EBS projects', 
      error: process.env.NODE_ENV === 'development' ? error : {} 
    });
  }
});

/**
 * Render P6 Projects Page
 */
router.get('/p6/projects', async (req, res) => {
  try {
    const response = await p6Client.get('/projects');
    
    const projects = response.data.map(project => ({
      id: project.id,
      name: project.name,
      status: project.status || 'Unknown',
      startDate: project.plannedStartDate,
      finishDate: project.plannedFinishDate
    }));
    
    res.render('p6-projects', { 
      title: 'P6 Projects', 
      projects: projects 
    });
  } catch (error) {
    logger.error('Error rendering P6 projects page', error);
    res.render('error', { 
      message: 'Unable to load P6 projects', 
      error: process.env.NODE_ENV === 'development' ? error : {} 
    });
  }
});

// --- Define or import your new health check functions ---
async function checkP6Status() {
  try {
      // Use the existing p6Client instance
      await p6Client.get('/projects', { timeout: 5000 }); // Example: GET /projects with 5s timeout
      return true; // Success if no error is thrown
  } catch (error) {
      logger.warn('P6 health check failed:', error.message); // Log the failure
      return false; // Failure on any error
  }
}

async function checkEBSStatus() {
  try {
      // Use the existing ebsClient instance
      await ebsClient.get('/projects', { timeout: 5000 }); // Example: GET /projects with 5s timeout
      return true;
  } catch (error) {
      logger.warn('EBS health check failed:', error.message);
      return false;
  }
}
// ------------------------------------------------------

/**
 * Render Sync Status Page
 */
router.get('/status', async (req, res) => {
  try {
    // Fetch recent sync operations
    const resultFromAwait = await syncTrackingService.getRecentSyncOperations(10);
    const plainSyncOperations = resultFromAwait; // Use plain data

    // --- Perform LIVE status checks ---
    const isP6Connected = await checkP6Status();
    const isEBSConnected = await checkEBSStatus();
    // ---------------------------------

    // Optional: Log the statuses being sent to the view
    logger.debug(`Rendering status page with P6=${isP6Connected}, EBS=${isEBSConnected}`);

    res.render('sync-status', {
      title: 'Integration Status',
      syncOperations: plainSyncOperations,
      p6Status: isP6Connected ? 'Connected' : 'Disconnected', // Pass status string
      ebsStatus: isEBSConnected ? 'Connected' : 'Disconnected' // Pass status string
    });
  } catch (error) {
     console.error('--- ERROR CAUGHT IN CONTROLLER /integration/status ---');
     console.error(error);
     logger.error('Error rendering sync status page', { /* ... */ });
     res.render('error', { /* ... */ });
  }
});

module.exports = router;