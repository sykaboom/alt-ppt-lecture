        function createDraggableVideoFromSource(source, assetPath) {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img draggable-video selected';
            ensureElementId(wrapper);
            const cw = state.currentStageWidth / 2;
            const ch = state.currentStageHeight / 2;
            const width = 640;
            const height = 360;
            wrapper.style.left = `${cw - (width / 2)}px`;
            wrapper.style.top = `${ch - (height / 2)}px`;
            wrapper.style.width = `${width}px`;
            wrapper.style.height = `${height}px`;

            const video = document.createElement('video');
            video.src = source;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            if (assetPath) video.dataset.assetPath = assetPath;

            const handle = document.createElement('div');
            handle.className = 'resize-handle';

            wrapper.appendChild(video);
            wrapper.appendChild(handle);
            activeSlide.appendChild(wrapper);

            setupInteraction(wrapper, handle);
            selectImage(wrapper);
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }

        function createDraggableVideoFromBlob(blob, preferredName) {
            const assetPath = registerVideoAsset(blob, preferredName);
            const objectUrl = URL.createObjectURL(blob);
            createDraggableVideoFromSource(objectUrl, assetPath);
        }

        function createDraggableVideoFromUrl(url) {
            createDraggableVideoFromSource(url, null);
        }

        function createDraggableIframeFromUrl(url, options = {}) {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img draggable-iframe selected';
            ensureElementId(wrapper);
            const cw = state.currentStageWidth / 2;
            const ch = state.currentStageHeight / 2;
            const width = 640;
            const height = 360;
            wrapper.style.left = `${cw - (width / 2)}px`;
            wrapper.style.top = `${ch - (height / 2)}px`;
            wrapper.style.width = `${width}px`;
            wrapper.style.height = `${height}px`;

            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.allowFullscreen = true;
            iframe.setAttribute('allow', options.allow || 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            if (options.title) iframe.setAttribute('title', options.title);

            const handle = document.createElement('div');
            handle.className = 'resize-handle';

            wrapper.dataset.elementType = 'embed';
            wrapper.dataset.embedProvider = options.provider || '';
            wrapper.dataset.externalUrl = options.sourceUrl || '';
            wrapper.dataset.embedUrl = url;

            wrapper.appendChild(iframe);
            wrapper.appendChild(handle);
            activeSlide.appendChild(wrapper);

            ensureIframeControls(wrapper);
            setupInteraction(wrapper, handle);
            selectImage(wrapper);
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }

        function normalizeFontList(value) {
            return String(value || '')
                .split(',')
                .map(entry => entry.replace(/['"]/g, '').trim().toLowerCase())
                .filter(Boolean);
        }

        function pickFontFamilyOption(fontFamily) {
            if (!dom.fontFamilySelect) return '';
            const families = normalizeFontList(fontFamily);
            const options = Array.from(dom.fontFamilySelect.options);
            for (const option of options) {
                const optionFamilies = normalizeFontList(option.value);
                if (optionFamilies.some((family) => families.includes(family))) {
                    return option.value;
                }
            }
            return dom.fontFamilySelect.value || (options[0] ? options[0].value : '');
        }

        function parseFontSize(value, fallback) {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
        }

        function isFontWeightBold(value) {
            if (!value) return false;
            const normalized = String(value).toLowerCase();
            if (normalized === 'bold' || normalized === 'bolder') return true;
            const numeric = Number.parseInt(normalized, 10);
            return Number.isFinite(numeric) && numeric >= 600;
        }

        function toHexColor(value, fallback) {
            if (!value) return fallback;
            const trimmed = value.trim();
            if (trimmed.startsWith('#')) {
                if (trimmed.length === 4) {
                    const r = trimmed[1];
                    const g = trimmed[2];
                    const b = trimmed[3];
                    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
                }
                if (trimmed.length === 7) return trimmed.toLowerCase();
            }
            const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (match) {
                const [r, g, b] = match.slice(1, 4).map(Number);
                if ([r, g, b].every(Number.isFinite)) {
                    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
                }
            }
            return fallback;
        }

        function isTextWrapper(wrapper) {
            return !!(wrapper && wrapper.classList.contains('draggable-text'));
        }

        function getTextBox(wrapper) {
            if (!isTextWrapper(wrapper)) return null;
            return wrapper.querySelector('.text-box');
        }

        function getTextStyleFromBox(box) {
            if (!box) return { ...state.textDefaults };
            const computed = window.getComputedStyle(box);
            const fontFamily = box.style.fontFamily || computed.fontFamily || state.textDefaults.fontFamily;
            const fontSizeValue = box.style.fontSize || computed.fontSize;
            const fontSize = parseFontSize(fontSizeValue, state.textDefaults.fontSize);
            const fontColor = toHexColor(box.style.color || computed.color, state.textDefaults.fontColor);
            const fontWeight = box.style.fontWeight || computed.fontWeight;
            const fontBold = isFontWeightBold(fontWeight);
            return { fontFamily, fontSize, fontColor, fontBold };
        }

        function applyTextStyleToBox(box, style) {
            if (!box || !style) return;
            if (style.fontFamily) box.style.fontFamily = style.fontFamily;
            if (style.fontSize) box.style.fontSize = `${style.fontSize}px`;
            if (style.fontColor) box.style.color = style.fontColor;
            if (typeof style.fontBold === 'boolean') {
                box.style.fontWeight = style.fontBold ? '700' : '400';
            }
        }

        function readTextControlValues() {
            const current = state.textDefaults || {};
            const next = {
                fontFamily: current.fontFamily,
                fontSize: current.fontSize,
                fontColor: current.fontColor,
                fontBold: current.fontBold
            };

            if (dom.fontFamilySelect && dom.fontFamilySelect.value) {
                next.fontFamily = dom.fontFamilySelect.value;
            }

            if (dom.fontSizeInput) {
                const min = Number.parseInt(dom.fontSizeInput.min, 10) || 8;
                const max = Number.parseInt(dom.fontSizeInput.max, 10) || 200;
                let fontSize = parseFontSize(dom.fontSizeInput.value, next.fontSize);
                if (!Number.isFinite(fontSize)) fontSize = next.fontSize;
                fontSize = Math.min(Math.max(fontSize, min), max);
                dom.fontSizeInput.value = fontSize;
                next.fontSize = fontSize;
            }

            if (dom.fontColorInput && dom.fontColorInput.value) {
                next.fontColor = dom.fontColorInput.value;
            }

            if (dom.fontBoldBtn) {
                next.fontBold = dom.fontBoldBtn.classList.contains('is-active');
            }

            return next;
        }

        function setBoldControlState(isBold) {
            if (!dom.fontBoldBtn) return;
            const next = !!isBold;
            dom.fontBoldBtn.classList.toggle('is-active', next);
            dom.fontBoldBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        }

        function syncTextControls(wrapper) {
            if (!dom.fontFamilySelect || !dom.fontSizeInput || !dom.fontColorInput) return;
            const box = isTextWrapper(wrapper) ? getTextBox(wrapper) : null;
            const style = box ? getTextStyleFromBox(box) : state.textDefaults;
            const matchedFont = pickFontFamilyOption(style.fontFamily);
            if (matchedFont) dom.fontFamilySelect.value = matchedFont;
            dom.fontSizeInput.value = style.fontSize;
            dom.fontColorInput.value = toHexColor(style.fontColor, state.textDefaults.fontColor);
            setBoldControlState(style.fontBold);
            state.textDefaults = {
                fontFamily: dom.fontFamilySelect.value || style.fontFamily,
                fontSize: parseFontSize(dom.fontSizeInput.value, style.fontSize),
                fontColor: dom.fontColorInput.value || style.fontColor,
                fontBold: dom.fontBoldBtn ? dom.fontBoldBtn.classList.contains('is-active') : !!style.fontBold
            };
            syncSettingsModelFromState();
        }

        function applyTextControlsToSelection() {
            const next = readTextControlValues();
            state.textDefaults = next;
            const wrapper = state.selectedImage;
            if (isTextWrapper(wrapper)) {
                const box = getTextBox(wrapper);
                if (box) {
                    applyTextStyleToBox(box, next);
                    syncElementModelFromWrapper(wrapper);
                    showSaveButton();
                }
            }
            syncSettingsModelFromState();
        }

        function toggleTextBold() {
            if (!dom.fontBoldBtn) return;
            const isActive = !dom.fontBoldBtn.classList.contains('is-active');
            setBoldControlState(isActive);
            applyTextControlsToSelection();
        }

        function enterTextEditing(wrapper) {
            if (document.body.classList.contains('is-fullscreen')) return;
            if (!isTextWrapper(wrapper)) return;
            const box = getTextBox(wrapper);
            if (!box) return;
            if (state.textEditingElement && state.textEditingElement !== wrapper) {
                exitTextEditing();
            }
            if (state.selectedImage !== wrapper) {
                selectImage(wrapper);
            }
            state.textEditingElement = wrapper;
            wrapper.classList.add('editing');
            box.setAttribute('contenteditable', 'true');
            box.focus({ preventScroll: true });
            syncTextControls(wrapper);
        }

        function exitTextEditing() {
            const wrapper = state.textEditingElement;
            if (!wrapper) return;
            const box = getTextBox(wrapper);
            if (box) {
                box.setAttribute('contenteditable', 'false');
            }
            syncElementModelFromWrapper(wrapper);
            wrapper.classList.remove('editing');
            state.textEditingElement = null;
        }

        function isTextEditingActive(target) {
            if (state.textEditingElement) {
                if (document.body.contains(state.textEditingElement)) return true;
                state.textEditingElement = null;
            }
            const node = target || document.activeElement;
            return !!(node && node.closest && node.closest('.text-box[contenteditable="true"]'));
        }

        function initializeTextBox(wrapper, options = {}) {
            if (!isTextWrapper(wrapper)) return;
            if (wrapper._textInitialized) return;
            wrapper._textInitialized = true;
            const box = getTextBox(wrapper);
            if (!box) return;

            box.setAttribute('spellcheck', 'false');
            if (!box.dataset.placeholder) box.dataset.placeholder = '텍스트 입력';
            box.setAttribute('contenteditable', 'false');

            if (!box.style.fontFamily && state.textDefaults.fontFamily) {
                box.style.fontFamily = state.textDefaults.fontFamily;
            }
            if (!box.style.fontSize && state.textDefaults.fontSize) {
                box.style.fontSize = `${state.textDefaults.fontSize}px`;
            }
            if (!box.style.color && state.textDefaults.fontColor) {
                box.style.color = state.textDefaults.fontColor;
            }
            if (!box.style.fontWeight && state.textDefaults.fontBold) {
                box.style.fontWeight = '700';
            }

            box.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                enterTextEditing(wrapper);
            });

            box.addEventListener('blur', () => {
                if (state.textEditingElement === wrapper) exitTextEditing();
            });

            box.addEventListener('input', () => {
                showSaveButton();
            });

            if (options.autoEdit) {
                enterTextEditing(wrapper);
            }
        }

        function createDraggableTextBox() {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img draggable-text selected';
            ensureElementId(wrapper);
            const cw = state.currentStageWidth / 2;
            const ch = state.currentStageHeight / 2;
            const width = 420;
            const height = 160;
            wrapper.style.left = `${cw - (width / 2)}px`;
            wrapper.style.top = `${ch - (height / 2)}px`;
            wrapper.style.width = `${width}px`;
            wrapper.style.height = `${height}px`;

            const textBox = document.createElement('div');
            textBox.className = 'text-box';
            textBox.dataset.placeholder = '텍스트 입력';
            textBox.textContent = '';
            textBox.setAttribute('contenteditable', 'false');
            textBox.setAttribute('spellcheck', 'false');
            applyTextStyleToBox(textBox, state.textDefaults);

            const handle = document.createElement('div');
            handle.className = 'resize-handle';

            wrapper.appendChild(textBox);
            wrapper.appendChild(handle);
            activeSlide.appendChild(wrapper);

            setupInteraction(wrapper, handle);
            selectImage(wrapper);
            initializeTextBox(wrapper, { autoEdit: true });
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }

        function createDraggableImageFromBlob(blob, preferredName) {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const assetPath = registerImageAsset(blob, preferredName);
            const objectUrl = URL.createObjectURL(blob);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img selected';
            ensureElementId(wrapper);
            const cw = state.currentStageWidth / 2;
            const ch = state.currentStageHeight / 2;
            wrapper.style.left = (cw - 240) + 'px';
            wrapper.style.top = (ch - 150) + 'px';
            wrapper.style.width = '480px';

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

        function setupInteraction(element, handle) {
            element.addEventListener('mousedown', (e) => {
                const isFullscreen = document.body.classList.contains('is-fullscreen');
                const isIframe = element.classList.contains('draggable-iframe');
                if (isFullscreen && !isIframe) return;
                if (state.isSpacePressed && element.classList.contains('draggable-iframe')) return;
                if (e.target === handle) return;
                if (element.classList.contains('draggable-text') && state.textEditingElement === element) {
                    if (e.target.closest('.text-box')) return;
                    exitTextEditing();
                }

                e.stopPropagation(); selectImage(element);

                const startX = e.clientX;
                const startY = e.clientY;

                const startLeft = parseFloat(element.style.left || 0);
                const startTop = parseFloat(element.style.top || 0);

                function onMouseMove(e) {
                    const dx = (e.clientX - startX) / state.currentScaleX;
                    const dy = (e.clientY - startY) / state.currentScaleY;

                    element.style.left = (startLeft + dx) + 'px';
                    element.style.top = (startTop + dy) + 'px';
                }
                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    syncElementModelFromWrapper(element);
                    showSaveButton();
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            handle.addEventListener('mousedown', (e) => {
                if (document.body.classList.contains('is-fullscreen')) return;

                e.stopPropagation(); e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = parseFloat(getComputedStyle(element).width);
                const startHeight = parseFloat(getComputedStyle(element).height);
                const aspectRatio = startWidth / startHeight;
                const isText = element.classList.contains('draggable-text');

                function onMouseMove(e) {
                    const dx = (e.clientX - startX) / state.currentScaleX;
                    const dy = (e.clientY - startY) / state.currentScaleY;
                    const newWidth = startWidth + dx;
                    if (isText) {
                        const newHeight = startHeight + dy;
                        element.style.width = Math.max(newWidth, 80) + 'px';
                        element.style.height = Math.max(newHeight, 40) + 'px';
                        return;
                    }

                    if (newWidth > 50) {
                        element.style.width = newWidth + 'px';
                        element.style.height = (newWidth / aspectRatio) + 'px';
                        if (element.classList.contains('draggable-iframe')) {
                            const current = getIframeViewState(element);
                            applyIframeView(element, current.viewScale, current.offsetX, current.offsetY);
                        }
                    }
                }
                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    syncElementModelFromWrapper(element);
                    showSaveButton();
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
