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
      // Project EBS1001 - Office Building Construction
      {
        TASK_ID: 'T1001',
        TASK_NUMBER: 'TASK-001',
        TASK_NAME: 'Project Initiation',
        PARENT_TASK_ID: null,
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-05-01',
        COMPLETION_DATE: '2025-05-31',
        PHYSICAL_PERCENT_COMPLETE: 100
      },
      {
        TASK_ID: 'T1002',
        TASK_NUMBER: 'TASK-002',
        TASK_NAME: 'Site Preparation',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-06-01',
        COMPLETION_DATE: '2025-07-15',
        PHYSICAL_PERCENT_COMPLETE: 85
      },
      {
        TASK_ID: 'T1003',
        TASK_NUMBER: 'TASK-003',
        TASK_NAME: 'Foundation Work',
        PARENT_TASK_ID: 'T1002',
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-07-16',
        COMPLETION_DATE: '2025-08-30',
        PHYSICAL_PERCENT_COMPLETE: 60
      },
      {
        TASK_ID: 'T1004',
        TASK_NUMBER: 'TASK-004',
        TASK_NAME: 'Structural Framework',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'IN_PROGRESS',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-09-01',
        COMPLETION_DATE: '2025-11-15',
        PHYSICAL_PERCENT_COMPLETE: 25
      },
      {
        TASK_ID: 'T1005',
        TASK_NUMBER: 'TASK-005',
        TASK_NAME: 'External Walls and Roof',
        PARENT_TASK_ID: 'T1004',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2025-11-16',
        COMPLETION_DATE: '2026-01-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T1006',
        TASK_NUMBER: 'TASK-006',
        TASK_NAME: 'Internal Systems',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2026-01-16',
        COMPLETION_DATE: '2026-03-31',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T1007',
        TASK_NUMBER: 'TASK-007',
        TASK_NAME: 'Electrical Systems',
        PARENT_TASK_ID: 'T1006',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2026-01-16',
        COMPLETION_DATE: '2026-02-28',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T1008',
        TASK_NUMBER: 'TASK-008',
        TASK_NAME: 'Plumbing Systems',
        PARENT_TASK_ID: 'T1006',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2026-02-01',
        COMPLETION_DATE: '2026-03-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T1009',
        TASK_NUMBER: 'TASK-009',
        TASK_NAME: 'HVAC Installation',
        PARENT_TASK_ID: 'T1006',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1001',
        START_DATE: '2026-02-15',
        COMPLETION_DATE: '2026-03-31',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      
      // Project EBS1002 - Data Center Renovation
      {
        TASK_ID: 'T2001',
        TASK_NUMBER: 'TASK-101',
        TASK_NAME: 'Assessment Phase',
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
        TASK_NAME: 'Design Phase',
        PARENT_TASK_ID: 'T2001',
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-07-16',
        COMPLETION_DATE: '2025-08-30',
        PHYSICAL_PERCENT_COMPLETE: 90
      },
      {
        TASK_ID: 'T2003',
        TASK_NUMBER: 'TASK-103',
        TASK_NAME: 'Procurement',
        PARENT_TASK_ID: 'T2001',
        STATUS_CODE: 'IN_PROGRESS',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-08-15',
        COMPLETION_DATE: '2025-09-30',
        PHYSICAL_PERCENT_COMPLETE: 65
      },
      {
        TASK_ID: 'T2004',
        TASK_NUMBER: 'TASK-104',
        TASK_NAME: 'Network Infrastructure',
        PARENT_TASK_ID: 'T2001',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-10-01',
        COMPLETION_DATE: '2025-11-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T2005',
        TASK_NUMBER: 'TASK-105',
        TASK_NAME: 'Server Installation',
        PARENT_TASK_ID: 'T2004',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-11-16',
        COMPLETION_DATE: '2025-12-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T2006',
        TASK_NUMBER: 'TASK-106',
        TASK_NAME: 'Testing and Validation',
        PARENT_TASK_ID: 'T2001',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1002',
        START_DATE: '2025-12-16',
        COMPLETION_DATE: '2025-12-31',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      
      // Project EBS1003 - Campus Expansion
      {
        TASK_ID: 'T3001',
        TASK_NUMBER: 'TASK-201',
        TASK_NAME: 'Feasibility Study',
        PARENT_TASK_ID: null,
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2025-07-01',
        COMPLETION_DATE: '2025-08-15',
        PHYSICAL_PERCENT_COMPLETE: 100
      },
      {
        TASK_ID: 'T3002',
        TASK_NUMBER: 'TASK-202',
        TASK_NAME: 'Land Acquisition',
        PARENT_TASK_ID: 'T3001',
        STATUS_CODE: 'APPROVED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2025-08-16',
        COMPLETION_DATE: '2025-10-31',
        PHYSICAL_PERCENT_COMPLETE: 75
      },
      {
        TASK_ID: 'T3003',
        TASK_NUMBER: 'TASK-203',
        TASK_NAME: 'Master Planning',
        PARENT_TASK_ID: 'T3001',
        STATUS_CODE: 'IN_PROGRESS',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2025-10-01',
        COMPLETION_DATE: '2025-12-31',
        PHYSICAL_PERCENT_COMPLETE: 40
      },
      {
        TASK_ID: 'T3004',
        TASK_NUMBER: 'TASK-204',
        TASK_NAME: 'Building Design',
        PARENT_TASK_ID: 'T3003',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2026-01-01',
        COMPLETION_DATE: '2026-03-31',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T3005',
        TASK_NUMBER: 'TASK-205',
        TASK_NAME: 'Permitting',
        PARENT_TASK_ID: 'T3001',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2026-01-15',
        COMPLETION_DATE: '2026-03-15',
        PHYSICAL_PERCENT_COMPLETE: 0
      },
      {
        TASK_ID: 'T3006',
        TASK_NUMBER: 'TASK-206',
        TASK_NAME: 'Phase 1 Construction',
        PARENT_TASK_ID: 'T3001',
        STATUS_CODE: 'PLANNED',
        PROJECT_ID: 'EBS1003',
        START_DATE: '2026-04-01',
        COMPLETION_DATE: '2026-05-30',
        PHYSICAL_PERCENT_COMPLETE: 0
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