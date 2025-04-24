const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SyncOperation = sequelize.define('SyncOperation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'id' // Explicitly specify column name
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'sync_type'
  },
  source: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'source'
  },
  status: {
    type: DataTypes.ENUM('In Progress', 'Completed', 'Failed'),
    defaultValue: 'In Progress',
    field: 'status'
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'details'
  },
  startedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at'
  }
}, {
  tableName: 'sync_operations', // Explicit table name
  schema: 'dbo', // SQL Server schema
  timestamps: false, // Disable Sequelize's automatic timestamp fields
  indexes: [
    {
      fields: ['sync_type', 'status']
    },
    {
      fields: ['started_at']
    }
  ]
});

module.exports = SyncOperation;