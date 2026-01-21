        function getWrapperMetrics(wrapper) {
            const rect = wrapper.getBoundingClientRect();
            const baseW = wrapper.clientWidth || rect.width || 1;
            const baseH = wrapper.clientHeight || rect.height || 1;
            const scaleX = rect.width / baseW;
            const scaleY = rect.height / baseH;
            return { rect, baseW, baseH, scaleX, scaleY };
        }

        function getIframeViewState(wrapper) {
            if (!wrapper) return { viewScale: 1, offsetX: 0, offsetY: 0 };
            const mode = wrapper.dataset.iframeScaleMode;
            const rawScale = Number.parseFloat(wrapper.dataset.iframeScale);
            const rawOffsetX = Number.parseFloat(wrapper.dataset.iframeOffsetX);
            const rawOffsetY = Number.parseFloat(wrapper.dataset.iframeOffsetY);

            let viewScale = 1;
            let offsetX = 0;
            let offsetY = 0;

            if (mode === 'fov') {
                if (Number.isFinite(rawScale) && rawScale > 0) viewScale = rawScale;
                if (Number.isFinite(rawOffsetX)) offsetX = rawOffsetX;
                if (Number.isFinite(rawOffsetY)) offsetY = rawOffsetY;
                return { viewScale, offsetX, offsetY };
            }

            if (mode === 'viewport') {
                if (Number.isFinite(rawScale) && rawScale > 0) viewScale = rawScale;
                const zoom = viewScale > 0 ? 1 / viewScale : 1;
                if (Number.isFinite(rawOffsetX)) offsetX = -rawOffsetX * zoom;
                if (Number.isFinite(rawOffsetY)) offsetY = -rawOffsetY * zoom;
                return { viewScale, offsetX, offsetY };
            }

            if (Number.isFinite(rawScale) && rawScale > 0) {
                viewScale = 1 / rawScale;
            }
            if (Number.isFinite(rawOffsetX)) offsetX = rawOffsetX;
            if (Number.isFinite(rawOffsetY)) offsetY = rawOffsetY;

            return { viewScale, offsetX, offsetY };
        }

        function updateIframeScaleLabel(wrapper, viewScale) {
            if (!wrapper) return;
            const label = wrapper.querySelector('.iframe-scale-label');
            if (!label) return;
            const zoomPercent = Math.round((1 / viewScale) * 100);
            label.textContent = `${zoomPercent}%`;
        }

        function setIframeInteractive(wrapper, isInteractive) {
            if (!wrapper) return;
            wrapper.classList.toggle('iframe-interactive', isInteractive);
            if (isInteractive) {
                state.isSpacePressed = false;
                state.activeIframePan = null;
                document.body.classList.remove('pan-mode');
                document.body.classList.remove('is-panning');
            }
            const toggle = wrapper.querySelector('.iframe-play-toggle');
            if (!toggle) return;
            if (isInteractive) {
                toggle.textContent = '편집';
                toggle.title = '편집 모드';
            } else {
                toggle.textContent = '재생';
                toggle.title = '재생 모드';
            }
        }

        function toggleIframeInteractive(wrapper) {
            if (!wrapper) return;
            const isInteractive = wrapper.classList.contains('iframe-interactive');
            setIframeInteractive(wrapper, !isInteractive);
        }

        function applyIframeView(wrapper, viewScale, offsetX, offsetY) {
            if (!wrapper) return;
            const iframe = wrapper.querySelector('iframe');
            if (!iframe) return;
            const metrics = getWrapperMetrics(wrapper);
            const baseScale = Number.isFinite(viewScale) ? viewScale : 1;
            const clampedScale = Math.min(Math.max(baseScale, CONFIG.IFRAME_SCALE_MIN), CONFIG.IFRAME_SCALE_MAX);
            const zoom = 1 / clampedScale;
            const scaledW = metrics.baseW * zoom;
            const scaledH = metrics.baseH * zoom;
            const minOffsetX = Math.min(0, metrics.baseW - scaledW);
            const minOffsetY = Math.min(0, metrics.baseH - scaledH);
            const clampedX = Math.min(0, Math.max(offsetX || 0, minOffsetX));
            const clampedY = Math.min(0, Math.max(offsetY || 0, minOffsetY));

            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.transform = `translate(${clampedX}px, ${clampedY}px) scale(${zoom})`;

            wrapper.dataset.iframeScaleMode = 'fov';
            wrapper.dataset.iframeScale = String(clampedScale);
            wrapper.dataset.iframeOffsetX = String(clampedX);
            wrapper.dataset.iframeOffsetY = String(clampedY);

            updateIframeScaleLabel(wrapper, clampedScale);
            syncElementModelFromWrapper(wrapper);
        }

        function zoomIframeView(wrapper, nextScale, anchor) {
            if (!wrapper) return;
            const current = getIframeViewState(wrapper);
            const metrics = getWrapperMetrics(wrapper);
            const anchorX = anchor && Number.isFinite(anchor.x) ? anchor.x : metrics.baseW / 2;
            const anchorY = anchor && Number.isFinite(anchor.y) ? anchor.y : metrics.baseH / 2;
            const currentZoom = current.viewScale > 0 ? 1 / current.viewScale : 1;
            const nextZoom = nextScale > 0 ? 1 / nextScale : 1;
            const contentX = (anchorX - current.offsetX) / currentZoom;
            const contentY = (anchorY - current.offsetY) / currentZoom;
            const nextOffsetX = anchorX - contentX * nextZoom;
            const nextOffsetY = anchorY - contentY * nextZoom;
            applyIframeView(wrapper, nextScale, nextOffsetX, nextOffsetY);
            showSaveButton();
        }

        function ensureIframeControls(wrapper) {
            if (!wrapper || !wrapper.classList.contains('draggable-iframe')) return;
            if (!wrapper.querySelector('iframe')) return;
            let controls = wrapper.querySelector('.iframe-controls');
            if (!controls) {
                controls = document.createElement('div');
                controls.className = 'iframe-controls';

                const playToggle = document.createElement('button');
                playToggle.type = 'button';
                playToggle.className = 'iframe-control-btn iframe-play-toggle';
                playToggle.textContent = '재생';
                playToggle.title = '재생 모드';

                const zoomOut = document.createElement('button');
                zoomOut.type = 'button';
                zoomOut.className = 'iframe-control-btn';
                zoomOut.textContent = '-';
                zoomOut.title = '축소';

                const zoomReset = document.createElement('button');
                zoomReset.type = 'button';
                zoomReset.className = 'iframe-control-btn';
                zoomReset.textContent = '1:1';
                zoomReset.title = '100%';

                const zoomIn = document.createElement('button');
                zoomIn.type = 'button';
                zoomIn.className = 'iframe-control-btn';
                zoomIn.textContent = '+';
                zoomIn.title = '확대';

                const label = document.createElement('span');
                label.className = 'iframe-scale-label';
                label.textContent = '100%';

                controls.appendChild(playToggle);
                controls.appendChild(zoomOut);
                controls.appendChild(zoomReset);
                controls.appendChild(zoomIn);
                controls.appendChild(label);

                controls.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                controls.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                playToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleIframeInteractive(wrapper);
                });

                zoomOut.addEventListener('click', (e) => {
                    e.preventDefault();
                    const current = getIframeViewState(wrapper);
                    zoomIframeView(wrapper, current.viewScale + CONFIG.IFRAME_SCALE_STEP);
                });
                zoomIn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const current = getIframeViewState(wrapper);
                    zoomIframeView(wrapper, current.viewScale - CONFIG.IFRAME_SCALE_STEP);
                });
                zoomReset.addEventListener('click', (e) => {
                    e.preventDefault();
                    applyIframeView(wrapper, 1, 0, 0);
                });

                wrapper.appendChild(controls);
            }

            const current = getIframeViewState(wrapper);
            applyIframeView(wrapper, current.viewScale, current.offsetX, current.offsetY);
            setIframeInteractive(wrapper, wrapper.classList.contains('iframe-interactive'));
        }

        function reloadIframeWrapper(wrapper) {
            if (!wrapper) return false;
            const iframe = wrapper.querySelector('iframe');
            if (!iframe) return false;

            const assetPath = iframe.dataset.filename || normalizeAssetPath(iframe.getAttribute('src'));
            if (assetPath && state.packageFiles.has(assetPath)) {
                const blob = state.packageFiles.get(assetPath);
                if (!blob) return false;
                const objectUrl = refreshAssetUrl(assetPath);
                if (!objectUrl) return false;
                iframe.src = objectUrl;
                return true;
            }

            const currentSrc = iframe.getAttribute('src') || '';
            if (!currentSrc) return false;
            iframe.src = 'about:blank';
            setTimeout(() => {
                iframe.src = currentSrc;
            }, 0);
            return true;
        }

        function refreshAssetUrl(assetPath) {
            if (!assetPath) return '';
            const cached = state.assetObjectUrls.get(assetPath);
            if (cached) {
                URL.revokeObjectURL(cached);
                state.assetObjectUrls.delete(assetPath);
            }
            return getAssetUrlByPath(assetPath);
        }

        function reloadCurrentSlideAssets() {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return false;
            let didReload = false;

            activeSlide.querySelectorAll('img[data-asset-path]').forEach((img) => {
                const assetPath = img.dataset.assetPath;
                if (!assetPath || !state.packageFiles.has(assetPath)) return;
                const objectUrl = refreshAssetUrl(assetPath);
                if (!objectUrl) return;
                img.src = objectUrl;
                didReload = true;
            });

            activeSlide.querySelectorAll('video[data-asset-path]').forEach((video) => {
                const assetPath = video.dataset.assetPath;
                if (!assetPath || !state.packageFiles.has(assetPath)) return;
                const objectUrl = refreshAssetUrl(assetPath);
                if (!objectUrl) return;
                video.src = objectUrl;
                didReload = true;
            });

            activeSlide.querySelectorAll('.draggable-iframe').forEach((wrapper) => {
                if (reloadIframeWrapper(wrapper)) {
                    didReload = true;
                }
            });

            return didReload;
        }

        function initializeIframeControls() {
            document.querySelectorAll('.draggable-iframe').forEach((wrapper) => {
                ensureIframeControls(wrapper);
            });
        }
