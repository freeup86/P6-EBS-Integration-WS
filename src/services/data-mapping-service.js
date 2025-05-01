// src/services/data-mapping-service.js
const logger = require('../utils/logger');

/**
 * Data mapping service to handle transformations between P6 and EBS
 */
class DataMappingService {
  
  /**
   * Map P6 Project data to EBS Project format
   * @param {Object} p6Project - Project data from P6
   * @returns {Object} - Project data in EBS format
   */
  mapP6ProjectToEBS(p6Project) {
    try {
      // Based on the mapping document
      return {
        PROJECT_ID: p6Project.PROJ_ID, // Use sequence PA_PROJECT_ID_S.NEXTVAL in actual DB
        NAME: p6Project.WBS_NAME,
        START_DATE: p6Project.ANTICIPATED_START_DATE,
        COMPLETION_DATE: p6Project.ANTICIPATED_FINISH_DATE,
        STATUS_CODE: this.mapP6StatusToEBSStatus(p6Project.STATUS_CODE),
        PROJECT_MANAGER_ID: p6Project.RSRC_ID,
        OPERATING_UNIT: this.mapP6OBSToEBSOperatingUnit(p6Project.OBS_ID)
      };
    } catch (error) {
      logger.error('Error mapping P6 Project to EBS:', error);
      throw error;
    }
  }
  
  /**
   * Map EBS Project data to P6 Project format
   * @param {Object} ebsProject - Project data from EBS
   * @returns {Object} - Project data in P6 format
   */
  mapEBSProjectToP6(ebsProject) {
    try {
      // Based on the mapping document
      return {
        PROJ_ID: ebsProject.PROJECT_ID,
        WBS_NAME: ebsProject.NAME,
        ANTICIPATED_START_DATE: ebsProject.START_DATE,
        ANTICIPATED_FINISH_DATE: ebsProject.COMPLETION_DATE,
        STATUS_CODE: this.mapEBSStatusToP6Status(ebsProject.STATUS_CODE),
        RSRC_ID: ebsProject.PROJECT_MANAGER_ID,
        OBS_ID: this.mapEBSOperatingUnitToP6OBS(ebsProject.OPERATING_UNIT)
      };
    } catch (error) {
      logger.error('Error mapping EBS Project to P6:', error);
      throw error;
    }
  }
  
  /**
   * Map EBS Task data to P6 WBS format
   * @param {Object} ebsTask - Task data from EBS
   * @returns {Object} - WBS data in P6 format
   */
  mapEBSTaskToP6WBS(ebsTask) {
    try {
      // Check the mapping for STATUS_CODE
      let status = 'Active'; // Default status
      if (ebsTask.STATUS_CODE === 'APPROVED') {
        status = 'Active';
      } else if (ebsTask.STATUS_CODE === 'IN_PROGRESS') {
        status = 'Active';
      } else if (ebsTask.STATUS_CODE === 'PLANNED') {
        status = 'Planned';
      }
      
      // Map other fields...
      return {
        WBS_ID: ebsTask.TASK_ID,
        WBS_SHORT_NAME: ebsTask.TASK_NUMBER,
        WBS_NAME: ebsTask.TASK_NAME,
        PARENT_WBS_ID: ebsTask.PARENT_TASK_ID,
        STATUS_CODE: status // Use mapped status
      };
    } catch (error) {
      logger.error('Error mapping EBS Task to P6 WBS:', error);
      throw error;
    }
  }
  
  /**
   * Map P6 WBS data to EBS Task format
   * @param {Object} p6WBS - WBS data from P6
   * @param {Number} percentComplete - Calculated percent complete
   * @returns {Object} - Task data in EBS format
   */
  mapP6WBSToEBSTask(p6WBS, percentComplete) {
    try {
      // Based on the mapping document
      return {
        TASK_ID: p6WBS.WBS_ID, // Use sequence PA_TASK_ID_S.NEXTVAL in actual DB
        START_DATE: p6WBS.ANTICIPATED_START_DATE,
        COMPLETION_DATE: p6WBS.ANTICIPATED_END_DATE,
        PHYSICAL_PERCENT_COMPLETE: percentComplete || p6WBS.PERCENT_COMPLETE
      };
    } catch (error) {
      logger.error('Error mapping P6 WBS to EBS Task:', error);
      throw error;
    }
  }
  
  /**
   * Map P6 Resource Assignment to EBS Resource Assignment
   * @param {Object} p6ResourceAssignment - Resource assignment data from P6
   * @returns {Object} - Resource assignment data in EBS format
   */
  mapP6ResourceAssignmentToEBS(p6ResourceAssignment) {
    try {
      // Based on the mapping document
      return {
        // Assuming resource_assignment_id is auto-generated
        RESOURCE_ID: p6ResourceAssignment.RSRC_ID,
        RESOURCE_CODE: p6ResourceAssignment.RSRC_CATG_TYPE,
        RESOURCE_CODE_VALUE: p6ResourceAssignment.RSRC_CATG_SHORT_NAME,
        TASK_ID: p6ResourceAssignment.TASK_ID,
        PROJECT_ID: p6ResourceAssignment.PROJ_ID,
        PLANNED_COST: p6ResourceAssignment.TARGET_COST,
        PLANNED_DURATION: this.calculateDurationInDays(
          p6ResourceAssignment.TARGET_START_DATE, 
          p6ResourceAssignment.TARGET_END_DATE
        ),
        SCHEDULED_START: p6ResourceAssignment.TARGET_START_DATE,
        SCHEDULED_FINISH: p6ResourceAssignment.TARGET_END_DATE
      };
    } catch (error) {
      logger.error('Error mapping P6 Resource Assignment to EBS:', error);
      throw error;
    }
  }
  
  /**
   * Map P6 status codes to EBS status codes
   * @param {String} p6Status - Status code from P6
   * @returns {String} - Corresponding status code in EBS
   */
  mapP6StatusToEBSStatus(p6Status) {
    const statusMap = {
      'Active': 'APPROVED',
      'Planned': 'PENDING',
      'Inactive': 'INACTIVE',
      'Completed': 'COMPLETE'
      // Add more mappings as needed
    };
    
    return statusMap[p6Status] || 'PENDING';
  }
  
  /**
   * Map EBS status codes to P6 status codes
   * @param {String} ebsStatus - Status code from EBS
   * @returns {String} - Corresponding status code in P6
   */
  mapEBSStatusToP6Status(ebsStatus) {
    const statusMap = {
      'APPROVED': 'Active',
      'PENDING': 'Planned',
      'INACTIVE': 'Inactive',
      'COMPLETE': 'Completed'
      // Add more mappings as needed
    };
    
    return statusMap[ebsStatus] || 'Planned';
  }
  
  /**
   * Map P6 OBS ID to EBS Operating Unit
   * @param {String} obsId - OBS ID from P6
   * @returns {String} - Corresponding Operating Unit in EBS
   */
  mapP6OBSToEBSOperatingUnit(obsId) {
    // This would typically involve a lookup table or more complex mapping
    // For now, we'll use a simplified approach
    return 'Capital Projects'; // Default value from the mapping doc
  }
  
  /**
   * Map EBS Operating Unit to P6 OBS ID
   * @param {String} operatingUnit - Operating Unit from EBS
   * @returns {String} - Corresponding OBS ID in P6
   */
  mapEBSOperatingUnitToP6OBS(operatingUnit) {
    // This would typically involve a lookup table or more complex mapping
    // For now, we'll use a simplified approach
    if (operatingUnit === 'Capital Projects') {
      return 'OBS1'; // Placeholder OBS ID for Capital Projects
    }
    return 'OBS1'; // Default OBS ID
  }
  
  /**
   * Calculate duration in days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Number} - Duration in days
   */
  calculateDurationInDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
}

module.exports = new DataMappingService();