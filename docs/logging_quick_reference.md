# Logging Quick Reference

## Quick Start

Logging is automatically initialized when the API or worker starts. Log files appear in the `logs/` directory.

## View Logs

```bash
# Watch logs in real-time (PowerShell)
Get-Content logs/ehrsystem.log -Wait

# View last 20 lines
Get-Content logs/ehrsystem.log -Tail 20

# Search for errors
Select-String "ERROR" logs/ehrsystem.log

# Check backup files
Get-ChildItem logs/
```

## Add Logging to Your Code

```python
import logging

logger = logging.getLogger(__name__)

# Use appropriate levels
logger.debug("Detailed info for debugging")
logger.info("Important event occurred")
logger.warning("Something unexpected")
logger.error("Serious problem")
logger.critical("System failure")

# Include context
logger.info(f"Processing patient {patient_id} with {record_count} records")
```

## Configuration

Set environment variables to customize:

```bash
# Development (verbose)
$env:LOG_LEVEL = "DEBUG"

# Production (less verbose)
$env:LOG_LEVEL = "WARNING"

# Custom location
$env:LOG_DIR = "C:\logs"

# Larger files before rotation
$env:LOG_MAX_BYTES = 52428800  # 50 MB

# Keep more backups
$env:LOG_BACKUP_COUNT = 10
```

## File Rotation Example

When active log file reaches 10 MB:
```
Before rotation:
  logs/ehrsystem.log (10 MB) ← being written to

After rotation:
  logs/ehrsystem.log (new, empty)
  logs/ehrsystem.log.1 (10 MB, previous active)
  logs/ehrsystem.log.2
  logs/ehrsystem.log.3

Old .3 file is deleted.
```

## Testing Logging

Run the demo:
```bash
python examples/logging_demo.py
```

This shows all log levels and generates sample entries.

## Current Logging Points

- ✅ Application startup
- ✅ User registration
- ✅ Login/2FA attempts
- ✅ Authentication success
- ✅ Initialization messages

Add logging to:
- Consent workflows
- Dashboard queries
- Symptom logging
- Sync operations
- Error conditions

## Environment Variables

| Variable | Example | Purpose |
|---|---|---|
| LOG_LEVEL | DEBUG, INFO, WARNING, ERROR, CRITICAL | Verbosity level |
| LOG_DIR | logs, /var/log/ehr | Log directory |
| LOG_FILE | ehrsystem.log | Filename |
| LOG_MAX_BYTES | 10485760 | File size for rotation |
| LOG_BACKUP_COUNT | 3, 5, 10 | Number of old files to keep |

## Log Format

```
2026-04-21 14:35:22 - module.name - LEVEL - Message with context
```

- **Timestamp**: When the event occurred (24-hour format)
- **Logger Name**: Which module logged it
- **Level**: Severity (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- **Message**: What happened

## Best Practices

✅ **DO:**
- Include IDs and identifiers (user_id, patient_id, etc.)
- Log at decision points
- Use INFO for normal operations
- Use WARNING/ERROR for problems

❌ **DON'T:**
- Log passwords or tokens
- Log excessive detail in INFO level
- Log sensitive PII unnecessarily
- Use bare `print()` statements

## Troubleshooting

**No logs appear:**
- Check that `logs/` directory exists
- Verify write permissions: `Test-Path logs/`

**Logs too large:**
- Reduce `LOG_MAX_BYTES`
- Increase `LOG_BACKUP_COUNT`
- Lower `LOG_LEVEL` to WARNING

**Missing log entries:**
- Increase `LOG_LEVEL` to DEBUG
- Check module logger names: `logger = logging.getLogger(__name__)`

## See Also

- [docs/logging.md](logging.md) - Complete logging documentation
- [docs/logging_implementation.md](logging_implementation.md) - Implementation details
- [examples/logging_demo.py](../examples/logging_demo.py) - Working example
