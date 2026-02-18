# Release Process

This project uses **`release-it`** for automated version bumping, tagging, and publishing. No CI/CD pipeline needed!

## Quick Start

```bash
# Build, bump patch version, create tag, and push
./prepare-release.sh

# Or bump specific version
./prepare-release.sh minor
./prepare-release.sh major
```

That's it! The script will:
1. ✅ Build the project (`bun run build`)
2. 📝 Commit build artifacts (dist/)
3. 📦 Bump version in `package.json`
4. 🏷️ Create git tag (e.g., `v0.1.2`)
5. 📤 Push everything to remote

## Manual Release (if needed)

```bash
# Bump patch version (0.1.1 → 0.1.2)
bunx release-it --ci -i patch

# Bump minor version (0.1.1 → 0.2.0)
bunx release-it --ci -i minor

# Bump major version (0.1.1 → 1.0.0)
bunx release-it --ci -i major
```

## Configuration

Release settings are in `.release-it.json`:

- **git.commitMessage**: Commit message format
- **git.tagName**: Git tag format (`v${version}`)
- **git.push**: Automatically push to remote
- **npm.publish**: Set to `false` (no npm publishing)

## What Gets Committed

- `package.json` - Updated version
- `dist/` - Built files (if changed)
- Git tag - `v{version}`

## Version History

Versions are tracked via git tags. View them with:

```bash
git tag
git log --oneline --decorate
```

## Troubleshooting

**"Build failed. Aborting push."**
- Fix the build error locally: `bun run build`
- Then run the script again

**"Working directory is not clean"**
- Commit any pending changes first: `git add -A && git commit -m "..."`
- Then run the script again

**"Tag already exists"**
- You're trying to release a version that already exists
- Check `git tag` to see existing versions
- The script will auto-increment if you run it again

## Workflow Example

```bash
# Make changes and commit
git add .
git commit -m "feat: add new feature"

# When ready to release:
./prepare-release.sh

# Or for bigger changes:
./prepare-release.sh minor
```
# Test release process
