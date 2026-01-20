# alt-ppt4lecture

Single-file slide editor with 16:9 fixed stage and custom `.altppt` packages.

Download
- ZIP (권장): https://github.com/sykaboom/alt-ppt-lecture/raw/main/alt-ppt4lecture.zip?download=1
- HTML (브라우저가 바로 열 수 있음): https://github.com/sykaboom/alt-ppt-lecture/raw/main/web-dist/player.html
- Legacy (문제 발생 시 즉시 사용): https://github.com/sykaboom/alt-ppt-lecture/raw/main/legacy/alt-ppt4lecture.html

Usage
- Open `web-dist/player.html` in Chrome or Edge.
- If needed, open `legacy/alt-ppt4lecture.html` for the fallback version.
- Load or save `.altppt` packages from the toolbar.

Development
- UI/logic sources live in `web-src/` and are inlined into a single-file build.
- Run `node scripts/build-player.js` (or `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-player.ps1`) to regenerate `web-dist/player.html`.
