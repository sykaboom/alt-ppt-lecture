        function getElementStyleNumber(element, prop, fallback) {
            const value = parseFloat(element.style[prop]);
            return Number.isFinite(value) ? value : fallback;
        }

        function captureImageState(wrapper) {
            const img = wrapper.querySelector('img[data-asset-path]');
            if (!img) return null;
            return {
                assetPath: img.dataset.assetPath,
                left: getElementStyleNumber(wrapper, 'left', wrapper.offsetLeft),
                top: getElementStyleNumber(wrapper, 'top', wrapper.offsetTop),
                width: getElementStyleNumber(wrapper, 'width', wrapper.offsetWidth),
                height: getElementStyleNumber(wrapper, 'height', wrapper.offsetHeight)
            };
        }

        function copySelectedImage() {
            if (!state.selectedImage) return;
            const imageState = captureImageState(state.selectedImage);
            if (!imageState) return;
            const previousAsset = state.clipboardImage ? state.clipboardImage.assetPath : null;
            state.clipboardImage = imageState;
            if (previousAsset && previousAsset !== imageState.assetPath) removeImageAssetIfUnused(previousAsset);
        }

        function createDraggableImageFromAsset(assetPath, layout = {}) {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const blob = state.packageFiles.get(assetPath);
            if (!blob) {
                alert("복사한 이미지 원본을 찾을 수 없습니다.\n다시 복사해주세요.");
                return;
            }

            const objectUrl = URL.createObjectURL(blob);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img selected';
            ensureElementId(wrapper);
            wrapper.style.left = `${Number.isFinite(layout.left) ? layout.left : 400}px`;
            wrapper.style.top = `${Number.isFinite(layout.top) ? layout.top : 200}px`;
            if (Number.isFinite(layout.width)) wrapper.style.width = `${layout.width}px`;
            if (Number.isFinite(layout.height)) wrapper.style.height = `${layout.height}px`;

            const img = document.createElement('img');
            img.src = objectUrl;
            img.dataset.assetPath = assetPath;
            img.style.width = '100%'; img.style.height = '100%';
            img.style.display = 'block'; img.ondragstart = () => false;
            img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
            img.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });

            const handle = document.createElement('div');
            handle.className = 'resize-handle';

            wrapper.appendChild(img); wrapper.appendChild(handle);
            activeSlide.appendChild(wrapper);

            setupInteraction(wrapper, handle);
            selectImage(wrapper);
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }

        function pasteClipboardImage() {
            if (!state.clipboardImage) return;
            createDraggableImageFromAsset(state.clipboardImage.assetPath, state.clipboardImage);
        }
