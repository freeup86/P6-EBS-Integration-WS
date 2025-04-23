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

/**
 * Render Sync Status Page
 */
router.get('/status', async (req, res) => {
  try {
    // Fetch recent sync operations 
    const syncOperations = syncTrackingService.getRecentSyncOperations(10);
    
    res.render('sync-status', { 
      title: 'Integration Status', 
      syncOperations: syncOperations 
    });
  } catch (error) {
    logger.error('Error rendering sync status page', error);
    res.render('error', { 
      message: 'Unable to load sync status', 
      error: process.env.NODE_ENV === 'development' ? error : {} 
    });
  }
});

module.exports = router;