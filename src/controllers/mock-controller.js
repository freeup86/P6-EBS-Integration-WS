// src/controllers/mock-controller.js
const express = require('express');
const router = express.Router();
const mockApiService = require('../services/mock/mock-api-service');
const logger = require('../utils/logger');

// Mock EBS API routes
router.post('/ebs/auth', (req, res) => {
  logger.info('Mock EBS Auth API called');
  res.json(mockApiService.authenticate());
});

router.get('/ebs/projects', (req, res) => {
  logger.info('Mock EBS Projects API called');
  res.json(mockApiService.getEBSProjects());
});

router.get('/ebs/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Project API called for project: ${projectId}`);
  const project = mockApiService.getEBSProject(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

router.get('/ebs/projects/:projectId/tasks', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Tasks API called for project: ${projectId}`);
  res.json(mockApiService.getEBSTasks(projectId));
});

router.put('/ebs/projects/:projectId/tasks/:taskId', (req, res) => {
  const projectId = req.params.projectId;
  const taskId = req.params.taskId;
  logger.info(`Mock EBS Update Task API called for project: ${projectId}, task: ${taskId}`);
  res.json({ success: true, message: 'Task updated successfully' });
});

// Mock P6 API routes
router.post('/p6/auth/login', (req, res) => {
  logger.info('Mock P6 Auth API called');
  res.json(mockApiService.authenticate());
});

router.get('/p6/projects', (req, res) => {
  logger.info('Mock P6 Projects API called');
  res.json(mockApiService.getP6Projects());
});

router.get('/p6/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock P6 Project API called for project: ${projectId}`);
  const project = mockApiService.getP6Project(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

router.get('/p6/projects/:projectId/wbs', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock P6 WBS API called for project: ${projectId}`);
  res.json(mockApiService.getP6WBSElements(projectId));
});

router.get('/p6/wbs/:wbsId/activities', (req, res) => {
  const wbsId = req.params.wbsId;
  logger.info(`Mock P6 Activities API called for WBS: ${wbsId}`);
  res.json(mockApiService.getP6Activities(wbsId));
});

router.get('/p6/resourceassignments', (req, res) => {
  logger.info('Mock P6 Resource Assignments API called');
  res.json(mockApiService.getP6ResourceAssignments());
});

// Get EBS project by ID
router.get('/ebs/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Project API called for project: ${projectId}`);
  
  const projects = mockApiService.getEBSProjects();
  const project = projects.find(p => p.PROJECT_ID === projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Get EBS tasks for project
router.get('/ebs/projects/:projectId/tasks', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Tasks API called for project: ${projectId}`);
  
  // Return mock tasks (would come from mockApiService in a full implementation)
  res.json([
    {
      TASK_ID: 'T1001',
      TASK_NUMBER: 'TASK-001',
      TASK_NAME: 'Planning Phase',
      PARENT_TASK_ID: null,
      STATUS_CODE: 'APPROVED',
      PROJECT_ID: projectId
    },
    {
      TASK_ID: 'T1002',
      TASK_NUMBER: 'TASK-002',
      TASK_NAME: 'Design Phase',
      PARENT_TASK_ID: 'T1001',
      STATUS_CODE: 'PENDING',
      PROJECT_ID: projectId
    }
  ]);
});

// Get P6 project by ID
router.get('/p6/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock P6 Project API called for project: ${projectId}`);
  
  const projects = mockApiService.getP6Projects();
  const project = projects.find(p => p.Id === projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Get P6 WBS elements for project
router.get('/p6/projects/:projectId/wbs', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock P6 WBS API called for project: ${projectId}`);
  
  // Return mock WBS elements
  res.json([
    {
      ObjectId: 'WBS001-OBJ',
      Id: 'T1001',
      Name: 'Planning Phase',
      Status: 'Active',
      ParentObjectId: null,
      ProjectId: projectId
    },
    {
      ObjectId: 'WBS002-OBJ',
      Id: 'T1002',
      Name: 'Design Phase',
      Status: 'Planned',
      ParentObjectId: 'WBS001-OBJ',
      ProjectId: projectId
    }
  ]);
});

// Get P6 activities for WBS
router.get('/p6/wbs/:wbsId/activities', (req, res) => {
  const wbsId = req.params.wbsId;
  logger.info(`Mock P6 Activities API called for WBS: ${wbsId}`);
  
  // Return mock activities
  res.json([
    {
      ObjectId: 'ACT001-OBJ',
      Id: 'A001',
      Name: 'Requirements Gathering',
      Status: 'Completed',
      StartDate: '2025-05-01',
      FinishDate: '2025-05-15',
      PercentComplete: 100,
      WBSId: wbsId
    },
    {
      ObjectId: 'ACT002-OBJ',
      Id: 'A002',
      Name: 'Site Analysis',
      Status: 'In Progress',
      StartDate: '2025-05-16',
      FinishDate: '2025-05-30',
      PercentComplete: 75,
      WBSId: wbsId
    }
  ]);
});

// Get P6 resource assignments
router.get('/p6/resourceassignments', (req, res) => {
  logger.info('Mock P6 Resource Assignments API called');
  
  // Return mock resource assignments
  res.json([
    {
      ResourceId: 'R001',
      ActivityId: 'A001',
      ActualCost: 10000,
      ActualDuration: 10,
      ActualUnits: 1,
      ActualStartDate: '2025-05-01',
      ActualFinishDate: '2025-05-15'
    },
    {
      ResourceId: 'R002',
      ActivityId: 'A002',
      ActualCost: 15000,
      ActualDuration: 15,
      ActualUnits: 0.5,
      ActualStartDate: '2025-05-16',
      ActualFinishDate: '2025-05-30'
    }
  ]);
});

router.post('/p6/projects', (req, res) => {
  logger.info('Mock P6 Create Project API called');
  res.json({ success: true, ObjectId: 'P' + Date.now() });
});

router.put('/p6/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock P6 Update Project API called for project: ${projectId}`);
  res.json({ success: true, message: 'Project updated successfully' });
});

router.post('/p6/wbs', (req, res) => {
  logger.info('Mock P6 Create WBS API called');
  res.json({ success: true, ObjectId: 'WBS' + Date.now() });
});

router.put('/p6/wbs/:wbsId', (req, res) => {
  const wbsId = req.params.wbsId;
  logger.info(`Mock P6 Update WBS API called for WBS: ${wbsId}`);
  res.json({ success: true, message: 'WBS updated successfully' });
});

module.exports = router;