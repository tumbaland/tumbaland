# @tumbaland/components

A shared React component library for Tumbaland frontend applications, built with TypeScript and Material-UI.

## Publishing the Library

### Prerequisites

1. **NPM Account**: You need an NPM account with publish permissions
2. **NPM Token**: Set up authentication token for automated publishing
3. **Organization**: The package is published under `@tumbaland` scope

### Authentication Setup

1. Create an NPM token with publish permissions:
   ```bash
   npm login
   # or
   npm token create --read-only=false
   ```

2. Set the token as an environment variable:
   ```bash
   export NPM_TOKEN=your_token_here
   ```

3. Configure npm to use the token:
   ```bash
   echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > ~/.npmrc
   ```

### Publishing Process

The library uses `standard-version` for automated versioning and changelog generation.

#### Production Release

```bash
npm run release
```

This command will:
1. Bump version according to conventional commits
2. Skip CHANGELOG.md
3. Skip git tag
4. Build the library (`npm run build`)
5. Publish to npm with public access

#### Beta Release

```bash
npm run release:beta
```

This publishes a beta version (e.g., `1.0.0-beta.0`) with the `beta` tag.

### Manual Publishing Steps

If you need to publish manually:

1. **Build the library**:
   ```bash
   npm run build
   ```

2. **Test the build**:
   ```bash
   npm pack
   # Test the generated .tgz file in a test project
   ```

3. **Publish**:
   ```bash
   npm publish --access public
   ```

## License

MIT
