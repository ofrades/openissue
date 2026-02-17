# Release Process

This project uses a **local pre-push hook** for automated version bumping and release management. No CI/CD pipeline needed!

## How It Works

When you push to `master` or `main`:

1. **Build Check**: The pre-push hook runs `bun run build`
2. **Version Bump**: If successful, `release-it` bumps the patch version
3. **Git Tag**: Creates a git tag (e.g., `v0.1.2`)
4. **Push**: Pushes the version bump commit and tag to remote

## Manual Release (if needed)

```bash
# Bump patch version (0.1.1 → 0.1.2)
bun run release

# Bump minor version (0.1.1 → 0.2.0)
bun run release -- --increment minor

# Bump major version (0.1.1 → 1.0.0)
bun run release -- --increment major

# With options
bun run release -- --increment minor --ci --no-npm
```

## Configuration

Release settings are in `.release-it.json`:

- **git.commitMessage**: Commit message format
- **git.tagName**: Git tag format
- **github.release**: Set to `false` (no GitHub releases)
- **npm.publish**: Set to `false` (manual if needed)

## What Gets Committed

- `package.json` - Updated version
- Git tag - `v{version}`

## Skipping Automatic Bump

If you want to push without triggering version bump:

```bash
git push --no-verify
```

⚠️ Use sparingly! The hook ensures builds always succeed on main branch.

## Troubleshooting

**"Build failed. Aborting push."**
- Fix the build error locally first: `bun run build`
- Then try pushing again

**"Working directory has uncommitted changes"**
- Commit or stash changes before pushing

**"Release-it: Git ref does not exist"**
- First push to a new branch might skip version bump (expected)
- Subsequent pushes will bump automatically
