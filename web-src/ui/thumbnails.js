        let draggingThumbnailIndex = null;
        let dropTargetThumb = null;
        let suppressThumbnailClick = false;

        function scheduleThumbnailRefresh() {
            if (state.thumbnailRefreshPending) return;
            state.thumbnailRefreshPending = true;
            requestAnimationFrame(() => {
                state.thumbnailRefreshPending = false;
                renderThumbnails();
            });
        }

        function setThumbnailDropTarget(thumb) {
            if (dropTargetThumb && dropTargetThumb !== thumb) {
                dropTargetThumb.classList.remove('drop-target');
            }
            dropTargetThumb = thumb;
            if (dropTargetThumb) {
                dropTargetThumb.classList.add('drop-target');
            }
        }

        function clearThumbnailDragState() {
            if (dropTargetThumb) {
                dropTargetThumb.classList.remove('drop-target');
                dropTargetThumb = null;
            }
            if (dom.thumbnailStrip) {
                dom.thumbnailStrip.querySelectorAll('.thumbnail.dragging').forEach((thumb) => {
                    thumb.classList.remove('dragging');
                });
            }
            draggingThumbnailIndex = null;
            setTimeout(() => {
                suppressThumbnailClick = false;
            }, 0);
        }

        function handleThumbnailDragStart(e) {
            const thumb = e.currentTarget;
            const index = Number.parseInt(thumb.dataset.index, 10);
            if (!Number.isFinite(index)) return;
            draggingThumbnailIndex = index;
            suppressThumbnailClick = true;
            thumb.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
            }
        }

        function handleThumbnailDragOver(e) {
            if (draggingThumbnailIndex === null) return;
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            const thumb = e.currentTarget;
            if (!thumb.classList.contains('dragging')) {
                setThumbnailDropTarget(thumb);
            }
        }

        function handleThumbnailDrop(e) {
            if (draggingThumbnailIndex === null) return;
            e.preventDefault();
            const thumb = e.currentTarget;
            const targetIndex = Number.parseInt(thumb.dataset.index, 10);
            if (Number.isFinite(targetIndex) && targetIndex !== draggingThumbnailIndex) {
                moveSlide(draggingThumbnailIndex, targetIndex);
            }
            clearThumbnailDragState();
        }

        function handleThumbnailDragEnd() {
            clearThumbnailDragState();
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
                    if (suppressThumbnailClick) return;
                    state.currentSlideIndex = index;
                    updateSlideVisibility();
                });
                thumb.draggable = true;
                thumb.addEventListener('dragstart', handleThumbnailDragStart);
                thumb.addEventListener('dragover', handleThumbnailDragOver);
                thumb.addEventListener('drop', handleThumbnailDrop);
                thumb.addEventListener('dragend', handleThumbnailDragEnd);
            });

            updateThumbnailActive();
        }

        function updateThumbnailActive() {
            if (!dom.thumbnailStrip) return;
            const thumbs = dom.thumbnailStrip.querySelectorAll('.thumbnail');
            thumbs.forEach((thumb, index) => {
                thumb.classList.toggle('active', index === state.currentSlideIndex);
            });
            scrollThumbnailStripToActive();
        }

        function scrollThumbnailStripToActive() {
            if (!dom.thumbnailStrip) return;
            const activeThumb = dom.thumbnailStrip.querySelector('.thumbnail.active');
            if (!activeThumb) return;

            const strip = dom.thumbnailStrip;
            const stripWidth = strip.clientWidth;
            const maxScroll = strip.scrollWidth - stripWidth;
            if (maxScroll <= 0) return;

            const thumbCenter = activeThumb.offsetLeft + (activeThumb.offsetWidth / 2);
            let targetScroll = thumbCenter - (stripWidth / 2);
            if (targetScroll < 0) targetScroll = 0;
            if (targetScroll > maxScroll) targetScroll = maxScroll;
            strip.scrollLeft = targetScroll;
        }
