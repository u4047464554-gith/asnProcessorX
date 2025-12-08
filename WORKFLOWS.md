# Development Workflows

This document outlines the key workflows for developing, testing, and maintaining the ASN Processor project.

## Table of Contents

1. [Architectural Principles](#architectural-principles)
2. [Feature Development](#feature-development)
3. [Testing](#testing)
4. [Error Correction with Agents](#error-correction-with-agents)
5. [Release Process](#release-process)

---

## Architectural Principles

This project follows industry best practices for maintainable, scalable software:

### Clean Architecture

We follow **Clean Architecture** principles to ensure:
- **Separation of Concerns**: Business logic is independent of frameworks, UI, and databases
- **Dependency Rule**: Dependencies point inward toward business logic
- **Testability**: Core business logic can be tested without external dependencies

**Project Structure:**
- `backend/domain/` - Core business entities and rules
- `backend/application/` - Use cases and application logic
- `backend/infrastructure/` - External interfaces (database, file system)
- `backend/routers/` - API endpoints (interface adapters)
- `frontend/src/domain/` - Frontend domain models
- `frontend/src/services/` - External service interfaces
- `frontend/src/hooks/` - Application logic hooks
- `frontend/src/components/` - UI components

### SOLID Principles

All code should adhere to SOLID principles:

1. **Single Responsibility**: Each class/module has one reason to change
2. **Open/Closed**: Open for extension, closed for modification
3. **Liskov Substitution**: Subtypes must be substitutable for their base types
4. **Interface Segregation**: Clients shouldn't depend on interfaces they don't use
5. **Dependency Inversion**: Depend on abstractions, not concretions

### Test-Driven Development (TDD)

We use **TDD** to ensure we understand what we implement:

**TDD Cycle (Red-Green-Refactor):**
1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve code while keeping tests green

**Benefits:**
- Better design through thinking about interfaces first
- Comprehensive test coverage by default
- Living documentation through tests
- Confidence in refactoring

---

## Feature Development

### Step-by-Step Process (TDD Approach)

1. **Plan**
   - Define the feature requirements
   - Identify affected components (frontend, backend, or both)
   - Design interfaces and contracts first
   - Create a task list or implementation plan
   - Review with team if needed

2. **Implement (Following TDD)**
   - Create a new branch: `git checkout -b feature/your-feature-name`
   - **RED**: Write failing tests first
     - Define the expected behavior through tests
     - Run tests to confirm they fail (proving they test something)
   - **GREEN**: Write minimal code to make tests pass
     - Implement only what's needed to pass the tests
     - Follow Clean Architecture layers (domain → application → infrastructure)
     - Adhere to SOLID principles
   - **REFACTOR**: Improve code quality
     - Remove duplication
     - Improve naming and structure
     - Ensure tests still pass
   - Update documentation as needed

3. **Verify**
   - Run all tests (see [Testing](#testing) section)
   - Verify linting passes: `npm run lint`
   - Test manually in the application
   - Run the verification script: `python scripts/verify_all.py`
   - Ensure code coverage meets thresholds

4. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: description of your feature"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Create PR with clear description
   - Link to related issues
   - Wait for CI/CD checks to pass
   - Address review feedback

---

## Testing

### Test Types

#### 1. Frontend Unit Tests (Vitest)
```bash
# Run all frontend tests
npm run test --prefix frontend

# Run tests in watch mode
npm run test:watch --prefix frontend

# Run tests with coverage
npm run test:coverage --prefix frontend
```

#### 2. Backend Unit Tests (Pytest)
```bash
# Run all backend tests
python -m pytest backend

# Run specific test file
python -m pytest backend/tests/test_asn.py

# Run with verbose output
python -m pytest backend -v

# Run with coverage
python -m pytest backend --cov=backend --cov-report=html
```

#### 3. End-to-End Tests (Playwright)
```bash
# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
```

#### 4. Run All Tests
```bash
# Use the verification script
python scripts/verify_all.py
```

### Test Coverage Goals

- **Backend**: 80%+ coverage for critical paths
- **Frontend**: 80%+ coverage for components and hooks
- **E2E**: All critical user flows covered

---

## Error Correction with Agents

This workflow describes how to use AI agents (like Antigravity) to identify and fix errors in the codebase.

### Process

1. **Identify Errors**
   - Run the test suite to identify failures
   - Check linting output for code quality issues
   - Review application logs for runtime errors

2. **Analyze with Agent**
   - Provide the agent with:
     - Test failure output
     - Relevant code files
     - Error messages and stack traces
   - Ask the agent to analyze the root cause

3. **Generate Fix**
   - Agent proposes a fix with explanation
   - Review the proposed changes
   - Approve or request modifications

4. **Verify Fix**
   - Run tests again to confirm fix
   - Check for regressions
   - Run full verification: `python scripts/verify_all.py`

5. **Iterate if Needed**
   - If tests still fail, provide new output to agent
   - Agent refines the fix
   - Repeat until all tests pass

### Example Agent Interaction

```
User: "The frontend test 'saves sequence name immediately on blur' is failing. 
       Can you investigate and fix it?"

Agent: [Analyzes test file and component]
       "The test is looking for placeholder 'Sequence name' but the component 
       uses 'Enter sequence name'. I'll update the test to match."

User: "Approved"

Agent: [Makes the fix and runs tests]
       "Fixed! All tests now pass."
```

### Best Practices

- **Be Specific**: Provide exact error messages and test names
- **Share Context**: Include relevant files and recent changes
- **Verify Thoroughly**: Always run full test suite after fixes
- **Document**: Update this workflow if new patterns emerge

---

## Release Process

### Pre-Release Checklist

1. **Run Full Verification**
   ```bash
   python scripts/verify_all.py
   ```

2. **Check Coverage**
   - Ensure coverage meets minimum thresholds
   - Review uncovered critical paths

3. **Update Documentation**
   - Update README.md if needed
   - Update API.md for API changes
   - Update CHANGELOG.md

4. **Version Bump**
   - Update version in `package.json`
   - Update version in backend if applicable

5. **Build and Test**
   ```bash
   npm run build
   npm run electron:build
   ```

6. **Tag Release**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

---

## Quick Reference

### Common Commands

```bash
# Start development server
npm run dev

# Run all tests
python scripts/verify_all.py

# Frontend tests only
npm run test --prefix frontend

# Backend tests only
python -m pytest backend

# E2E tests
npm run test:e2e

# Lint check
npm run lint

# Build for production
npm run build
```

### File Locations

- Frontend code: `frontend/src/`
- Backend code: `backend/`
- Frontend tests: `frontend/src/**/*.test.tsx`
- Backend tests: `backend/tests/`
- E2E tests: `e2e/`
- Scripts: `scripts/`

---

## Contributing

When contributing to this project:

1. Follow the feature development workflow
2. Ensure all tests pass before submitting PR
3. Write tests for new features
4. Update documentation as needed
5. Use conventional commit messages

For questions or issues, consult the team or create an issue in the repository.
