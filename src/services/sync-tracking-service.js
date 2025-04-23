const logger = require('../utils/logger');

class SyncTrackingService {
  constructor() {
    // In-memory storage for sync operations (replace with database in production)
    this.syncOperations = [];
  }

  /**
   * Log a sync operation
   * @param {Object} syncOperation - Sync operation details
   */
  logSyncOperation(syncOperation) {
    const defaultOperation = {
      id: `sync-${Date.now()}`,
      type: 'Unknown',
      source: 'N/A',
      timestamp: new Date().toISOString(),
      status: 'In Progress',
      details: ''
    };

    const fullOperation = { ...defaultOperation, ...syncOperation };
    
    try {
      // In production, this would insert into a database
      this.syncOperations.push(fullOperation);
      
      logger.info(`Sync Operation Logged: ${fullOperation.type} - ${fullOperation.status}`);
      
      // Keep only the last 50 sync operations to prevent memory growth
      if (this.syncOperations.length > 50) {
        this.syncOperations.shift();
      }
      
      return fullOperation;
    } catch (error) {
      logger.error('Error logging sync operation', error);
      return null;
    }
  }

  /**
   * Update status of a sync operation
   * @param {string} operationId - ID of the sync operation
   * @param {Object} updateData - Updated operation details
   */
  updateSyncOperation(operationId, updateData) {
    try {
      const index = this.syncOperations.findIndex(op => op.id === operationId);
      
      if (index !== -1) {
        this.syncOperations[index] = {
          ...this.syncOperations[index],
          ...updateData
        };
        
        logger.info(`Sync Operation Updated: ${operationId}`);
        return this.syncOperations[index];
      }
      
      return null;
    } catch (error) {
      logger.error('Error updating sync operation', error);
      return null;
    }
  }

  /**
   * Get recent sync operations
   * @param {number} limit - Number of operations to retrieve
   */
  getRecentSyncOperations(limit = 10) {
    try {
      // In production, this would query a database
      return this.syncOperations
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      logger.error('Error retrieving sync operations', error);
      return [];
    }
  }
}

module.exports = new SyncTrackingService();