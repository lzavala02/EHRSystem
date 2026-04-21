# Logging Implementation Summary

## What Has Been Added

A comprehensive logging system has been added to the EHRSystem project with file rotation support to manage log file sizes and maintain historical records.

## Files Created

### 1. **ehrsystem/logging_config.py** (New)
- Core logging configuration module
- Implements `RotatingFileHandler` with configurable rotation
- Sets up both file and console logging
- **Features:**
  - Automatic log directory creation
  - Rotating file handler with 10 MB default size limit
  - Keeps 3 backup files by default (4 total including active file)
  - ISO format timestamps (YYYY-MM-DD HH:MM:SS)
  - Console output for development visibility

### 2. **docs/logging.md** (New)
- Comprehensive logging documentation
- Configuration options and environment variables
- Log format and file rotation behavior
- Best practices for adding logging
- Troubleshooting guide
- Examples of viewing and searching logs

### 3. **examples/logging_demo.py** (New)
- Demonstration script showing logging in action
- Shows all log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Simulates realistic log entries
- Useful for testing file rotation

### 4. **.gitignore** (New/Updated)
- Excludes `logs/` directory from version control
- Prevents log files from being committed

## Files Modified

### 1. **ehrsystem/config.py**
- Added logging configuration fields to `Settings` dataclass:
  - `log_level`: Log level (default: INFO)
  - `log_dir`: Log directory (default: logs)
  - `log_file`: Log file name (default: ehrsystem.log)
  - `log_max_bytes`: File size limit (default: 10 MB)
  - `log_backup_count`: Backup files to keep (default: 3)
- Updated `load_settings()` to read logging environment variables

### 2. **ehrsystem/api.py**
- Added logging import and initialization at startup
- Creates logger instance for the module
- Added logging to key authentication endpoints:
  - User registration (success and failures)
  - Login attempts (success and failures)
  - 2FA verification (success and failures)
- Logs include contextual information (user IDs, timestamps, etc.)

### 3. **ehrsystem/worker.py**
- Added logging import and initialization
- Logs worker startup and queue configuration
- Can extend to log job processing events

## Key Features

### File Rotation
- **Automatic**: When log file reaches 10 MB, it's automatically rotated
- **Backup Count**: Keeps 3 old files (4 total with active file)
- **Naming**: Standard rotating file handler format (`.1`, `.2`, `.3`)

### Configuration
All logging behavior can be customized via environment variables:
```bash
export LOG_LEVEL=DEBUG
export LOG_DIR=/custom/log/path
export LOG_FILE=myapp.log
export LOG_MAX_BYTES=5242880  # 5 MB
export LOG_BACKUP_COUNT=5
```

### Log Format
```
2026-04-21 11:57:02 - ehrsystem.api - INFO - User registered successfully: user_id=user-abc123, email=demo@example.com, role=Patient
```

## Usage

### Run the Demo
```bash
python examples/logging_demo.py
```

### View Log Files
```bash
# Current log file
cat logs/ehrsystem.log

# Previous log files (if rotation has occurred)
cat logs/ehrsystem.log.1
cat logs/ehrsystem.log.2
cat logs/ehrsystem.log.3

# Search logs
grep "ERROR" logs/ehrsystem.log
grep "user_id=" logs/ehrsystem.log
```

### Start API with Custom Logging
```bash
LOG_LEVEL=DEBUG LOG_MAX_BYTES=5242880 LOG_BACKUP_COUNT=5 \
  python -m ehrsystem.api
```

## Current Logging Coverage

### Implemented
- ✅ Application startup (API and Worker)
- ✅ User registration (success/failure)
- ✅ Login attempts (success/failure)
- ✅ 2FA verification (success/failure)
- ✅ Session creation
- ✅ Logging initialization with configuration

### Ready for Extension
- Dashboard operations
- Consent workflow actions
- Symptom logging entries
- Sync operations
- Alert generation
- Report generation
- Background job processing

## Testing

All existing tests continue to pass:
```bash
pytest tests/unit -q
# Result: 27 passed
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `LOG_LEVEL` | INFO | Set logging verbosity |
| `LOG_DIR` | logs | Directory for log files |
| `LOG_FILE` | ehrsystem.log | Log file name |
| `LOG_MAX_BYTES` | 10485760 | Rotation size (10 MB) |
| `LOG_BACKUP_COUNT` | 3 | Backup files to keep |

## Example Log Output

```
2026-04-21 11:57:02 - root - INFO - Logging initialized: file=logs\ehrsystem.log, max_bytes=10485760, backup_count=3
2026-04-21 11:57:02 - ehrsystem.api - INFO - Starting EHRSystem API in development environment
2026-04-21 11:57:02 - ehrsystem.api - INFO - User registered successfully: user_id=user-abc123, email=newuser@example.com, role=Patient
2026-04-21 11:57:02 - ehrsystem.api - INFO - Login successful, 2FA challenge created: user_id=user-abc123, challenge_id=challenge-xyz789
2026-04-21 11:57:02 - ehrsystem.api - INFO - User authenticated successfully: user_id=user-abc123, role=Patient, session_expires_at=2026-04-21T14:36:45+00:00
```

## Next Steps

To extend logging coverage to other parts of the system:

1. Import the logger:
   ```python
   import logging
   logger = logging.getLogger(__name__)
   ```

2. Add log statements at important points:
   ```python
   logger.info(f"Creating consent request for patient {patient_id}")
   logger.error(f"Failed to sync with Epic system: {error}")
   ```

3. Use appropriate log levels:
   - DEBUG: Detailed diagnostic information
   - INFO: General informational messages
   - WARNING: Something unexpected but not critical
   - ERROR: Serious problems
   - CRITICAL: System failures

See [docs/logging.md](../docs/logging.md) for complete guidelines.
