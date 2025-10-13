# Code Review Guidelines

This document outlines the code review process and standards for the refine-sqlx and refine-sql packages.

## Review Process

### For Contributors

1. **Self-Review First**
   - Review your own code before requesting review
   - Ensure all tests pass locally
   - Run `bun run quality:check` before submitting
   - Check that your changes align with the PR description

2. **PR Requirements**
   - Clear, descriptive title following conventional commits
   - Detailed description of changes
   - Link to related issues
   - Include screenshots/examples for UI changes
   - Add appropriate labels

3. **Response to Feedback**
   - Address all review comments
   - Ask for clarification if feedback is unclear
   - Update the PR description if scope changes
   - Re-request review after making changes

### For Reviewers

1. **Review Checklist**
   - [ ] Code follows project style guidelines
   - [ ] Logic is correct and efficient
   - [ ] Tests are comprehensive and meaningful
   - [ ] Documentation is updated where needed
   - [ ] No security vulnerabilities introduced
   - [ ] Breaking changes are properly documented
   - [ ] Performance implications considered

2. **Review Standards**
   - **Functionality**: Does the code do what it's supposed to do?
   - **Readability**: Is the code easy to understand?
   - **Maintainability**: Will this be easy to modify in the future?
   - **Performance**: Are there any performance concerns?
   - **Security**: Are there any security implications?
   - **Testing**: Are the tests adequate and meaningful?

## Review Categories

### 🔴 Must Fix (Blocking)

- Security vulnerabilities
- Breaking changes without proper migration
- Incorrect functionality
- Missing critical tests
- Code that doesn't compile or pass CI

### 🟡 Should Fix (Non-blocking but important)

- Performance concerns
- Code style violations
- Missing documentation
- Incomplete test coverage
- Unclear variable/function names

### 🟢 Nice to Have (Suggestions)

- Code optimization opportunities
- Alternative implementation approaches
- Additional test cases
- Documentation improvements

## Review Comments Guidelines

### Writing Good Review Comments

**Good Examples:**

```
✅ "Consider using a Map instead of an object here for better performance with large datasets"
✅ "This function could benefit from JSDoc comments explaining the parameters"
✅ "We should add a test case for the error condition on line 45"
```

**Avoid:**

```
❌ "This is wrong"
❌ "Bad code"
❌ "Fix this"
```

### Comment Types

- **Suggestion**: `💡 Consider...`
- **Question**: `❓ Why did you choose...?`
- **Praise**: `👍 Nice solution for...`
- **Nitpick**: `🔧 Minor: ...`
- **Security**: `🔒 Security concern: ...`
- **Performance**: `⚡ Performance: ...`

## Approval Process

### Single Approval Required

- Documentation updates
- Test improvements
- Minor bug fixes
- Dependency updates

### Multiple Approvals Required

- Breaking changes
- New features
- Architecture changes
- Security-related changes

## Automated Checks

All PRs must pass:

- ✅ TypeScript compilation
- ✅ ESLint checks
- ✅ Prettier formatting
- ✅ Unit tests
- ✅ Integration tests
- ✅ Security scans
- ✅ Build process

## Special Review Cases

### Breaking Changes

- Must include migration guide
- Requires approval from maintainers
- Should be documented in CHANGELOG
- Consider deprecation warnings first

### Performance Changes

- Include benchmarks if applicable
- Test with realistic data sizes
- Consider memory usage implications
- Document performance characteristics

### Security Changes

- Extra scrutiny required
- Consider security implications
- Test edge cases thoroughly
- May require security team review

## Review Timeline

- **Initial Response**: Within 2 business days
- **Follow-up Reviews**: Within 1 business day
- **Final Approval**: Based on complexity and changes

## Conflict Resolution

If there are disagreements:

1. Discuss in the PR comments
2. Escalate to maintainers if needed
3. Consider scheduling a call for complex issues
4. Document decisions for future reference

## Review Tools

### GitHub Features

- Use suggestion mode for small fixes
- Request changes for blocking issues
- Approve when ready to merge
- Use draft PRs for work in progress

### Local Testing

```bash
# Checkout PR locally for testing
gh pr checkout <PR_NUMBER>

# Run full quality checks
bun run quality:check

# Test specific scenarios
bun run test:integration
```

## Reviewer Assignment

### Automatic Assignment

- CODEOWNERS file determines default reviewers
- GitHub automatically assigns based on changed files

### Manual Assignment

- Request specific expertise for complex changes
- Include domain experts for specialized areas
- Consider timezone for timely reviews

## Post-Review

### After Approval

- Squash commits if needed
- Update commit message if required
- Merge using appropriate strategy
- Delete feature branch

### After Merge

- Monitor for any issues
- Update documentation if needed
- Communicate changes to team
- Close related issues

## Learning and Improvement

### For New Contributors

- Start with smaller PRs to learn the process
- Ask questions if review feedback is unclear
- Learn from review comments for future PRs

### For Reviewers

- Provide constructive feedback
- Explain the "why" behind suggestions
- Share knowledge and best practices
- Be patient with new contributors

## Resources

- [GitHub PR Review Documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests)
- [Conventional Commits](https://conventionalcommits.org/)
- [Project Contributing Guidelines](../CONTRIBUTING.md)
