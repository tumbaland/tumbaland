# @tumbaland/components

A shared React component library for Tumbaland frontend applications, built with TypeScript and Material-UI.

## Development

### Running Storybook

Start the interactive component development environment:

```bash
npm run storybook:dev
```

### Building Documentation

### Building the Library

Compile TypeScript and create distribution files:

```bash
npm run build
```

## Publishing the Library

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

The library uses `standard-version` for automated versioning and changelog generation. See the
root [README's "Commits & Releases" section](../../README.md#commits--releases) for the full,
authoritative process. Summary:

```bash
npm run release
```

This bumps `version` from conventional commits since the last `components-v*` tag, writes
`CHANGELOG.md`, commits `chore(release): X.Y.Z`, tags it `components-vX.Y.Z`, builds, and
publishes to npm with public access. Always release through this script — never hand-edit
`version` and run `npm publish` directly, or the package, changelog, and tags drift apart.

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
