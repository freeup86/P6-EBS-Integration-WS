// src/services/mock/mock-api-service.js
const logger = require('../../utils/logger');

/**
 * Mock service to simulate API responses for development and testing
 */
class MockApiService {
  /**
   * Get EBS projects
   * @returns {Array} - Array of EBS projects
   */
  getEBSProjects() {
    logger.info('Mock: Getting EBS projects');
    return [
      {
        PROJECT_ID: 'P1001',
        NAME: 'Office Building Construction',
        START_DATE: '2025-05-01',
        COMPLETION_DATE: '2026-01-15',
        STATUS_CODE: 'APPROVED',
        PROJECT_MANAGER_ID: 'PM1001',
        OPERATING_UNIT: 'Capital Projects',
        projectNumber: 'P1001',
        projectName: 'Office Building Construction',
        projectStatus: 'APPROVED',
        plannedStart: '2025-05-01',
        plannedFinish: '2026-01-15'
      },
      {
        PROJECT_ID: 'P1002',
        NAME: 'Data Center Renovation',
        START_DATE: '2025-06-15',
        COMPLETION_DATE: '2025-12-31',
        STATUS_CODE: 'PENDING',
        PROJECT_MANAGER_ID: 'PM1002',
        OPERATING_UNIT: 'Capital Projects',
        projectNumber: 'P1002',
        projectName: 'Data Center Renovation',
        projectStatus: 'PENDING',
        plannedStart: '2025-06-15',
        plannedFinish: '2025-12-31'
      },
      {
        PROJECT_ID: 'P1003',
        NAME: 'Campus Expansion',
        START_DATE: '2025-07-01',
        COMPLETION_DATE: '2026-05-30',
        STATUS_CODE: 'APPROVED',
        PROJECT_MANAGER_ID: 'PM1003',
        OPERATING_UNIT: 'Capital Projects',
        projectNumber: 'P1003',
        projectName: 'Campus Expansion',
        projectStatus: 'APPROVED',
        plannedStart: '2025-07-01',
        plannedFinish: '2026-05-30'
      }
    ];
  }

  /**
   * Get EBS project by ID
   * @param {string} projectId - Project ID
   * @returns {Object} - EBS project
   */
  getEBSProject(projectId) {
    logger.info(`Mock: Getting EBS project: ${projectId}`);
    const projects = this.getEBSProjects();
    return projects.find(project => project.PROJECT_ID === projectId);
  }

  /**
   * Get EBS tasks for a project
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of EBS tasks
   */
  getEBSTasks(projectId) {
    logger.info(`Mock: Getting EBS tasks for project: ${projectId}`);
    return [
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
      },
      {
        TASK_ID: 'T1003',
        TASK_NUMBER: 'TASK-003',
        TASK_NAME: 'Construction Phase',
        PARENT_TASK_ID: 'T1001',
        STATUS_CODE: 'PENDING',
        PROJECT_ID: projectId
      },
      {
        TASK_ID: 'T1004',
        TASK_NUMBER: 'TASK-004',
        TASK_NAME: 'Interior Design',
        PARENT_TASK_ID: 'T1003',
        STATUS_CODE: 'PENDING',
        PROJECT_ID: projectId
      }
    ];
  }

  /**
   * Get P6 projects
   * @returns {Array} - Array of P6 projects
   */
  getP6Projects() {
    logger.info('Mock: Getting P6 projects');
    return [
      {
        ObjectId: 'P1001-OBJ',
        Id: 'P1001',
        Name: 'Office Building Construction',
        Status: 'Active',
        PlannedStartDate: '2025-05-01',
        PlannedFinishDate: '2026-01-15',
        id: 'P1001',
        name: 'Office Building Construction',
        status: 'Active',
        startDate: '2025-05-01',
        finishDate: '2026-01-15'
      },
      {
        ObjectId: 'P1002-OBJ',
        Id: 'P1002',
        Name: 'Data Center Renovation',
        Status: 'Planned',
        PlannedStartDate: '2025-06-15',
        PlannedFinishDate: '2025-12-31',
        id: 'P1002',
        name: 'Data Center Renovation',
        status: 'Planned',
        startDate: '2025-06-15',
        finishDate: '2025-12-31'
      },
      {
        ObjectId: 'P1003-OBJ',
        Id: 'P1003',
        Name: 'Campus Expansion',
        Status: 'Active',
        PlannedStartDate: '2025-07-01',
        PlannedFinishDate: '2026-05-30',
        id: 'P1003',
        name: 'Campus Expansion',
        status: 'Active',
        startDate: '2025-07-01',
        finishDate: '2026-05-30'
      }
    ];
  }

  /**
   * Get P6 project by ID
   * @param {string} projectId - Project ID
   * @returns {Object} - P6 project
   */
  getP6Project(projectId) {
    logger.info(`Mock: Getting P6 project: ${projectId}`);
    const projects = this.getP6Projects();
    return projects.find(project => project.Id === projectId);
  }

  /**
   * Get P6 WBS elements for a project
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of P6 WBS elements
   */
  getP6WBSElements(projectId) {
    logger.info(`Mock: Getting P6 WBS elements for project: ${projectId}`);
    return [
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
      },
      {
        ObjectId: 'WBS003-OBJ',
        Id: 'T1003',
        Name: 'Construction Phase',
        Status: 'Planned',
        ParentObjectId: 'WBS001-OBJ',
        ProjectId: projectId
      },
      {
        ObjectId: 'WBS004-OBJ',
        Id: 'T1004',
        Name: 'Interior Design',
        Status: 'Planned',
        ParentObjectId: 'WBS003-OBJ',
        ProjectId: projectId
      }
    ];
  }

  /**
   * Get P6 activities for a WBS element
   * @param {string} wbsId - WBS ID
   * @returns {Array} - Array of P6 activities
   */
  getP6Activities(wbsId) {
    logger.info(`Mock: Getting P6 activities for WBS: ${wbsId}`);
    return [
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
      },
      {
        ObjectId: 'ACT003-OBJ',
        Id: 'A003',
        Name: 'Initial Design',
        Status: 'Not Started',
        StartDate: '2025-06-01',
        FinishDate: '2025-06-15',
        PercentComplete: 0,
        WBSId: wbsId
      }
    ];
  }

  /**
   * Get P6 resource assignments
   * @returns {Array} - Array of P6 resource assignments
   */
  getP6ResourceAssignments() {
    logger.info('Mock: Getting P6 resource assignments');
    return [
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
      },
      {
        ResourceId: 'R003',
        ActivityId: 'A003',
        ActualCost: 0,
        ActualDuration: 0,
        ActualUnits: 0,
        ActualStartDate: null,
        ActualFinishDate: null
      }
    ];
  }

  /**
   * Simulate successful authentication
   * @returns {Object} - Mock authentication response
   */
  authenticate() {
    logger.info('Mock: Authenticating');
    return {
      token: 'mock-auth-token-' + Date.now(),
      expires: new Date(Date.now() + 3600000).toISOString()
    };
  }
}

module.exports = new MockApiService();