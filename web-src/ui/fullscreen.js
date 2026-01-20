        let cursorHideTimer = null;

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
            resizeStage();
            hideCursorLater();
        }

        function exitPresentation() {
            document.body.classList.remove('is-fullscreen');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            resizeStage();
            showCursor();
        }

        document.addEventListener('mousemove', () => {
            if (!document.body.classList.contains('is-fullscreen')) return;
            document.body.classList.remove('cursor-hidden');
            hideCursorLater();
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                document.body.classList.remove('is-fullscreen');
                showCursor();
            }
            resizeStage();
        });
