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

### 5. known limitation: Copilot bash session hangs for outputs > ~4 KB

**Not a sandbox-runtime bug.** Reproducible in vanilla Copilot (no sandbox wrapper).

Copilot's internal bash session uses a PTY for command I/O. The macOS kernel PTY
buffer is ~4 KB. For commands that produce more than ~4 KB of output (e.g. a
large `git diff`, or `seq 1 5000`), the writer process blocks when the buffer
fills. Copilot's Node.js event loop drains the PTY too slowly to prevent the
deadlock — the writer never unblocks, the command appears to hang indefinitely.

Confirmed via bisection: `seq 1 1000` (~4 KB) completes; `seq 1 5000` (~24 KB)
hangs — both inside and outside the sandbox wrapper.

**Workaround** — redirect output to a file, then operate on the file:

```bash
run 'git --no-pager diff main..HEAD -- path/ > /tmp/claude/diff.txt 2>&1 && wc -l /tmp/claude/diff.txt'
! cat /tmp/claude/diff.txt     # read directly in terminal, bypassing bash session
```

The file-redirect path bypasses the PTY entirely; the writer finishes instantly.
Using `! cmd` for subsequent reads avoids the PTY for large outputs.

---

### 4. fix: ensure sandbox TMPDIR exists before first use

**Files:** `src/sandbox/sandbox-utils.ts`, `src/sandbox/sandbox-manager.ts`

`generateProxyEnvVars` always sets `TMPDIR=/tmp/claude` (or `$CLAUDE_TMPDIR`)
for sandboxed processes, but the directory was never created. When `TMPDIR`
points to a non-existent path, `mktemp` fails silently and returns an empty
string. Shell sessions that redirect to that empty string (e.g. `cat $tmp`)
then block on stdin — causing the Copilot shell tool to appear to hang after
printing just 1–2 lines of output.

`ensureSandboxTmpdir()` is now called from `initialize()` so the directory
always exists before any sandboxed command runs. `CLAUDE_TMPDIR` can override
the default `/tmp/claude`.

### 6. fix: make Node fetch() honour sandbox proxy env vars

**Cherry-picked from:** [#172](https://github.com/anthropic-experimental/sandbox-runtime/pull/172)
**File:** `src/sandbox/sandbox-utils.ts`

Node's built-in `fetch()` (undici) ignores `HTTP_PROXY`/`HTTPS_PROXY` by
default — unlike `curl` and other CLI tools. On Node 22+, the
`--use-env-proxy` flag tells undici to read these variables.

`generateProxyEnvVars` now sets `NODE_OPTIONS=--use-env-proxy` (prepended to
any existing `NODE_OPTIONS`) when proxy ports are configured and Node >= 22.

### 7. feat: add `allowBrowserProcess` config for macOS sandbox

**Cherry-picked from:** [#173](https://github.com/anthropic-experimental/sandbox-runtime/pull/173)
**Files:** `src/sandbox/macos-sandbox-utils.ts`, `src/sandbox/sandbox-config.ts`, `src/sandbox/sandbox-manager.ts`

Adds an opt-in `allowBrowserProcess` config option (default: `false`) that
grants the Seatbelt permissions Chromium-based browsers need to launch:

- `mach*` — IPC, bootstrap registration (Crashpad), service lookups
- `process-info*` — managing renderer/GPU/utility child processes
- `iokit-open` — GPU and display access
- `ipc-posix-shm*` — renderer ↔ GPU shared memory

Filesystem and network restrictions remain fully enforced. Only enable when
browser automation (e.g. `agent-browser`) is needed. The default security
profile is unchanged.

### 8. fix: report correct version in `srt --version`

**Cherry-picked from:** [#135](https://github.com/anthropic-experimental/sandbox-runtime/pull/135)
**Files:** `src/cli.ts`, `test/cli.test.ts`

`srt --version` previously reported `1.0.0` because `process.env.npm_package_version`
is only set when running via `npm run` — not when invoking the binary directly.
Now reads the version from `package.json` via `createRequire`.
