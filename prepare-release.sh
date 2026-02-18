#!/bin/sh
# Script to build, bump version, and push
# Usage: ./prepare-release.sh [major|minor|patch] (default: patch)

set -e

INCREMENT=${1:-patch}

echo "🔨 Building project..."
bun run build || exit 1

echo "✅ Build successful"

# Add build artifacts
git add -A
if ! git diff --cached --quiet; then
  echo "📝 Committing build artifacts..."
  git commit -m "build: update dist" || true
fi

# Bump version using npm
echo "📦 Bumping $INCREMENT version in package.json..."
npm version $INCREMENT --no-git-tag-version

# Get the new version
NEW_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F'"' '{print $4}')

# Commit version bump
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create git tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "✅ Version bumped successfully to $NEW_VERSION!"
echo "📤 Now pushing..."
git push
git push --tags

echo "🎉 Done!"
