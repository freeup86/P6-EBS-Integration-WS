const SyncOperation = require('../models/sync-operation');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class SyncTrackingService {
  /**
   * Log a new sync operation
   * @param {Object} syncOperationData - Sync operation details
   * @returns {Promise<Object>} - Created sync operation object (Sequelize instance)
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

      // Create returns a Sequelize instance
      const syncOperation = await SyncOperation.create(fullOperationData);

      logger.info(`Sync Operation Logged: ${syncOperation.type} - ${syncOperation.status}`);

      // Return the Sequelize instance
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
   * @returns {Promise<Object|null>} - Updated sync operation object (Sequelize instance) or null if not found
   */
  async updateSyncOperation(operationId, updateData) {
    try {
      // Update returns [updatedRowsCount, [updatedInstances]] with returning: true for MSSQL/Postgres
      const [updatedRowsCount, [updatedOperation]] = await SyncOperation.update(
        {
          ...updateData,
          // Set completedAt only when status changes from 'In Progress'
          completedAt: updateData.status && updateData.status !== 'In Progress' ? new Date() : null
        },
        {
          where: { id: operationId },
          returning: true // Important for getting the updated record
        }
      );

      if (updatedRowsCount === 0) {
        logger.warn(`No sync operation found with ID: ${operationId} to update.`);
        return null;
      }

      logger.info(`Sync Operation Updated: ${operationId} - Status: ${updatedOperation?.status}`);
      // Return the updated Sequelize instance
      return updatedOperation;
    } catch (error) {
      logger.error('Error updating sync operation', {
         operationId: operationId,
         updateData: updateData,
         errorMessage: error.message,
         errorStack: error.stack
        });
      throw error;
    }
  }

  /**
   * Get recent sync operations
   * @param {number} limit - Number of operations to retrieve
   * @param {Object} [filters] - Optional filters (e.g., { status: 'Failed' })
   * @returns {Promise<Array<Object>>} - Array of plain JavaScript objects representing recent sync operations
   */
  async getRecentSyncOperations(limit = 10, filters = {}) {
    try {
        // Using simplified options for debugging, original was:
        // const options = {
        //    limit,
        //    order: [['startedAt', 'DESC']],
        //    where: filters
        // };
        const options = {
            limit, // Keep limit
            order: [['startedAt', 'DESC']], // Keep order
            where: filters // Keep filters
        };

        console.log('--- Calling SyncOperation.findAll with options: ---');
        console.log(options);

        // findAll returns an array of Sequelize instances
        const syncOperations = await SyncOperation.findAll(options);

        console.log('--- Raw result from SyncOperation.findAll: ---');
        console.log(JSON.stringify(syncOperations, null, 2));

        // --- Convert to plain JavaScript objects before returning ---
        const plainData = syncOperations.map(op => op.get({ plain: true }));
        // -----------------------------------------------------------

        console.log('--- Value being RETURNED by getRecentSyncOperations (PLAIN): ---');
        console.log(JSON.stringify(plainData, null, 2));

        // Return the array of plain objects
        return plainData;

    } catch (error) {
        // Log error details consistently
        logger.error('Error retrieving sync operations', {
             errorMessage: error.message,
             errorStack: error.stack,
             errorDetails: error // Log the full error object if needed
         });
        // Re-throw the error so the controller can handle it
        throw error;
    }
  }

  /**
   * Clean up old sync operations based on startedAt date
   * @param {number} daysToRetain - Number of days to retain sync operations (default: 30)
   * @returns {Promise<number>} - Number of deleted operations
   */
  async cleanupOldSyncOperations(daysToRetain = 30) {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysToRetain);

      // destroy returns the number of deleted rows
      const deletedCount = await SyncOperation.destroy({
        where: {
          startedAt: {
            [Op.lt]: thresholdDate // Use Sequelize's Op.lt for less than
          }
        }
      });

      logger.info(`Cleaned up ${deletedCount} old sync operations older than ${daysToRetain} days.`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old sync operations', {
          daysToRetain: daysToRetain,
          errorMessage: error.message,
          errorStack: error.stack
        });
      // Decide if you want to throw, or just log the error
      // throw error; // Optional: re-throw if cleanup failure is critical
      return 0; // Return 0 deleted if cleanup failed
    }
  }
}

// Export an instance of the service
module.exports = new SyncTrackingService();