#!/usr/bin/env python3
"""
Verification Script - Run all tests and checks for the ASN Processor project.

This script serves as a "gatekeeper" for the error correction loop, running:
- Frontend unit tests (Vitest)
- Backend unit tests (Pytest)
- E2E tests (Playwright)
- Linting checks

Usage:
    python scripts/verify_all.py
    python scripts/verify_all.py --skip-e2e  # Skip E2E tests
    python scripts/verify_all.py --verbose   # Verbose output
"""

import subprocess
import sys
import argparse
from pathlib import Path
from typing import Tuple, List

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}\n")

def print_success(text: str):
    """Print success message."""
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_error(text: str):
    """Print error message."""
    print(f"{Colors.RED}✗ {text}{Colors.END}")

def print_warning(text: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.END}")

def run_command(cmd: List[str], cwd: Path = None, verbose: bool = False) -> Tuple[bool, str]:
    """
    Run a command and return success status and output.
    
    Args:
        cmd: Command to run as list of strings
        cwd: Working directory
        verbose: If True, print command output
        
    Returns:
        Tuple of (success: bool, output: str)
    """
    try:
        if verbose:
            print(f"Running: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        output = result.stdout + result.stderr
        
        if verbose and output:
            print(output)
        
        return result.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, "Command timed out after 5 minutes"
    except Exception as e:
        return False, str(e)

def run_frontend_tests(verbose: bool = False) -> bool:
    """Run frontend unit tests."""
    print_header("Frontend Unit Tests (Vitest)")
    
    success, output = run_command(
        ["npm", "run", "test", "--prefix", "frontend"],
        verbose=verbose
    )
    
    if success:
        print_success("Frontend tests passed")
    else:
        print_error("Frontend tests failed")
        if not verbose:
            print("\nLast 20 lines of output:")
            print('\n'.join(output.split('\n')[-20:]))
    
    return success

def run_backend_tests(verbose: bool = False) -> bool:
    """Run backend unit tests."""
    print_header("Backend Unit Tests (Pytest)")
    
    success, output = run_command(
        ["python", "-m", "pytest", "backend", "-v"],
        verbose=verbose
    )
    
    if success:
        print_success("Backend tests passed")
    else:
        print_error("Backend tests failed")
        if not verbose:
            print("\nLast 20 lines of output:")
            print('\n'.join(output.split('\n')[-20:]))
    
    return success

def run_e2e_tests(verbose: bool = False) -> bool:
    """Run E2E tests."""
    print_header("E2E Tests (Playwright)")
    
    success, output = run_command(
        ["npx", "playwright", "test"],
        verbose=verbose
    )
    
    if success:
        print_success("E2E tests passed")
    else:
        print_error("E2E tests failed")
        if not verbose:
            print("\nLast 20 lines of output:")
            print('\n'.join(output.split('\n')[-20:]))
    
    return success

def run_linting(verbose: bool = False) -> bool:
    """Run linting checks."""
    print_header("Linting Checks")
    
    success, output = run_command(
        ["npm", "run", "lint", "--prefix", "frontend"],
        verbose=verbose
    )
    
    if success:
        print_success("Linting passed")
    else:
        print_warning("Linting issues found (non-blocking)")
        if not verbose:
            print("\nLast 20 lines of output:")
            print('\n'.join(output.split('\n')[-20:]))
    
    # Linting is non-blocking, so always return True
    return True

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Run all verification checks")
    parser.add_argument("--skip-e2e", action="store_true", help="Skip E2E tests")
    parser.add_argument("--skip-lint", action="store_true", help="Skip linting")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--frontend-only", action="store_true", help="Run only frontend tests")
    parser.add_argument("--backend-only", action="store_true", help="Run only backend tests")
    
    args = parser.parse_args()
    
    print(f"\n{Colors.BOLD}ASN Processor - Verification Suite{Colors.END}")
    print(f"Running all checks...\n")
    
    results = {}
    
    # Run checks based on arguments
    if not args.backend_only:
        results['frontend'] = run_frontend_tests(args.verbose)
    
    if not args.frontend_only:
        results['backend'] = run_backend_tests(args.verbose)
    
    if not args.skip_e2e and not args.frontend_only and not args.backend_only:
        results['e2e'] = run_e2e_tests(args.verbose)
    
    if not args.skip_lint and not args.backend_only:
        results['lint'] = run_linting(args.verbose)
    
    # Print summary
    print_header("Summary")
    
    all_passed = all(results.values())
    
    for check, passed in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.END}" if passed else f"{Colors.RED}FAILED{Colors.END}"
        print(f"{check.capitalize():20} {status}")
    
    print()
    
    if all_passed:
        print_success("All checks passed! ✨")
        return 0
    else:
        print_error("Some checks failed. Please review the output above.")
        print_warning("Run with --verbose for detailed output")
        return 1

if __name__ == "__main__":
    sys.exit(main())
