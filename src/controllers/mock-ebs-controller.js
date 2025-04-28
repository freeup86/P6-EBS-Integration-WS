// src/controllers/mock-ebs-controller.js
const express = require('express');
const router = express.Router();
const mockEBSService = require('../services/mock/mock-ebs-service');
const logger = require('../utils/logger');

// Authentication endpoint
router.post('/auth', (req, res) => {
  logger.info('Mock EBS Auth endpoint called');
  res.json(mockEBSService.authenticate());
});

// Get all projects
router.get('/projects', (req, res) => {
  logger.info('Mock EBS Projects endpoint called');
  res.json(mockEBSService.getProjects());
});

// Get project by ID
router.get('/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Get Project endpoint called for project: ${projectId}`);
  
  const project = mockEBSService.getProject(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Get tasks for a project
router.get('/projects/:projectId/tasks', (req, res) => {
  const projectId = req.params.projectId;
  logger.info(`Mock EBS Tasks endpoint called for project: ${projectId}`);
  res.json(mockEBSService.getTasks(projectId));
});

// Update a task
router.put('/projects/:projectId/tasks/:taskId', (req, res) => {
  const projectId = req.params.projectId;
  const taskId = req.params.taskId;
  logger.info(`Mock EBS Update Task endpoint called for project: ${projectId}, task: ${taskId}`);
  
  try {
    const updatedTask = mockEBSService.updateTask(projectId, taskId, req.body);
    res.json(updatedTask);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get resource assignments
router.get('/resourceassignments', (req, res) => {
  logger.info('Mock EBS Resource Assignments endpoint called');
  res.json(mockEBSService.getResourceAssignments());
});

// Update resource assignment
router.put('/resourceassignments/:resourceId/:activityId', (req, res) => {
  const resourceId = req.params.resourceId;
  const activityId = req.params.activityId;
  logger.info(`Mock EBS Update Resource Assignment endpoint called for resource: ${resourceId}, activity: ${activityId}`);
  
  try {
    const updatedAssignment = mockEBSService.updateResourceAssignment(resourceId, activityId, req.body);
    res.json(updatedAssignment);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Create resource assignment
router.post('/resourceassignments', (req, res) => {
  logger.info('Mock EBS Create Resource Assignment endpoint called');
  const newAssignment = mockEBSService.createResourceAssignment(req.body);
  res.status(201).json(newAssignment);
});

module.exports = router;