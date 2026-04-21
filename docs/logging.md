# EHRSystem Logging Configuration

## Overview

The EHRSystem includes a comprehensive logging configuration that supports file rotation to manage log file sizes and maintain historical logs. Logs are written to both file and console for visibility during development.

## Default Behavior

- **Log File**: `logs/ehrsystem.log` (created in the project root)
- **Log Level**: INFO
- **File Size Limit**: 10 MB (10,485,760 bytes)
- **Backup Files Kept**: 3 (total of 4 log files including the active one)
- **Output Destinations**: Both file and console (stdout)

## Log File Rotation

When the active log file reaches 10 MB, it is automatically rotated:

```
logs/ehrsystem.log        (current active log file)
logs/ehrsystem.log.1      (previous log file)
logs/ehrsystem.log.2      (older log file)
logs/ehrsystem.log.3      (oldest log file)
```

When a new rotation occurs and there are already 3 backup files, the oldest backup (`.3`) is deleted, and the others are renamed:
- `ehrsystem.log` → `ehrsystem.log.1`
- `ehrsystem.log.1` → `ehrsystem.log.2`
- `ehrsystem.log.2` → `ehrsystem.log.3`

## Configuration

Logging behavior is controlled via environment variables:

| Environment Variable | Default Value | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL |
| `LOG_DIR` | `logs` | Directory where log files are stored |
| `LOG_FILE` | `ehrsystem.log` | Name of the log file |
| `LOG_MAX_BYTES` | `10485760` | Maximum file size before rotation (in bytes) |
| `LOG_BACKUP_COUNT` | `3` | Number of backup log files to keep |

### Example Configuration

To change logging to DEBUG level with 5 backup files:

```bash
export LOG_LEVEL=DEBUG
export LOG_BACKUP_COUNT=5
python -m ehrsystem.api
```

Or set via environment file (`.env`):

```
LOG_LEVEL=DEBUG
LOG_BACKUP_COUNT=5
LOG_MAX_BYTES=5242880  # 5 MB
```

## Log Format

Each log entry includes:
- **Timestamp**: ISO format with seconds precision (YYYY-MM-DD HH:MM:SS)
- **Logger Name**: The module where the log was created
- **Level**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Message**: The log message with context

Example:
```
2026-04-21 14:35:22 - ehrsystem.api - INFO - Starting EHRSystem API in development environment
2026-04-21 14:35:22 - ehrsystem.logging_config - INFO - Logging initialized: file=logs/ehrsystem.log, max_bytes=10485760, backup_count=3
2026-04-21 14:35:45 - ehrsystem.api - INFO - User registered successfully: user_id=user-abc123, email=newuser@example.com, role=Patient
2026-04-21 14:36:10 - ehrsystem.api - INFO - Login successful, 2FA challenge created: user_id=user-abc123, challenge_id=challenge-xyz789
2026-04-21 14:36:15 - ehrsystem.api - INFO - User authenticated successfully: user_id=user-abc123, role=Patient, session_expires_at=2026-04-21T14:36:45+00:00
```

## Initialization

### API Server

Logging is automatically initialized when the API starts:

```python
from ehrsystem.api import app
# Logging is set up in api.py during module load
```

### Worker Process

Logging is automatically initialized when the worker starts:

```bash
python -m ehrsystem.worker
```

## Current Logging Coverage

The following operations are logged:

### Authentication (ehrsystem/api.py)
- User registration (success and failures)
- Login attempts (success and failures)
- 2FA verification (success and failures)
- Session creation

### Initialization
- API/Worker startup and environment info
- Logging system initialization with configuration details

## Adding More Logging

To add logging to any module:

```python
import logging

logger = logging.getLogger(__name__)

# Debug level - detailed diagnostic info
logger.debug(f"Processing request: {request_id}")

# Info level - general informational messages
logger.info(f"User {user_id} logged in successfully")

# Warning level - something unexpected but not critical
logger.warning(f"High memory usage detected: {memory_usage}%")

# Error level - serious problem, likely needs attention
logger.error(f"Database connection failed: {error_message}")

# Critical level - system failure
logger.critical(f"All database replicas are down")
```

## Accessing Logs

### During Development

Logs appear in the console (stdout) in real-time:

```bash
python -m ehrsystem.api
# Logs appear here
```

### Log Files

Access historical logs in the `logs/` directory:

```bash
# View current log file
cat logs/ehrsystem.log

# View previous log files
cat logs/ehrsystem.log.1
cat logs/ehrsystem.log.2
cat logs/ehrsystem.log.3

# Follow logs in real-time (on Unix/Linux/Mac)
tail -f logs/ehrsystem.log

# Search logs for specific events
grep "ERROR" logs/ehrsystem.log
grep "user_id=user-abc123" logs/ehrsystem.log
```

## Best Practices

1. **Use appropriate log levels**:
   - DEBUG: Information only useful for diagnosing problems
   - INFO: Confirmation that things are working as expected
   - WARNING: Something unexpected or will become a problem
   - ERROR: A serious problem
   - CRITICAL: System is unusable

2. **Include contextual information**:
   ```python
   # Good - includes context
   logger.info(f"User {user_id} logged in from {ip_address}")
   
   # Avoid - vague
   logger.info("User logged in")
   ```

3. **Sanitize sensitive data**:
   ```python
   # Don't log passwords or tokens
   logger.info(f"User authenticated: email={user_email}")
   # Don't log full tokens
   logger.debug(f"API token (first 8 chars): {token[:8]}...")
   ```

4. **Log at decision points**:
   - Authorization checks
   - Business logic branch decisions
   - Error conditions
   - State transitions

## Troubleshooting

### Logs directory not created

Ensure the application has write permissions to the current directory. The `logs/` directory is created automatically on first run.

### Permission denied errors

On Linux/Mac, check permissions:
```bash
ls -la logs/
chmod 755 logs/
```

### Large log files

If logs grow too quickly:
1. Lower `LOG_MAX_BYTES` for more frequent rotation
2. Increase `LOG_BACKUP_COUNT` to keep more history
3. Reduce `LOG_LEVEL` to WARNING or ERROR

### Logs to a specific directory

Set `LOG_DIR` to an absolute path:
```bash
export LOG_DIR=/var/log/ehrsystem
mkdir -p /var/log/ehrsystem
chmod 755 /var/log/ehrsystem
```

## Related Files

- [ehrsystem/logging_config.py](../ehrsystem/logging_config.py) - Logging configuration setup
- [ehrsystem/config.py](../ehrsystem/config.py) - Runtime settings including logging config
- [ehrsystem/api.py](../ehrsystem/api.py) - API logging initialization
- [ehrsystem/worker.py](../ehrsystem/worker.py) - Worker logging initialization
