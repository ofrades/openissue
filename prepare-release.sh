#!/bin/sh
# Script to build and create a release
# Usage: ./prepare-release.sh [major|minor|patch] (default: patch)

set -e

INCREMENT=${1:-patch}

echo "🔨 Building project..."
bun run build || exit 1

echo "✅ Build successful"

# Commit build artifacts if changed
git add dist/
if ! git diff --cached --quiet; then
  echo "📝 Committing build artifacts..."
  git commit -m "build: update dist" || true
fi

# Use release-it to bump version, tag, and push
echo "📦 Releasing with version bump ($INCREMENT)..."
bunx release-it --ci -i "$INCREMENT"

echo "🎉 Done!"
