# Release Guide

## How to Create a Release and Publish to NPM

This project uses GitHub Actions to automatically publish to NPM when a new release is created.

### Steps to Release:

1. **Ensure all changes are committed and pushed to main branch**

2. **Create a new release on GitHub:**
   - Go to: https://github.com/mateusabelli/refine-d1/releases
   - Click "Create a new release"
   - Create a new tag (e.g., `v2.1.0`)
   - Set release title (e.g., `Release v2.1.0`)
   - Add release notes describing changes
   - Click "Publish release"

3. **GitHub Action will automatically:**
   - Run all tests
   - Build the package
   - Update package.json version to match the git tag
   - Publish to NPM as `refine-d1`

### Prerequisites:

#### NPM Token Setup (One-time setup)
1. Create an NPM account if you don't have one
2. Generate an automation token at: https://www.npmjs.com/settings/tokens
3. Add the token as a repository secret:
   - Go to: https://github.com/mateusabelli/refine-d1/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM automation token

### Version Naming Convention:
- Use semantic versioning: `vMAJOR.MINOR.PATCH`
- Examples:
  - `v2.0.0` - Major release (breaking changes)
  - `v2.1.0` - Minor release (new features)
  - `v2.1.1` - Patch release (bug fixes)

### Manual Testing Before Release:
```bash
# Run tests
npm run test:run

# Build package
npm run build

# Check what will be published
npm pack --dry-run
```

### Rollback if Needed:
If you need to rollback a published version:
```bash
# Unpublish within 24 hours (if no one has downloaded it)
npm unpublish refine-d1@version

# Or deprecate (recommended)
npm deprecate refine-d1@version "Version deprecated due to [reason]"
```
