#!/bin/sh
# Script to build, bump version, and push
# Usage: ./prepare-release.sh

set -e

echo "🔨 Building project..."
bun run build || exit 1

echo "✅ Build successful"

# Add build artifacts
git add -A
if ! git diff --cached --quiet; then
  echo "📝 Committing build artifacts..."
  git commit -m "build: update dist" || true
fi

# Bump version (no push yet)
echo "📦 Bumping version and creating release..."
bunx release-it --ci --no-npm --no-git-push

echo "✅ Version bumped successfully!"
echo "📤 Now pushing..."
git push
git push --tags

echo "🎉 Done!"
