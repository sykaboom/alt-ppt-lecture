        function updateStageDimensions() {
            if (state.aspectRatio === '16:9') {
                state.currentStageWidth = CONFIG.STAGE_WIDTH_16_9;
                state.currentStageHeight = CONFIG.STAGE_HEIGHT_16_9;
            } else {
                state.currentStageWidth = CONFIG.STAGE_WIDTH_4_3;
                state.currentStageHeight = CONFIG.STAGE_HEIGHT_4_3;
            }
            if (dom.stage) {
                dom.stage.style.width = `${state.currentStageWidth}px`;
                dom.stage.style.height = `${state.currentStageHeight}px`;
            }

            if (dom.ratioBtn) {
                dom.ratioBtn.textContent = `비율: ${state.aspectRatio}`;
            }

            renderThumbnails();
            resizeStage();
            syncSettingsModelFromState();
        }

        function toggleAspectRatio() {
            state.aspectRatio = state.aspectRatio === '16:9' ? '4:3' : '16:9';
            updateStageDimensions();
        }

        function toggleDisplayMode() {
            state.displayMode = state.displayMode === 'fit' ? 'stretch' : 'fit';
            if (dom.fitBtn) {
                dom.fitBtn.textContent = state.displayMode === 'fit' ? '화면: 맞춤' : '화면: 채움';
            }
            resizeStage();
        }

        function updateInvertButton() {
            if (!dom.invertBtn) return;
            const isInverted = document.body.classList.contains('invert-mode');
            dom.invertBtn.textContent = isInverted ? '색상: 색상반전' : '색상: 기본';
        }

        function toggleInvertMode() {
            document.body.classList.toggle('invert-mode');
            updateInvertButton();
        }

        function resizeStage() {
            const stage = dom.stage;
            if (!stage) return;

            const isFullscreen = document.body.classList.contains('is-fullscreen');

            let availableWidth = window.innerWidth;
            let availableHeight = window.innerHeight;
            let offsetY = 0;

            if (!isFullscreen) {
                availableWidth -= 40;
                availableHeight -= 40;

                if (dom.thumbnailStrip) {
                    const reserve = dom.thumbnailStrip.offsetHeight + 30;
                    availableHeight -= reserve;
                    offsetY = -(reserve / 2);
                }
            }

            const targetW = state.currentStageWidth;
            const targetH = state.currentStageHeight;

            const scaleX = availableWidth / targetW;
            const scaleY = availableHeight / targetH;

            let finalScaleX;
            let finalScaleY;

            if (state.displayMode === 'stretch') {
                finalScaleX = scaleX;
                finalScaleY = scaleY;
                offsetY = 0;
            } else {
                const fitScale = Math.min(scaleX, scaleY);
                finalScaleX = fitScale;
                finalScaleY = fitScale;
            }

            if (finalScaleX < 0.1) finalScaleX = 0.1;
            if (finalScaleY < 0.1) finalScaleY = 0.1;

            stage.style.transform = `translate(-50%, calc(-50% + ${offsetY}px)) scale(${finalScaleX}, ${finalScaleY})`;
            state.currentScaleX = finalScaleX;
            state.currentScaleY = finalScaleY;
        }
