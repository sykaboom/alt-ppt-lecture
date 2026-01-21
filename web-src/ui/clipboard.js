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
            imageState.fingerprint = null;
            const previousAsset = state.clipboardImage ? state.clipboardImage.assetPath : null;
            state.clipboardImage = imageState;
            if (previousAsset && previousAsset !== imageState.assetPath) removeImageAssetIfUnused(previousAsset);
            syncImageClipboardToSystem(imageState.assetPath);
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

            const handles = createMediaResizeHandles();

            wrapper.appendChild(img);
            handles.forEach((handle) => wrapper.appendChild(handle));
            activeSlide.appendChild(wrapper);

            setupInteraction(wrapper, handles);
            selectImage(wrapper);
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }

        function pasteClipboardImage() {
            if (!state.clipboardImage) return;
            createDraggableImageFromAsset(state.clipboardImage.assetPath, state.clipboardImage);
        }

        function clearClipboardImage() {
            if (!state.clipboardImage) return;
            const assetPath = state.clipboardImage.assetPath;
            state.clipboardImage = null;
            if (assetPath) removeImageAssetIfUnused(assetPath);
        }

        function syncImageClipboardToSystem(assetPath) {
            if (!assetPath) return;
            if (!navigator.clipboard || !window.ClipboardItem) return;
            const blob = state.packageFiles.get(assetPath);
            if (!blob) return;
            const mime = blob.type || guessMimeType(assetPath);
            const payload = blob.type ? blob : new Blob([blob], { type: mime });
            const item = new ClipboardItem({ [mime]: payload });
            navigator.clipboard.write([item]).catch(() => { });
        }

        async function doesClipboardImageMatchInternal(blob) {
            if (!blob || !state.clipboardImage) return false;
            const assetPath = state.clipboardImage.assetPath;
            if (!assetPath) return false;
            const assetBlob = state.packageFiles.get(assetPath);
            if (!assetBlob) return false;
            if (Number.isFinite(assetBlob.size) && Number.isFinite(blob.size) && assetBlob.size !== blob.size) {
                return false;
            }
            const assetType = assetBlob.type || guessMimeType(assetPath);
            const blobType = blob.type || '';
            if (assetType && blobType && assetType !== blobType) return false;

            const [assetFingerprint, blobFingerprint] = await Promise.all([
                getClipboardAssetFingerprint(assetBlob, assetPath),
                getBlobFingerprint(blob)
            ]);
            return !!assetFingerprint && assetFingerprint === blobFingerprint;
        }

        async function getClipboardAssetFingerprint(assetBlob, assetPath) {
            if (!state.clipboardImage) return '';
            if (state.clipboardImage.fingerprint) return state.clipboardImage.fingerprint;
            const fingerprint = await getBlobFingerprint(assetBlob, assetPath);
            if (state.clipboardImage && state.clipboardImage.assetPath === assetPath) {
                state.clipboardImage.fingerprint = fingerprint;
            }
            return fingerprint;
        }

        async function getBlobFingerprint(blob) {
            if (!blob) return '';
            let buffer;
            try {
                buffer = await blob.arrayBuffer();
            } catch (err) {
                return '';
            }
            if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
                try {
                    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
                    return bufferToHex(digest);
                } catch (err) { }
            }
            return hashArrayBuffer(buffer);
        }

        function bufferToHex(buffer) {
            const bytes = new Uint8Array(buffer);
            let hex = '';
            for (let i = 0; i < bytes.length; i += 1) {
                hex += bytes[i].toString(16).padStart(2, '0');
            }
            return hex;
        }

        function hashArrayBuffer(buffer) {
            const bytes = new Uint8Array(buffer);
            let hash = 2166136261;
            for (let i = 0; i < bytes.length; i += 1) {
                hash ^= bytes[i];
                hash = Math.imul(hash, 16777619);
            }
            return (hash >>> 0).toString(16);
        }
