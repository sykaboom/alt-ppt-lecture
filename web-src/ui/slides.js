        function updateSlideVisibility() {
            const slides = refreshSlides();
            slides.forEach((slide, index) => {
                slide.classList.remove('active');
                if (index === state.currentSlideIndex) slide.classList.add('active');
            });
            if (dom.indicator) {
                dom.indicator.textContent = `${state.currentSlideIndex + 1} / ${slides.length}`;
            }
            deselectImage();
            updateThumbnailActive();
        }

        function nextSlide() {
            const slides = refreshSlides();
            if (state.currentSlideIndex < slides.length - 1) {
                state.currentSlideIndex++;
                updateSlideVisibility();
            }
        }

        function prevSlide() {
            if (state.currentSlideIndex > 0) {
                state.currentSlideIndex--;
                updateSlideVisibility();
            }
        }

        function moveSlide(fromIndex, toIndex) {
            const stage = dom.stage;
            if (!stage) return;
            const slides = refreshSlides();
            const count = slides.length;
            if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return;
            if (fromIndex < 0 || fromIndex >= count) return;
            if (toIndex < 0 || toIndex >= count) return;
            if (fromIndex === toIndex) return;

            const activeSlide = slides[state.currentSlideIndex];
            const activeSlideId = activeSlide ? ensureSlideId(activeSlide) : null;

            const movingSlide = slides[fromIndex];
            const targetSlide = slides[toIndex];
            if (!movingSlide || !targetSlide) return;

            if (fromIndex < toIndex) {
                stage.insertBefore(movingSlide, targetSlide.nextSibling);
            } else {
                stage.insertBefore(movingSlide, targetSlide);
            }

            const reorderedSlides = refreshSlides();
            if (activeSlideId) {
                const newIndex = Array.from(reorderedSlides).findIndex((slide) => slide.dataset.slideId === activeSlideId);
                if (newIndex >= 0) {
                    state.currentSlideIndex = newIndex;
                }
            }

            reorderSlideModels(reorderedSlides);
            updateSlideVisibility();
            showSaveButton();
        }

        function reorderSlideModels(slides) {
            ensureModelsReady();
            if (!slides || !state.documentModel) return;

            const orderedIds = Array.from(slides).map((slide) => ensureSlideId(slide)).filter(Boolean);
            const byId = new Map();
            (state.documentModel.slides || []).forEach((slide) => {
                if (slide && slide.id) byId.set(slide.id, slide);
            });

            const reordered = [];
            orderedIds.forEach((slideId, index) => {
                let model = byId.get(slideId);
                if (!model) {
                    const slide = slides[index];
                    if (slide) {
                        syncSlideModelFromDom(slide);
                        model = (state.documentModel.slides || []).find((item) => item && item.id === slideId);
                    }
                }
                if (!model) {
                    model = { id: slideId, elements: [] };
                } else {
                    byId.delete(slideId);
                }
                reordered.push(model);
            });

            byId.forEach((model) => reordered.push(model));
            state.documentModel.slides = reordered;
        }

        function addNewSlide() {
            const stage = dom.stage;
            if (!stage) return;
            const newSlide = document.createElement('div');
            newSlide.className = 'slide';
            const slideId = ensureSlideId(newSlide);
            const slides = refreshSlides();
            const currentSlide = slides[state.currentSlideIndex];
            if (currentSlide && currentSlide.nextSibling) {
                stage.insertBefore(newSlide, currentSlide.nextSibling);
            } else {
                stage.appendChild(newSlide);
            }
            const insertIndex = Math.min(state.currentSlideIndex + 1, slides.length);
            ensureSlideModel(slideId, insertIndex);
            setTimeout(() => {
                const updatedSlides = refreshSlides();
                state.currentSlideIndex = Math.min(state.currentSlideIndex + 1, updatedSlides.length - 1);
                updateSlideVisibility();
                showSaveButton();
                renderThumbnails();
            }, 50);
        }

        function collectSlideAssets(slide) {
            const imageAssets = new Set();
            const htmlAssets = new Set();

            slide.querySelectorAll('img[data-asset-path]').forEach((img) => {
                if (img.dataset.assetPath) imageAssets.add(img.dataset.assetPath);
            });

            slide.querySelectorAll('video[data-asset-path]').forEach((video) => {
                if (video.dataset.assetPath) imageAssets.add(video.dataset.assetPath);
            });

            slide.querySelectorAll('iframe').forEach((iframe) => {
                const fileName = iframe.dataset.filename || normalizeAssetPath(iframe.getAttribute('src'));
                if (fileName) htmlAssets.add(fileName);
            });

            return { imageAssets, htmlAssets };
        }

        function deleteCurrentSlide() {
            requestDeleteSlide(state.currentSlideIndex);
        }

        function requestDeleteSlide(index) {
            const slides = refreshSlides();
            if (!slides.length) return;
            if (index < 0 || index >= slides.length) return;

            const message = slides.length === 1
                ? '마지막 슬라이드는 삭제할 수 없어 내용만 비웁니다. 계속할까요?'
                : '선택한 슬라이드를 삭제할까요?';

            if (!confirm(message)) return;
            deleteSlideAtIndex(index);
        }

        function deleteSlideAtIndex(index) {
            const slides = refreshSlides();
            if (index < 0 || index >= slides.length) return;

            const slide = slides[index];
            ensureModelsReady();
            const slideId = ensureSlideId(slide);
            const { imageAssets, htmlAssets } = collectSlideAssets(slide);

            if (slides.length === 1) {
                slide.innerHTML = '';
                replaceSlideElementsModel(slideId, []);
                state.currentSlideIndex = 0;
            } else {
                slide.remove();
                removeSlideModel(slideId);
                const updatedSlides = refreshSlides();
                if (state.currentSlideIndex > index) {
                    state.currentSlideIndex -= 1;
                } else if (state.currentSlideIndex >= updatedSlides.length) {
                    state.currentSlideIndex = updatedSlides.length - 1;
                }
            }

            deselectImage();
            imageAssets.forEach(removeImageAssetIfUnused);
            htmlAssets.forEach(removeHtmlAssetIfUnused);
            updateSlideVisibility();
            showSaveButton();
            renderThumbnails();
        }
