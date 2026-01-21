        let cursorHideTimer = null;
        let iframeInteractiveSnapshot = null;

        function hideCursorLater() {
            if (cursorHideTimer) clearTimeout(cursorHideTimer);
            cursorHideTimer = setTimeout(() => {
                document.body.classList.add('cursor-hidden');
            }, CONFIG.CURSOR_HIDE_DELAY_MS);
        }

        function showCursor() {
            if (cursorHideTimer) clearTimeout(cursorHideTimer);
            cursorHideTimer = null;
            document.body.classList.remove('cursor-hidden');
        }

        function startPresentation() {
            document.body.classList.add('is-fullscreen');
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
            iframeInteractiveSnapshot = captureIframeInteractiveState();
            resizeStage();
            hideCursorLater();
        }

        function exitPresentation() {
            document.body.classList.remove('is-fullscreen');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            restoreIframeInteractiveState();
            resizeStage();
            showCursor();
        }

        function captureIframeInteractiveState() {
            const snapshot = new Set();
            document.querySelectorAll('.draggable-iframe').forEach((wrapper) => {
                const id = ensureElementId(wrapper);
                if (wrapper.classList.contains('iframe-interactive')) {
                    snapshot.add(id);
                }
                setIframeInteractive(wrapper, false);
            });
            return snapshot;
        }

        function restoreIframeInteractiveState() {
            if (!iframeInteractiveSnapshot) return;
            document.querySelectorAll('.draggable-iframe').forEach((wrapper) => {
                const id = ensureElementId(wrapper);
                setIframeInteractive(wrapper, iframeInteractiveSnapshot.has(id));
            });
            iframeInteractiveSnapshot = null;
        }

        document.addEventListener('mousemove', () => {
            if (!document.body.classList.contains('is-fullscreen')) return;
            document.body.classList.remove('cursor-hidden');
            hideCursorLater();
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                document.body.classList.remove('is-fullscreen');
                restoreIframeInteractiveState();
                showCursor();
            }
            resizeStage();
        });
