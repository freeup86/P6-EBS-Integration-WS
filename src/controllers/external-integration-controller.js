// src/controllers/external-integration-controller.js
const express = require('express');
const router = express.Router();
const { verifyApiKey } = require('../middleware/api-key-middleware');
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const syncTrackingService = require('../services/sync-tracking-service');
const logger = require('../utils/logger');

// Apply API key authentication to all routes in this controller
router.use(verifyApiKey);

/**
 * @api {post} /api/v1/integration/sync/ebs-to-p6 Sync EBS projects to P6
 * @apiName SyncEBSToP6
 * @apiGroup Integration
 * @apiVersion 1.0.0
 * @apiDescription Synchronize projects from Oracle EBS to Primavera P6
 * 
 * @apiHeader {String} x-api-key Integration API Key
 * 
 * @apiParam {Boolean} [syncTasks=false] Whether to sync tasks as WBS elements
 * @apiParam {String} [projectId] Optional specific project ID to sync; if not provided, syncs all projects
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {String} message Human-readable message describing the result
 * @apiSuccess {Object} results Detailed results of the operation
 * @apiSuccess {Number} results.total Total number of projects processed
 * @apiSuccess {Number} results.succeeded Number of projects successfully synced
 * @apiSuccess {Number} results.failed Number of projects that failed to sync
 * @apiSuccess {Object} [results.taskSync] Task sync results if syncTasks is true
 * 
 * @apiExample {curl} Example usage - Sync all projects with tasks:
 *     curl -X POST -H "x-api-key: your-api-key" -H "Content-Type: application/json" 
 *          -d '{"syncTasks": true}' 
 *          https://your-server/api/v1/integration/sync/ebs-to-p6
 * 
 * @apiExample {curl} Example usage - Sync specific project:
 *     curl -X POST -H "x-api-key: your-api-key" -H "Content-Type: application/json" 
 *          -d '{"projectId": "EBS1001", "syncTasks": true}' 
 *          https://your-server/api/v1/integration/sync/ebs-to-p6
 */
router.post('/sync/ebs-to-p6', async (req, res) => {
  try {
    const { syncTasks = false, projectId } = req.body;
    
    // If projectId is provided, sync a specific project
    if (projectId) {
      logger.info(`External API request to sync specific EBS project to P6: ${projectId}`);
      
      // Log the sync operation
      const syncOperation = await syncTrackingService.logSyncOperation({
        type: syncTasks ? 'External API: Project+Tasks EBS to P6' : 'External API: Project EBS to P6',
        source: `Project ${projectId}`,
        status: 'In Progress'
      });
      
      // Sync the project
      const projectResult = await ebsToP6Service.syncProjectFromEBSToP6(projectId);
      
      let result = {
        success: projectResult.success,
        message: projectResult.message,
        projectSync: {
          success: projectResult.success,
          p6ProjectId: projectResult.p6ProjectId
        },
        taskSync: null
      };
      
      // Sync tasks if requested and project sync was successful
      if (syncTasks && projectResult.success) {
        const taskResult = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);
        
        result.taskSync = {
          success: taskResult.success,
          message: taskResult.message,
          synced: taskResult.results?.success || 0,
          failed: taskResult.results?.failed || 0
        };
      }
      
      // Update the sync operation status
      if (syncOperation?.id) {
        let detailsMessage = `Project sync ${result.projectSync.success ? 'succeeded' : 'failed'}`;
        
        if (syncTasks && result.taskSync) {
          detailsMessage += `. Tasks: ${result.taskSync.synced} synced, ${result.taskSync.failed} failed`;
        }
        
        await syncTrackingService.updateSyncOperation(syncOperation.id, {
          status: 'Completed',
          details: detailsMessage
        });
      }
      
      return res.status(result.success ? 200 : 500).json(result);
    }
    // Otherwise, sync all projects
    else {
      logger.info('External API request to sync all EBS projects to P6');
      logger.info(`Sync tasks option: ${syncTasks}`);
      
      // Get all projects from EBS
      const allProjects = await ebsToP6Service.getAllEBSProjects();
      
      // Filter to only active/approved projects
      const projectsToSync = allProjects.filter(project => {
        const status = project.STATUS_CODE || project.status;
        return status === 'APPROVED' || status === 'ACTIVE';
      });
      
      logger.info(`Found ${projectsToSync.length} eligible projects to sync`);
      
      // Create a sync operation record
      const syncOperation = await syncTrackingService.logSyncOperation({
        type: syncTasks ? 'External API: Bulk EBS to P6 Projects and Tasks' : 'External API: Bulk EBS to P6 Projects',
        source: 'All Projects',
        status: 'In Progress'
      });
      
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
      
      // Process each project
      for (const project of projectsToSync) {
        try {
          const projectId = project.PROJECT_ID || project.id;
          logger.info(`Processing project ${projectId}: ${project.NAME || project.name}`);
          
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
            if (syncTasks && result.p6ProjectId) {
              try {
                // Get tasks for this project
                const projectTasks = await ebsToP6Service.getEBSProjectTasks(projectId);
                
                // Only attempt to sync if there are tasks
                if (projectTasks && projectTasks.length > 0) {
                  logger.info(`Syncing ${projectTasks.length} tasks for project ${projectId}`);
                  
                  const taskResult = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);
                  
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
                  } else {
                    projectDetail.tasks = {
                      success: false,
                      error: taskResult.message
                    };
                    results.taskSync.failed++;
                  }
                } else {
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
      
      return res.status(200).json({
        success: true,
        message: `Completed syncing ${results.total} projects: ${results.succeeded} succeeded, ${results.failed} failed`,
        results
      });
    }
  } catch (error) {
    logger.error('Error in external integration sync endpoint:', error);
    
    return res.status(500).json({
      success: false,
      message: `Integration failed: ${error.message}`,
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
});

/**
 * @api {get} /api/v1/integration/status/sync/:operationId Get sync operation status
 * @apiName GetSyncStatus
 * @apiGroup Integration
 * @apiVersion 1.0.0
 * @apiDescription Get the status of a specific sync operation
 * 
 * @apiHeader {String} x-api-key Integration API Key
 * 
 * @apiParam {String} operationId ID of the sync operation to check
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {Object} operation Sync operation details
 * 
 * @apiExample {curl} Example usage:
 *     curl -H "x-api-key: your-api-key" 
 *          https://your-server/api/v1/integration/status/sync/123e4567-e89b-12d3-a456-426614174000
 */
router.get('/status/sync/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;
    
    // Get sync operation status
    const operation = await syncTrackingService.getSyncOperation(operationId);
    
    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Sync operation not found',
        error: {
          code: 'NOT_FOUND',
          message: `No sync operation found with ID: ${operationId}`
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      operation
    });
  } catch (error) {
    logger.error('Error getting sync operation status:', error);
    
    return res.status(500).json({
      success: false,
      message: `Failed to get sync status: ${error.message}`,
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
});

/**
 * @api {get} /api/v1/integration/status/sync Get recent sync operations
 * @apiName GetRecentSyncOperations
 * @apiGroup Integration
 * @apiVersion 1.0.0
 * @apiDescription Get a list of recent sync operations
 * 
 * @apiHeader {String} x-api-key Integration API Key
 * 
 * @apiParam {Number} [limit=10] Maximum number of operations to return
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {Array} operations List of sync operations
 * 
 * @apiExample {curl} Example usage:
 *     curl -H "x-api-key: your-api-key" 
 *          https://your-server/api/v1/integration/status/sync?limit=5
 */
router.get('/status/sync', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Get recent sync operations
    const operations = await syncTrackingService.getRecentSyncOperations(limit);
    
    return res.status(200).json({
      success: true,
      operations
    });
  } catch (error) {
    logger.error('Error getting recent sync operations:', error);
    
    return res.status(500).json({
      success: false,
      message: `Failed to get sync operations: ${error.message}`,
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
});

/**
 * @api {get} /api/v1/integration/health Check integration API health
 * @apiName CheckHealth
 * @apiGroup Integration
 * @apiVersion 1.0.0
 * @apiDescription Check the health of the integration API and connected services
 * 
 * @apiHeader {String} x-api-key Integration API Key
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {Object} status Health status of connected services
 * 
 * @apiExample {curl} Example usage:
 *     curl -H "x-api-key: your-api-key" 
 *          https://your-server/api/v1/integration/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check health of P6
    const p6Status = await ebsToP6Service.checkP6Health();
    
    // Check health of EBS
    const ebsStatus = await ebsToP6Service.checkEBSHealth();
    
    return res.status(200).json({
      success: true,
      status: {
        api: 'healthy',
        p6: p6Status ? 'connected' : 'disconnected',
        ebs: ebsStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error checking integration health:', error);
    
    return res.status(500).json({
      success: false,
      message: `Health check failed: ${error.message}`,
      status: {
        api: 'degraded',
        timestamp: new Date().toISOString()
      },
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
});

module.exports = router;