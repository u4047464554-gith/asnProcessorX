#!/bin/bash
# Test script for MSC Editor functionality
# This script runs all MSC-related tests to validate design and catch regressions

set -e

echo "🧪 Running MSC Editor Tests..."
echo "================================"
echo ""

# Change to frontend directory
cd "$(dirname "$0")/../frontend" || exit 1

echo "📦 Installing dependencies (if needed)..."
npm install --silent

echo ""
echo "🔍 Running MSC Editor component tests..."
npm run test -- src/pages/MscEditor.test.tsx --reporter=verbose

echo ""
echo "🔍 Running useMscEditor hook tests..."
npm run test -- src/hooks/useMscEditor.test.tsx --reporter=verbose

echo ""
echo "✅ All MSC Editor tests completed!"
echo ""
echo "To run tests in watch mode:"
echo "  cd frontend && npm run test:watch"

