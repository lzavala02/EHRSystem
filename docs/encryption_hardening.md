# Encryption Configuration and Hardening

## Overview

This document covers encryption configuration for EHRSystem for data in transit and at rest, aligned with HIPAA and healthcare data protection requirements.

## Data in Transit (TLS/HTTPS)

### Database Connections

**PostgreSQL SSL/TLS:**
- Connection string must include `sslmode=require` or `sslmode=verify-full`
- Example: `postgresql://user:pass@host:5432/dbname?sslmode=require`
- Configure via `DATABASE_URL` environment variable
- Verification: PostgreSQL will refuse non-TLS connections when `sslmode=require` is set

**Configuration:**
```bash
# Required for production
export DATABASE_URL="postgresql://ehr:password@db.example.com:5432/ehrsystem?sslmode=require"
```

### Redis Connections

**Redis TLS:**
- Use `rediss://` protocol for Redis TLS connections
- Alternative: Enable `REDIS_SSL_REQUIRED=true` for string-based URLs
- Certificate validation can be configured via Redis client options

**Configuration:**
```bash
# Production with TLS
export REDIS_URL="rediss://user:password@redis.example.com:6379/0"

# Or with flag
export REDIS_URL="redis://redis.example.com:6379/0"
export REDIS_SSL_REQUIRED=true
```

### API/Frontend Communication

**HTTPS/TLS:**
- All API communication must use HTTPS in production
- TLS termination typically handled by reverse proxy (nginx, HAProxy, AWS ALB, etc.)
- Frontend must only communicate with HTTPS API endpoints

**Configuration:**
```bash
# Enforce HTTPS in production
export API_HTTPS_ONLY=true
export HSTS_ENABLED=true  # HTTP Strict-Transport-Security
```

**Reverse Proxy Headers (nginx example):**
```nginx
# Enable HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Security headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

## Data at Rest Encryption

### Application Layer

**Secret Key Management:**
- Application secret key used for token signing and encryption
- Must be at least 32 characters for production
- Should be stored as a file and referenced via `APP_SECRET_KEY_FILE`
- Never hardcode or commit to version control

**Configuration:**
```bash
# Development (allow insecure key)
export APP_SECRET_KEY="dev-insecure-change-me"

# Production (use file-based secrets)
export APP_SECRET_KEY_FILE="/run/secrets/app_secret_key"
# Content must be ≥32 chars and cryptographically random
```

### Database Layer

**PostgreSQL Encryption:**
- Database-level encryption at rest depends on infrastructure (AWS RDS encryption, encrypted volumes)
- Application can use pgcrypto extension for column-level encryption of sensitive fields
- Backup encryption is recommended via AWS Backup or similar

**Redis Encryption:**
- Redis open-source doesn't support encryption at rest
- Use Redis Enterprise or AWS ElastiCache with encryption enabled
- Alternative: store only session tokens and cache non-sensitive data

### Audit Logs

**Encryption:**
- Audit logs stored in PostgreSQL should inherit database encryption
- Long-term retention should use encrypted storage
- Access to audit logs should be restricted (Admin only, via API endpoints)
- Logs stored in files should use encrypted filesystems

**Retention:**
- Configure log rotation to prevent unlimited growth
- Audit events older than 90 days can be archived to encrypted storage
- See `ehrsystem/logging_config.py` for rotation settings

## Validation and Monitoring

### Startup Validation

The API performs encryption validation at startup:
- Checks for TLS configuration in database and Redis URLs
- Validates application secret key is not the default insecure value
- Logs warnings or errors if encryption is not properly configured
- Reports validation status via `/v1/admin/encryption-status` endpoint

**Example:**
```bash
# After starting the API, check logs:
grep "Encryption validation" logs/ehrsystem.log
```

### Admin Endpoints

**Encryption Status Check:**
```bash
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/v1/admin/encryption-status
```

**Encryption Report:**
```bash
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/v1/admin/encryption-report > report.txt
```

**Audit Log Retrieval:**
```bash
# All events
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/v1/admin/audit-logs

# Filter by type
curl -H "Authorization: Bearer {admin_token}" \
  "http://localhost:8000/v1/admin/audit-logs?event_type=consent.approved"
```

## Deployment Checklist

### Pre-Deployment

- [ ] Database SSL/TLS enabled: `sslmode=require` in connection string
- [ ] Redis TLS enabled: `rediss://` protocol or `REDIS_SSL_REQUIRED=true`
- [ ] App secret key rotated and ≥32 characters
- [ ] HTTPS enforced at reverse proxy level
- [ ] HSTS headers configured on reverse proxy
- [ ] Security headers configured (CSP, X-Frame-Options, X-Content-Type-Options)

### Staging Deployment

- [ ] Encryption validation passes: `APP_ENV=staging` with validation enabled
- [ ] Encryption status endpoint returns "deployment_ready": true
- [ ] Audit logs are being recorded: retrieve via admin endpoint
- [ ] TLS connections working: verify cert validity in database/redis logs
- [ ] Frontend communicates securely: check browser console for mixed content warnings

### Production Deployment

- [ ] All staging checks passed
- [ ] Certificates have validity > 6 months
- [ ] Database backups are encrypted
- [ ] Audit log storage has retention policy
- [ ] Admin access restricted to authorized personnel only
- [ ] Encryption status monitored via periodic admin checks
- [ ] Incident response plan in place for encryption failures

## Troubleshooting

### Database Connection Fails with TLS Error

**Problem:** `"SSL connection required, but the server doesn't support it"`

**Solution:**
1. Verify database supports TLS: `psql -h host -U user -d db -c "SELECT version();"` (without SSL first)
2. Check connection string: ensure `sslmode=require` is present
3. Verify certificate: `openssl s_client -connect host:5432 -showcerts`
4. If self-signed: consider `sslmode=require` with certificate bundle

### Redis Connection Fails with TLS

**Problem:** `"Error 71: SSL_ERROR_PROTOCOL_VERSION"`

**Solution:**
1. Verify Redis server TLS support: check Redis configuration
2. Ensure using correct protocol: `rediss://` for TLS
3. Check certificate validity and compatibility
4. For development, consider `REDIS_SSL_REQUIRED=false` temporarily

### Mixed Content Warning in Browser

**Problem:** "Mixed Content: The page was loaded over HTTPS, but requested an insecure resource"

**Solution:**
1. Ensure frontend `.env.production` has `VITE_API_BASE_URL` with HTTPS
2. Verify reverse proxy is not downgrading HTTPS to HTTP
3. Check reverse proxy security headers are not being stripped

## References

- [OWASP Encryption Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Encryption_Cheat_Sheet.html)
- [PostgreSQL SSL Support](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Redis TLS Support](https://redis.io/topics/encryption)
- [HIPAA Security Rule §164.312(a)(2)(i)](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
