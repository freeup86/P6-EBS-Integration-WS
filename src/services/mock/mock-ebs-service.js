// src/services/mock/mock-ebs-service.js
const logger = require('../../utils/logger');

/**
 * Mock service specifically for EBS integration
 */
class MockEBSService {
  constructor() {
    // Initialize demo data
    this._projects = this._createProjects();
    this._tasks = this._createTasks();
    this._resourceAssignments = this._createResourceAssignments();
  }

  /**
   * Get authentication token (mock)
   * @returns {Object} Mock authentication response
   */
  authenticate() {
    logger.info('Mock EBS: Authenticating');
    return {
      token: 'mock-ebs-token-' + Date.now(),
      expires: new Date(Date.now() + 3600000).toISOString()
    };
  }

  /**
   * Get all projects
   * @returns {Array} List of EBS projects
   */
  getProjects() {
    logger.info('Mock EBS: Getting all projects');
    return this._projects;
  }

  /**
   * Get a specific project by ID
   * @param {string} projectId - The project ID to find
   * @returns {Object|null} Project object or null if not found
   */
  getProject(projectId) {
    logger.info(`Mock EBS: Getting project ${projectId}`);
    return this._projects.find(p => p.PROJECT_ID === projectId) || null;
  }

  /**
   * Get tasks for a specific project
   * @param {string} projectId - The project ID
   * @returns {Array} List of tasks for the project
   */
  getTasks(projectId) {
    logger.info(`Mock EBS: Getting tasks for project ${projectId}`);
    return this._tasks.filter(t => t.PROJECT_ID === projectId);
  }

  /**
   * Update a task
   * @param {string} projectId - The project ID
   * @param {string} taskId - The task ID to update
   * @param {Object} updateData - The data to update
   * @returns {Object} Updated task
   */
  updateTask(projectId, taskId, updateData) {
    logger.info(`Mock EBS: Updating task ${taskId} in project ${projectId}`);
    
    const taskIndex = this._tasks.findIndex(t => 
      t.PROJECT_ID === projectId && t.TASK_ID === taskId
    );
    
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in project ${projectId}`);
    }
    
    // Update the task with the new data
    this._tasks[taskIndex] = {
      ...this._tasks[taskIndex],
      ...updateData
    };
    
    return this._tasks[taskIndex];
  }

  /**
   * Get resource assignments
   * @returns {Array} List of resource assignments
   */
  getResourceAssignments() {
    logger.info('Mock EBS: Getting resource assignments');
    return this._resourceAssignments;
  }

  /**
   * Update a resource assignment
   * @param {string} resourceId - Resource ID
   * @param {string} activityId - Activity ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated resource assignment
   */
  updateResourceAssignment(resourceId, activityId, updateData) {
    logger.info(`Mock EBS: Updating resource assignment for resource ${resourceId} on activity ${activityId}`);
    
    const assignmentIndex = this._resourceAssignments.findIndex(
      r => r.resourceId === resourceId && r.activityId === activityId
    );
    
    if (assignmentIndex === -1) {
      throw new Error(`Resource assignment not found for resource ${resourceId} on activity ${activityId}`);
    }
    
    // Update the assignment
    this._resourceAssignments[assignmentIndex] = {
      ...this._resourceAssignments[assignmentIndex],
      ...updateData
    };
    
    return this._resourceAssignments[assignmentIndex];
  }

  /**
   * Create a new resource assignment
   * @param {Object} assignmentData - The resource assignment data
   * @returns {Object} Created resource assignment
   */
  createResourceAssignment(assignmentData) {
    logger.info('Mock EBS: Creating new resource assignment');
    
    this._resourceAssignments.push(assignmentData);
    
    return assignmentData;
  }

  // Private methods to initialize demo data
  _createProjects() {
    return [
      {
        PROJECT_ID: 'EBS1001',
        NAME: 'Office Building Construction',
        START_DATE: '2025-05-01',
        COMPLETION_DATE: '2026-01-15',
        STATUS_CODE: 'APPROVED',
        PROJECT_MANAGER_ID: 'PM1001',
        OPERATING_UNIT: 'Capital Projects'
      },
      {
        PROJECT_ID: 'EBS1002',
        NAME: 'Data Center Renovation',
        START_DATE: '2025-06-15',
        COMPLETION_DATE: '2025-12-31',
        STATUS_CODE: 'PENDING',
        PROJECT_MANAGER_ID: 'PM1002',
        OPERATING_UNIT: 'Capital Projects'
      },
      {
        PROJECT_ID: 'EBS1003',
        NAME: 'Campus Expansion',
        START_DATE: '2025-07-01',
        COMPLETION_DATE: '2026-05-30',
        STATUS_CODE: 'APPROVED',
        PROJECT_MANAGER_ID: 'PM1003',
        OPERATING_UNIT: 'Capital Projects'
      }
    ];
  }

  _createTasks() {
    return [
      // Project EBS1001 tasks
      {
        TASK_ID: 'T1001',
        TASK_NUMBER: 'TASK-001',
        TASK_NAME: 'Planning Phase',
        PARENT_TASK_ID: null,
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-05-01',
        COMPLETION_DATE: '2025-06-15',
        PHYSICAL_PERCENT_COMPLETE: 100
      },
      {
        TASK_ID: 'T1002',
        TASK_NUMBER: 'TASK-002',
        TASK_NAME: 'Design Phase',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-06-16',
        COMPLETION_DATE: '2025-08-30',
        PHYSICAL_PERCENT_COMPLETE: 75
      },
      {
        TASK_ID: 'T1003',
        TASK_NUMBER: 'TASK-003',
        TASK_NAME: 'Construction Phase',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'PENDING',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-09-01',
        COMPLETION_DATE: '2025-12-31',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T1004',
        TASK_NUMBER: 'TASK-004',
        TASK_NAME: 'Interior Design',
        PARENT_TASK_ID: 'T1003',
        STATUS_CODE: 'PENDING',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-11-01',
        COMPLETION_DATE: '2026-01-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      
      // Project EBS1002 tasks
      {
        TASK_ID: 'T2001',
        TASK_NUMBER: 'TASK-101',
        TASK_NAME: 'Infrastructure Assessment',
        PARENT_TASK_ID: null,
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-06-15',
        COMPLETION_DATE: '2025-07-15',
        PHYSICAL_PERCENT_COMPLETE: 100
      },
      {
        TASK_ID: 'T2002',
        TASK_NUMBER: 'TASK-102',
        TASK_NAME: 'Network Redesign',
        PARENT_TASK_ID: 'T2001',
        STATUS_CODE: 'PENDING',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-07-16',
        COMPLETION_DATE: '2025-09-30',
        PHYSICAL_PERCENT_COMPLETE: 25
      },
      
      // Project EBS1003 tasks
      {
        TASK_ID: 'T3001',
        TASK_NUMBER: 'TASK-201',
        TASK_NAME: 'Site Preparation',
        PARENT_TASK_ID: null,
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2025-07-01',
        COMPLETION_DATE: '2025-08-31',
        PHYSICAL_PERCENT_COMPLETE: 50
      }
    ];
  }

  _createResourceAssignments() {
    return [
      {
        resourceId: 'R001',
        activityId: 'A001',
        projectId: 'EBS1001',
        actualCost: 15000,
        actualDuration: 15,
        actualUnits: 1.0,
        actualStartDate: '2025-05-01',
        actualFinishDate: '2025-05-15'
      },
      {
        resourceId: 'R002',
        activityId: 'A002',
        projectId: 'EBS1001',
        actualCost: 25000,
        actualDuration: 30,
        actualUnits: 0.5,
        actualStartDate: '2025-06-01',
        actualFinishDate: '2025-07-01'
      },
      {
        resourceId: 'R003',
        activityId: 'A003',
        projectId: 'EBS1002',
        actualCost: 18000,
        actualDuration: 20,
        actualUnits: 0.75,
        actualStartDate: '2025-06-15',
        actualFinishDate: '2025-07-05'
      }
    ];
  }
}

module.exports = new MockEBSService();