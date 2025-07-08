#!/bin/bash

# Release script for refine-sql package

set -e

echo "🚀 Starting release process..."

# Function to check if we're in a git repository
check_git() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo "❌ Not in a git repository"
        exit 1
    fi
}

# Function to check working directory is clean
check_clean() {
    if [[ -n $(git status --porcelain) ]]; then
        echo "❌ Working directory is not clean. Please commit your changes."
        exit 1
    fi
}

# Function to update version
update_version() {
    local new_version=$1
    
    echo "📝 Updating version to $new_version"
    npm version "$new_version" --no-git-tag-version
}

# Function to build package
build_package() {
    echo "🔨 Building refine-sql..."
    npm run build
}

# Function to run tests
run_tests() {
    echo "🧪 Running tests..."
    npm run test:run
}

# Main release function
main() {
    local version_type=${1:-patch}
    
    check_git
    check_clean
    
    echo "📋 Release type: $version_type"
    
    # Update version, build, and test
    update_version "$version_type"
    build_package
    run_tests
    
    # Get new version for tagging
    local new_version=$(node -p "require('./package.json').version")
    
    # Commit and tag
    echo "📝 Committing changes..."
    git add .
    git commit -m "chore: release v$new_version"
    git tag "v$new_version"
    
    echo "✅ Release v$new_version completed!"
    echo "📤 To publish, run: git push origin main --tags"
    echo "🚀 This will trigger the GitHub Action workflow for automatic NPM publishing"
}

# Parse arguments
case "${1:-patch}" in
    major|minor|patch)
        main "$1"
        ;;
    *)
        echo "Usage: $0 [major|minor|patch]"
        echo "Example: $0 minor"
        exit 1
        ;;
esac
