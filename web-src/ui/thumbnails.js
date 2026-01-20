        function scheduleThumbnailRefresh() {
            if (state.thumbnailRefreshPending) return;
            state.thumbnailRefreshPending = true;
            requestAnimationFrame(() => {
                state.thumbnailRefreshPending = false;
                renderThumbnails();
            });
        }

        function renderThumbnails() {
            if (!dom.thumbnailStrip) return;
            dom.thumbnailStrip.innerHTML = '';

            const slides = refreshSlides();
            const thumbW = 160;
            const thumbH = Math.round(thumbW * (state.currentStageHeight / state.currentStageWidth));
            const thumbScaleX = thumbW / state.currentStageWidth;
            const thumbScaleY = thumbH / state.currentStageHeight;
            const thumbScale = Math.min(thumbScaleX, thumbScaleY);

            slides.forEach((slide, index) => {
                const thumb = document.createElement('div');
                thumb.className = 'thumbnail';
                thumb.dataset.index = index;

                const inner = document.createElement('div');
                inner.className = 'thumbnail-inner';
                inner.style.width = `${state.currentStageWidth}px`;
                inner.style.height = `${state.currentStageHeight}px`;
                inner.style.transform = `scale(${thumbScale})`;

                const tx = (thumbW - (state.currentStageWidth * thumbScale)) / 2;
                const ty = (thumbH - (state.currentStageHeight * thumbScale)) / 2;
                inner.style.left = `${tx}px`;
                inner.style.top = `${ty}px`;

                inner.innerHTML = slide.innerHTML;

                inner.querySelectorAll('img[data-asset-path]').forEach((img) => {
                    const assetPath = img.dataset.assetPath;
                    if (!assetPath || !state.packageFiles.has(assetPath)) return;
                    const blob = state.packageFiles.get(assetPath);
                    const objectUrl = URL.createObjectURL(blob);
                    img.src = objectUrl;
                    img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
                    img.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
                });

                inner.querySelectorAll('video[data-asset-path]').forEach((video) => {
                    const assetPath = video.dataset.assetPath;
                    if (!assetPath || !state.packageFiles.has(assetPath)) return;
                    const blob = state.packageFiles.get(assetPath);
                    const objectUrl = URL.createObjectURL(blob);
                    video.src = objectUrl;
                    video.addEventListener('loadeddata', () => URL.revokeObjectURL(objectUrl), { once: true });
                    video.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
                });

                inner.querySelectorAll('iframe').forEach((iframe) => {
                    const assetPath = iframe.dataset.filename;
                    if (!assetPath || !state.packageFiles.has(assetPath)) return;
                    const blob = state.packageFiles.get(assetPath);
                    const objectUrl = URL.createObjectURL(blob);
                    iframe.src = objectUrl;
                    iframe.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
                    iframe.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
                });

                thumb.appendChild(inner);
                dom.thumbnailStrip.appendChild(thumb);
                thumb.addEventListener('click', () => {
                    state.currentSlideIndex = index;
                    updateSlideVisibility();
                });
            });

            updateThumbnailActive();
        }

        function updateThumbnailActive() {
            if (!dom.thumbnailStrip) return;
            const thumbs = dom.thumbnailStrip.querySelectorAll('.thumbnail');
            thumbs.forEach((thumb, index) => {
                thumb.classList.toggle('active', index === state.currentSlideIndex);
            });
        }
