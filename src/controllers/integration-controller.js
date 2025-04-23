// src/controllers/integration-controller.js
const express = require('express');
const router = express.Router();
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const logger = require('../utils/logger');

/**
 * API endpoints for EBS to P6 integration
 */

// Sync Project from EBS to P6
router.post('/ebs-to-p6/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS project to P6: ${projectId}`);
    
    const result = await ebsToP6Service.syncProjectFromEBSToP6(projectId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in EBS to P6 project sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync Tasks from EBS to P6 WBS
router.post('/ebs-to-p6/tasks/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync EBS tasks to P6 WBS: ${projectId}`);
    
    const result = await ebsToP6Service.syncTasksFromEBSToP6WBS(projectId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in EBS to P6 tasks sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * API endpoints for P6 to EBS integration
 */

// Sync WBS from P6 to EBS Tasks
router.post('/p6-to-ebs/wbs/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    logger.info(`Request to sync P6 WBS to EBS tasks: ${projectId}`);
    
    const result = await p6ToEBSService.syncWBSFromP6ToEBSTasks(projectId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in P6 to EBS WBS sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync Resource Assignments from P6 to EBS
router.post('/p6-to-ebs/resources', async (req, res) => {
  try {
    logger.info('Request to sync P6 resource assignments to EBS');
    
    const result = await p6ToEBSService.syncResourceAssignmentsFromP6ToEBS();
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Error in P6 to EBS resource assignments sync endpoint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * UI routes for triggering syncs
 */

// Display EBS Projects for sync
router.get('/ebs/projects', async (req, res) => {
  // In production, this would fetch real data from the EBS API
  // For development, we'll use mock data
  const mockProjects = [
    {
      projectNumber: 'P1001',
      projectName: 'Office Building Construction',
      projectStatus: 'APPROVED',
      plannedStart: '2025-05-01',
      plannedFinish: '2026-01-15'
    },
    {
      projectNumber: 'P1002',
      projectName: 'Data Center Renovation',
      projectStatus: 'PENDING',
      plannedStart: '2025-06-15',
      plannedFinish: '2025-12-31'
    },
    {
      projectNumber: 'P1003',
      projectName: 'Campus Expansion',
      projectStatus: 'APPROVED',
      plannedStart: '2025-07-01',
      plannedFinish: '2026-05-30'
    }
  ];
  
  res.render('ebs-projects', { 
    title: 'EBS Projects', 
    projects: mockProjects 
  });
});

// Display P6 Projects for sync 
router.get('/p6/projects', async (req, res) => {
  // In production, this would fetch real data from the P6 API
  // For development, we'll use mock data
  const mockProjects = [
    {
      id: 'P1001',
      name: 'Office Building Construction',
      status: 'Active',
      startDate: '2025-05-01',
      finishDate: '2026-01-15'
    },
    {
      id: 'P1002',
      name: 'Data Center Renovation',
      status: 'Planned',
      startDate: '2025-06-15',
      finishDate: '2025-12-31'
    },
    {
      id: 'P1003',
      name: 'Campus Expansion',
      status: 'Active',
      startDate: '2025-07-01',
      finishDate: '2026-05-30'
    }
  ];
  
  res.render('p6-projects', { 
    title: 'P6 Projects', 
    projects: mockProjects 
  });
});

// Display sync status dashboard
router.get('/status', async (req, res) => {
  // In production, this would fetch real data from a database
  // For development, we'll use mock data
  const mockSyncOperations = [
    {
      id: 'sync-001',
      type: 'Project EBS to P6',
      source: 'P1001 - Office Building Construction',
      timestamp: new Date().toISOString(),
      status: 'Completed',
      details: 'Successfully synced project from EBS to P6'
    },
    {
      id: 'sync-002',
      type: 'Tasks EBS to P6',
      source: 'P1001 - Office Building Construction',
      timestamp: new Date().toISOString(),
      status: 'Completed',
      details: 'Successfully synced 12 tasks from EBS to P6'
    },
    {
      id: 'sync-003',
      type: 'WBS P6 to EBS',
      source: 'P1002 - Data Center Renovation',
      timestamp: new Date().toISOString(),
      status: 'Failed',
      details: 'Error: Could not find corresponding EBS project'
    }
  ];
  
  res.render('sync-status', { 
    title: 'Integration Status', 
    syncOperations: mockSyncOperations 
  });
});

// API endpoint for getting EBS projects (for AJAX calls)
router.get('/api/ebs/projects', async (req, res) => {
  // In production, this would fetch real data from the EBS API
  // For development, we'll use mock data
  const mockProjects = [
    {
      projectNumber: 'P1001',
      projectName: 'Office Building Construction',
      projectStatus: 'APPROVED',
      plannedStart: '2025-05-01',
      plannedFinish: '2026-01-15'
    },
    {
      projectNumber: 'P1002',
      projectName: 'Data Center Renovation',
      projectStatus: 'PENDING',
      plannedStart: '2025-06-15',
      plannedFinish: '2025-12-31'
    },
    {
      projectNumber: 'P1003',
      projectName: 'Campus Expansion',
      projectStatus: 'APPROVED',
      plannedStart: '2025-07-01',
      plannedFinish: '2026-05-30'
    }
  ];
  
  res.json(mockProjects);
});

// API endpoint for getting P6 projects (for AJAX calls)
router.get('/api/p6/projects', async (req, res) => {
  // In production, this would fetch real data from the P6 API
  // For development, we'll use mock data
  const mockProjects = [
    {
      id: 'P1001',
      name: 'Office Building Construction',
      status: 'Active',
      startDate: '2025-05-01',
      finishDate: '2026-01-15'
    },
    {
      id: 'P1002',
      name: 'Data Center Renovation',
      status: 'Planned',
      startDate: '2025-06-15',
      finishDate: '2025-12-31'
    },
    {
      id: 'P1003',
      name: 'Campus Expansion',
      status: 'Active',
      startDate: '2025-07-01',
      finishDate: '2026-05-30'
    }
  ];
  
  res.json(mockProjects);
});

module.exports = router;