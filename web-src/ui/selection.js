        function selectImage(el) {
            deselectImage();
            state.selectedImage = el;
            el.classList.add('selected');
            syncTextControls(el);
        }

        function deselectImage() {
            if (state.selectedImage) {
                state.selectedImage.classList.remove('selected');
                state.selectedImage = null;
            }
            exitTextEditing();
            syncTextControls(null);
        }

        function deleteSelectedImage() {
            if (!state.selectedImage) return;
            if (state.textEditingElement === state.selectedImage) exitTextEditing();
            const wrapper = state.selectedImage;
            const img = wrapper.querySelector('img[data-asset-path]');
            const video = wrapper.querySelector('video[data-asset-path]');
            const assetPath = img ? img.dataset.assetPath : (video ? video.dataset.assetPath : null);
            const iframe = wrapper.querySelector('iframe[data-filename]');
            const htmlFileName = iframe ? iframe.dataset.filename : null;
            const slide = wrapper.closest('.slide');
            const slideId = slide ? ensureSlideId(slide) : '';
            const elementId = ensureElementId(wrapper);
            removeElementModel(slideId, elementId);
            wrapper.remove();
            state.selectedImage = null;
            removeImageAssetIfUnused(assetPath);
            removeHtmlAssetIfUnused(htmlFileName);
            showSaveButton();
        }

        function showSaveButton() {
            if (dom.saveBtn) {
                dom.saveBtn.style.display = 'block';
                dom.saveBtn.textContent = '💾 저장';
            }
            if (dom.saveAsBtn) {
                dom.saveAsBtn.style.display = 'block';
            }
            scheduleThumbnailRefresh();
        }
