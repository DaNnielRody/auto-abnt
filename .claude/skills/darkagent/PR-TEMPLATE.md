## Summary
<what + why; bug fixes: root cause in one sentence — what existed and was correct vs what was missing>

## Changes
### <Group by concern>
- `path/file`: <specific, names functions/exports>
### Tests
- `tests/...`: <behaviors covered>

## Manual Verification
```bash
docker compose -f docker-compose.dark-factory.yml up unit-tests --build --abort-on-container-exit --exit-code-from unit-tests
docker compose -f docker-compose.dark-factory.yml --profile client build frontend-build
```

## ⚠️ Not Validated
<explicit untested paths; end with an explicit reviewer-attention request — or "No known gaps.">

## Checklist
- [x] only what is true
- [ ] pending stays visible

## Focus of review
<2-4 real technical questions — e.g. port contract shape, charge-vs-format ordering, secret handling>

Closes #<n>
