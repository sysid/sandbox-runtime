# sysid branch — Fork Notes

This branch tracks changes on top of `main` from
[anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime).

## Changes vs. main

### 1. fix: allow access to `com.apple.SystemConfiguration.configd`

**Commit:** `2e97944`
**File:** `src/sandbox/macos-sandbox-utils.ts`

Adds `com.apple.SystemConfiguration.configd` to the allowed Mach service
lookups in the macOS sandbox profile. Tools like `uv` query `configd` to
discover network configuration (proxies, DNS, interfaces). Without this
allowance, network-dependent operations fail inside the sandbox.

The service is read-only and standard for any networked macOS application.

### 2. chore: include built `dist/` for git-based installs

**Commit:** `c9e564e`

Adds the compiled `dist/` directory to the repository despite it being
listed in `.gitignore`.

**Why:** When this package is installed directly from git
(`npm install github:user/repo`), npm does **not** run a build step.
Without `dist/` checked in, git-based installs would ship an empty
package with no compiled output. Registry installs (`npm install
@anthropic-ai/sandbox-runtime`) are unaffected because `dist/` is built
during `prepublish`.

> `.gitignore` only prevents *untracked* files from being staged.
> Once force-added (`git add -f dist/`), the files remain tracked
> regardless of `.gitignore`.

### 3. feat: add upstream HTTP proxy support for corporate proxy environments

**Issue:** [anthropic-experimental/sandbox-runtime#147](https://github.com/anthropic-experimental/sandbox-runtime/issues/147)
**Files:** `src/sandbox/sandbox-config.ts`, `src/sandbox/http-proxy.ts`, `src/sandbox/sandbox-manager.ts`

Behind a corporate proxy (e.g. cntlm at `127.0.0.1:3128`), SRT's built-in
proxy connects directly to the internet, causing `ETIMEDOUT`. Traffic must be
chained through the upstream proxy.

Adds an `upstreamHttpProxy` config option to `NetworkConfigSchema`. When set,
both CONNECT (HTTPS) and plain HTTP requests are forwarded through the upstream
proxy instead of connecting directly. The implementation follows the same
pattern as the existing MITM proxy support but uses TCP instead of Unix sockets
and applies globally to all allowed traffic.

SOCKS proxy chaining is not implemented (out of scope for the HTTP use case).

**Configuration** (`~/.srt-settings.json`):

```json
{
  "network": {
    "upstreamHttpProxy": "http://127.0.0.1:3128",
    "allowedDomains": ["api.github.com", "*.ghe.com"],
    "deniedDomains": []
  }
}
```

