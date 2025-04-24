const SyncOperation = require('../models/sync-operation');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class SyncTrackingService {
  /**
   * Log a new sync operation
   * @param {Object} syncOperationData - Sync operation details
   * @returns {Promise<Object>} - Created sync operation
   */
  async logSyncOperation(syncOperationData) {
    try {
      const defaultOperation = {
        type: 'Unknown',
        source: 'N/A',
        status: 'In Progress',
        details: ''
      };

      const fullOperationData = { ...defaultOperation, ...syncOperationData };

      const syncOperation = await SyncOperation.create(fullOperationData);
      
      logger.info(`Sync Operation Logged: ${syncOperation.type} - ${syncOperation.status}`);
      
      return syncOperation;
    } catch (error) {
      logger.error('Error logging sync operation', error);
      throw error;
    }
  }

  /**
   * Update an existing sync operation
   * @param {string} operationId - ID of the sync operation
   * @param {Object} updateData - Updated operation details
   * @returns {Promise<Object>} - Updated sync operation
   */
  async updateSyncOperation(operationId, updateData) {
    try {
      const [updatedRowsCount, [updatedOperation]] = await SyncOperation.update(
        {
          ...updateData,
          completedAt: updateData.status !== 'In Progress' ? new Date() : null
        },
        {
          where: { id: operationId },
          returning: true
        }
      );

      if (updatedRowsCount === 0) {
        logger.warn(`No sync operation found with ID: ${operationId}`);
        return null;
      }

      logger.info(`Sync Operation Updated: ${operationId}`);
      return updatedOperation;
    } catch (error) {
      logger.error('Error updating sync operation', error);
      throw error;
    }
  }

  /**
   * Get recent sync operations
   * @param {number} limit - Number of operations to retrieve
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Array>} - Recent sync operations
   */
  async getRecentSyncOperations(limit = 10, filters = {}) {
    try {
      const options = {
        limit,
        order: [['startedAt', 'DESC']],
        where: filters
      };

      const syncOperations = await SyncOperation.findAll(options);
      return syncOperations;
    } catch (error) {
      logger.error('Error retrieving sync operations', error);
      throw error;
    }
  }

  /**
   * Clean up old sync operations
   * @param {number} daysToRetain - Number of days to retain sync operations
   */
  async cleanupOldSyncOperations(daysToRetain = 30) {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysToRetain);

      const deletedCount = await SyncOperation.destroy({
        where: {
          startedAt: {
            [Op.lt]: thresholdDate
          }
        }
      });

      logger.info(`Cleaned up ${deletedCount} old sync operations`);
    } catch (error) {
      logger.error('Error cleaning up old sync operations', error);
    }
  }
}

module.exports = new SyncTrackingService();