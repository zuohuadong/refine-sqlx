---
"refine-orm": major
---

**BREAKING CHANGE**: Remove refine-sql dependency - refine-orm is now fully independent

### What Changed

- **Removed dependency**: No longer depends on `refine-sql` package
- **Independent implementation**: All CRUD operations are now self-contained
- **Updated architecture**: refine-orm is a standalone ORM data provider

### Migration Guide

If you were previously installing both packages:

```bash
# Before
npm install refine-sql refine-orm

# After
npm install refine-orm
```

The API remains unchanged - all existing code will continue to work without modifications.

### Benefits

- ✅ Reduced dependencies
- ✅ Smaller package size
- ✅ Full control over implementation
- ✅ Independent versioning and releases
