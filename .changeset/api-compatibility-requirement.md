---
'refine-sqlx': minor
---

Add 100% API Compatibility requirement to technical specifications

This update introduces a comprehensive API compatibility framework ensuring all features work identically across all package entry points (main, D1, etc.).

**Key Changes:**

- **Section 14**: New mandatory 100% API Compatibility Requirement
- **Core Principle**: Unified API Surface across all exports
- **Feature Implementation Workflow**: 4-step process (Design → Implementation → Testing → Documentation)
- **Environment-Specific Optimizations**: Guidelines for performance while maintaining API parity
- **API Compatibility Testing**: Test matrix and integration test requirements
- **Breaking Change Policy**: Deprecation and migration guidelines
- **Compliance Checklist**: 8 new requirements for API compatibility

**Impact:**

- All future features MUST be implemented in all applicable entry points
- Identical function signatures and behavior required across exports
- API compatibility tests now mandatory for new features
- Documentation must include examples for all entry points
- Zero tolerance for API drift between packages

**Benefits:**

- Users can switch between `refine-sqlx` and `refine-sqlx/d1` without code changes
- Consistent developer experience across all runtime environments
- Predictable behavior regardless of import path
- Easier maintenance and testing

**For Contributors:**

- See Section 14 in CLAUDE_SPEC.md for complete guidelines
- Follow the new compliance checklist for all new features
- Write API compatibility tests for cross-export verification
