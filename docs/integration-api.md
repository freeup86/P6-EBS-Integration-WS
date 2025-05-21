# P6-EBS Integration API Documentation

This document provides detailed information about the P6-EBS Integration API, which allows external systems to trigger synchronization between Oracle EBS and Primavera P6.

## Overview

The P6-EBS Integration API provides a simplified interface for external systems to:

1. Synchronize projects from Oracle EBS to Primavera P6
2. Synchronize tasks from EBS to P6 WBS elements
3. Check the status of synchronization operations
4. Monitor the health of the integration system

## Authentication

The API uses API key authentication. Include the API key in one of the following ways:

1. As an `x-api-key` header in your HTTP request
2. As a query parameter: `?apiKey=your-api-key`
3. In the request body (for POST requests): `{ "apiKey": "your-api-key" }`

To set up API keys, configure the `INTEGRATION_API_KEYS` environment variable with a comma-separated list of valid API keys.

## API Endpoints

### 1. Sync EBS Projects to P6

**Endpoint:** `POST /api/v1/integration/sync/ebs-to-p6`

**Description:** Synchronize projects from Oracle EBS to Primavera P6

**Parameters:**
- `syncTasks` (boolean, optional): Whether to sync tasks as WBS elements (default: false)
- `projectId` (string, optional): Specific project ID to sync; if not provided, syncs all projects

**Example Request - Sync All Projects:**
```bash
curl -X POST \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"syncTasks": true}' \
  https://your-server/api/v1/integration/sync/ebs-to-p6
```

**Example Request - Sync Specific Project:**
```bash
curl -X POST \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "EBS1001", "syncTasks": true}' \
  https://your-server/api/v1/integration/sync/ebs-to-p6
```

**Example Response - Success:**
```json
{
  "success": true,
  "message": "Completed syncing 2 projects: 2 succeeded, 0 failed",
  "results": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "details": [
      {
        "projectId": "EBS1001",
        "name": "Office Building Construction",
        "success": true,
        "p6ProjectId": "123456",
        "tasks": {
          "success": true,
          "synced": 9,
          "failed": 0
        }
      },
      {
        "projectId": "EBS1003",
        "name": "Campus Expansion",
        "success": true,
        "p6ProjectId": "123457",
        "tasks": {
          "success": true,
          "synced": 6,
          "failed": 0
        }
      }
    ],
    "taskSync": {
      "total": 15,
      "succeeded": 15,
      "failed": 0
    }
  }
}
```

### 2. Get Sync Operation Status

**Endpoint:** `GET /api/v1/integration/status/sync/:operationId`

**Description:** Get the status of a specific sync operation

**Parameters:**
- `operationId` (path parameter): ID of the sync operation to check

**Example Request:**
```bash
curl -H "x-api-key: your-api-key" \
  https://your-server/api/v1/integration/status/sync/123e4567-e89b-12d3-a456-426614174000
```

**Example Response:**
```json
{
  "success": true,
  "operation": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "External API: Bulk EBS to P6 Projects and Tasks",
    "source": "All Projects",
    "status": "Completed",
    "details": "Bulk project sync: 2 succeeded, 0 failed. Tasks: 15 succeeded, 0 failed",
    "startedAt": "2025-05-06T19:37:23.553Z",
    "completedAt": "2025-05-06T19:37:24.618Z"
  }
}
```

### 3. Get Recent Sync Operations

**Endpoint:** `GET /api/v1/integration/status/sync`

**Description:** Get a list of recent sync operations

**Parameters:**
- `limit` (query parameter, optional): Maximum number of operations to return (default: 10)

**Example Request:**
```bash
curl -H "x-api-key: your-api-key" \
  https://your-server/api/v1/integration/status/sync?limit=5
```

**Example Response:**
```json
{
  "success": true,
  "operations": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "External API: Bulk EBS to P6 Projects and Tasks",
      "source": "All Projects",
      "status": "Completed",
      "details": "Bulk project sync: 2 succeeded, 0 failed. Tasks: 15 succeeded, 0 failed",
      "startedAt": "2025-05-06T19:37:23.553Z",
      "completedAt": "2025-05-06T19:37:24.618Z"
    },
    {
      "id": "456e4567-e89b-12d3-a456-426614174001",
      "type": "External API: Project EBS to P6",
      "source": "Project EBS1001",
      "status": "Completed",
      "details": "Successfully synced project from EBS to P6",
      "startedAt": "2025-05-06T18:46:24.167Z",
      "completedAt": "2025-05-06T18:46:26.657Z"
    }
  ]
}
```

### 4. Check Integration Health

**Endpoint:** `GET /api/v1/integration/health`

**Description:** Check the health of the integration API and connected services

**Example Request:**
```bash
curl -H "x-api-key: your-api-key" \
  https://your-server/api/v1/integration/health
```

**Example Response:**
```json
{
  "success": true,
  "status": {
    "api": "healthy",
    "p6": "connected",
    "ebs": "connected",
    "timestamp": "2025-05-06T19:38:00.000Z"
  }
}
```

## Error Handling

All API endpoints return a consistent error format:

```json
{
  "success": false,
  "message": "Error message describing the problem",
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed error message"
  }
}
```

Common error codes:
- `MISSING_API_KEY`: API key is required
- `INVALID_API_KEY`: Invalid API key
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Internal server error

## Rate Limiting

The integration API has a rate limit to prevent abuse. The default limits are:
- 1000 requests per 60 minutes per API key

If you exceed the rate limit, you'll receive a 429 Too Many Requests response:

```json
{
  "error": "Too many requests, please try again later.",
  "retryAfter": 45
}
```

The `retryAfter` field indicates the number of minutes to wait before retrying.

## Integrating with External Systems

### Node.js Example

```javascript
const axios = require('axios');

async function syncEBSToP6() {
  try {
    const response = await axios.post(
      'https://your-server/api/v1/integration/sync/ebs-to-p6',
      { syncTasks: true },
      { headers: { 'x-api-key': 'your-api-key' } }
    );
    
    console.log('Sync started:', response.data);
    
    // Optionally check status
    if (response.data.syncOperationId) {
      // Wait a moment for sync to process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await axios.get(
        `https://your-server/api/v1/integration/status/sync/${response.data.syncOperationId}`,
        { headers: { 'x-api-key': 'your-api-key' } }
      );
      
      console.log('Sync status:', statusResponse.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('Sync error:', error.response?.data || error.message);
    throw error;
  }
}

// Execute the sync
syncEBSToP6().catch(console.error);
```

### Python Example

```python
import requests
import time

def sync_ebs_to_p6():
    api_url = 'https://your-server/api/v1/integration/sync/ebs-to-p6'
    headers = {
        'x-api-key': 'your-api-key',
        'Content-Type': 'application/json'
    }
    data = {
        'syncTasks': True
    }
    
    try:
        # Start sync
        response = requests.post(api_url, json=data, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        print('Sync started:', result)
        
        # Optionally check status
        if 'syncOperationId' in result:
            # Wait a moment for sync to process
            time.sleep(5)
            
            status_url = f'https://your-server/api/v1/integration/status/sync/{result["syncOperationId"]}'
            status_response = requests.get(status_url, headers=headers)
            status_response.raise_for_status()
            
            print('Sync status:', status_response.json())
        
        return result
    except requests.exceptions.RequestException as e:
        print('Sync error:', e)
        if hasattr(e, 'response') and e.response:
            print('Error details:', e.response.json())
        raise

# Execute the sync
sync_ebs_to_p6()
```

## Configuration

To configure the integration API, set the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `INTEGRATION_API_KEYS` | Comma-separated list of valid API keys | `test-integration-key` |
| `INTEGRATION_RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `3600000` (60 minutes) |
| `INTEGRATION_RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window | `1000` |

## Support

For issues or questions about the integration API, please contact your system administrator or open an issue in the project repository.