# DJ Cloud

A DJ track library: a Spring Boot backend (`backend/`, see `backend/API.md` for the full REST API) and
a Next.js frontend (`frontend/`).

## Installation

### Basic prerequisites

- **JDK 21+** to build/run the backend (`backend/mvnw.cmd` / `backend/mvnw`).
- **Node.js** to build/run the frontend (`frontend/`).

### External tools required by the backend

Uploaded tracks are processed by an async analysis pipeline (preview generation, BPM detection, key
detection) that shells out to three external command-line tools. These are **not** Java dependencies —
they must be installed separately on any machine that runs the backend, and be on `PATH` (or pointed to
directly via the env vars below).

#### ffmpeg (and ffprobe)

Used to generate the lower-bitrate streaming preview, and to decode the original upload to a plain WAV
before BPM/key analysis.

- Download: [Windows builds from gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (the "release essentials"
  build is enough) or [Windows builds by BtbN](https://github.com/BtbN/FFmpeg-Builds/releases) — both are
  linked from the [official ffmpeg download page](https://ffmpeg.org/download.html).
- Setup: extract, then add the `bin` folder (containing `ffmpeg.exe`/`ffprobe.exe`) to `PATH`, or set the
  `FFMPEG_COMMAND` env var to the full path of `ffmpeg.exe`.
- Verify: `ffmpeg -version`.

#### aubio (BPM detection)

`aubiotrack`, one of aubio's bundled command-line tools, detects beat timestamps, from which BPM is
derived.

- Download: the **plain** (not `-ffmpeg`) precompiled Windows build from
  [aubio.org/download](https://aubio.org/download) — e.g.
  [aubio-0.4.6-win64.zip](https://aubio.org/bin/0.4.6/aubio-0.4.6-win64.zip) (or `-win32.zip` for 32-bit).
  It bundles `aubiotrack.exe` and its required DLLs, no compiler needed.
- Don't bother with the `-ffmpeg`-suffixed variant: it needs a specific old ffmpeg "dev" package from
  Zeranoe, a site that's been shut down for years. It's also unnecessary — the backend already decodes
  every upload to WAV via its own ffmpeg before calling `aubiotrack`, since aubio's plain build can't read
  mp3 directly.
- Setup: extract, then either add the folder to `PATH`, or set `AUBIO_COMMAND` to the full path of
  `aubiotrack.exe` (default assumes `aubiotrack` is on `PATH`).
- Verify: `aubiotrack --help`.

#### keyfinder-cli (musical key detection)

Detects the musical key in Camelot Wheel notation (e.g. `8A`), matching this app's `key` field convention.
No precompiled binaries are provided for any platform — it must be built from source (CMake) against
`libkeyfinder` and ffmpeg's dev libraries. On Windows, the least painful way to get a working C++ toolchain
plus prebuilt ffmpeg dev libs is **MSYS2** (the same style of toolchain aubio's own official Windows
binaries are built with) — this avoids compiling ffmpeg from source (which a vcpkg-based approach would
require).

1. Install [MSYS2](https://www.msys2.org/) (default location `C:\msys64` is assumed below).
2. Open an MSYS2 shell and update it (run twice — the first run replaces the core runtime and needs to
   restart):
   ```
   pacman -Syu
   pacman -Syu
   ```
3. Install the build toolchain and dependencies:
   ```
   pacman -S mingw-w64-x86_64-toolchain mingw-w64-x86_64-cmake mingw-w64-x86_64-ninja \
             mingw-w64-x86_64-pkgconf mingw-w64-x86_64-ffmpeg mingw-w64-x86_64-fftw
   ```
4. From an **MSYS2 MinGW64** shell (not the plain MSYS2 shell — it needs `/mingw64/bin` on `PATH`), build
   and install [libkeyfinder](https://github.com/mixxxdj/libkeyfinder) into the MinGW64 prefix so
   `pkg-config`/CMake can find it automatically:
   ```
   git clone --depth 1 https://github.com/mixxxdj/libkeyfinder.git
   cd libkeyfinder
   cmake -G Ninja -B build -DCMAKE_INSTALL_PREFIX=/mingw64 -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release
   cmake --build build
   cmake --install build
   ```
5. Then build and install [keyfinder-cli](https://github.com/EvanPurkhiser/keyfinder-cli) the same way:
   ```
   git clone --depth 1 https://github.com/EvanPurkhiser/keyfinder-cli.git
   cd keyfinder-cli
   cmake -G Ninja -B build -DCMAKE_INSTALL_PREFIX=/mingw64 -DCMAKE_BUILD_TYPE=Release
   cmake --build build
   cmake --install build
   ```
   This produces `C:\msys64\mingw64\bin\keyfinder-cli.exe`, runnable directly from plain `cmd`/PowerShell
   (all its DLLs live alongside it in that same folder — no MSYS2 shell needed to run it afterward).
6. Setup: set `KEYFINDER_COMMAND` to the full path,
   `C:\msys64\mingw64\bin\keyfinder-cli.exe` — **don't** add `C:\msys64\mingw64\bin` itself to `PATH`, since
   it also contains its own `ffmpeg.exe` that would conflict with the one set up above.
- Verify: `keyfinder-cli -n camelot <some-audio-file>` should print a Camelot key like `11B`.

### Running the backend from an IDE

Adding these tools to `PATH` (or setting `AUBIO_COMMAND`/`KEYFINDER_COMMAND`/`FFMPEG_COMMAND`) via Windows'
"Environment Variables" dialog or PowerShell's `[Environment]::SetEnvironmentVariable` only takes effect
for **new** processes started after the change — and in practice, an already-running IDE (or a terminal
opened before the change) often keeps a stale, cached copy of `PATH` even after being told to re-run the
app, because Windows' environment-change broadcast doesn't always reach every already-open process
reliably. If the analysis pipeline logs `Cannot run program "aubiotrack"`/`"keyfinder-cli"`/`"ffmpeg"`
(`CreateProcess error=2`) even though the tool is installed and verified working from a fresh terminal, this
is almost always why.

The reliable fix, regardless of the cause above, is to set these three env vars **directly on the run
configuration** that launches `BackendApplication`, so it never depends on the IDE's inherited system
`PATH` at all:

```
AUBIO_COMMAND=C:\aubio\bin\aubiotrack.exe
KEYFINDER_COMMAND=C:\msys64\mingw64\bin\keyfinder-cli.exe
FFMPEG_COMMAND=C:\ffmpeg\bin\ffmpeg.exe
```
(adjust the paths to wherever you actually installed each tool — see above)

#### IntelliJ IDEA

1. **Run → Edit Configurations…**
2. Select the `BackendApplication` configuration (or whichever configuration runs
   `de.djcloud.backend.BackendApplication`).
3. Under **Modify options**, enable **Environment variables** if it isn't already shown as a field.
4. Add the three variables above (semicolon-separated, `NAME=value;NAME=value;...`, or one per line
   depending on IntelliJ version).
5. Apply, then re-run.

#### Eclipse

1. **Run → Run Configurations…** (or **Debug Configurations…**).
2. Select the Java Application configuration for `BackendApplication`.
3. Open the **Environment** tab.
4. Click **New** for each of the three variables and add them.
5. Apply, then re-run.

#### VS Code (Java extension)

Add an `env` block to the relevant configuration in `.vscode/launch.json`:
```json
{
  "type": "java",
  "name": "BackendApplication",
  "request": "launch",
  "mainClass": "de.djcloud.backend.BackendApplication",
  "env": {
    "AUBIO_COMMAND": "C:\\aubio\\bin\\aubiotrack.exe",
    "KEYFINDER_COMMAND": "C:\\msys64\\mingw64\\bin\\keyfinder-cli.exe",
    "FFMPEG_COMMAND": "C:\\ffmpeg\\bin\\ffmpeg.exe"
  }
}
```

#### Any other IDE / running via `mvnw` in a terminal

Look for the equivalent "environment variables" field on whatever launches the JVM. Running via
`backend/mvnw.cmd spring-boot:run` from a plain terminal works fine too, **as long as that terminal window
was opened after** the tools were installed and `PATH`/the env vars were set — if in doubt, close the
terminal and open a new one, and confirm with `aubiotrack --help` / `keyfinder-cli --help` / `ffmpeg
-version` before starting the app.

### Related configuration

See `backend/src/main/resources/application.yml` (`app.storage.*`, `app.analysis.*`) for every env var
these tools are read from, plus preview bitrate and per-tool timeout settings.
