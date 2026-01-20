        function parseFontSizeValue(value, fallback) {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
        }

        function normalizeFontWeight(value, fallback) {
            if (!value) return fallback;
            const numeric = Number.parseInt(value, 10);
            if (Number.isFinite(numeric)) return numeric;
            const normalized = String(value).toLowerCase();
            if (normalized === 'bold' || normalized === 'bolder') return 700;
            if (normalized === 'normal') return 400;
            return fallback;
        }

        function getTextDefaultsFromControls() {
            const defaults = {
                fontFamily: state.textDefaults.fontFamily,
                fontSize: state.textDefaults.fontSize,
                fontColor: state.textDefaults.fontColor,
                fontWeight: state.textDefaults.fontBold ? 700 : 400
            };

            if (dom.fontFamilySelect && dom.fontFamilySelect.value) {
                defaults.fontFamily = dom.fontFamilySelect.value;
            }
            if (dom.fontSizeInput) {
                const min = Number.parseInt(dom.fontSizeInput.min, 10) || 8;
                const max = Number.parseInt(dom.fontSizeInput.max, 10) || 200;
                let size = parseFontSizeValue(dom.fontSizeInput.value, defaults.fontSize);
                size = Math.min(Math.max(size, min), max);
                defaults.fontSize = size;
            }
            if (dom.fontColorInput && dom.fontColorInput.value) {
                defaults.fontColor = dom.fontColorInput.value;
            }
            if (dom.fontBoldBtn) {
                defaults.fontWeight = dom.fontBoldBtn.classList.contains('is-active') ? 700 : 400;
            }
            return defaults;
        }

        function buildSettingsFromDom() {
            const defaults = getTextDefaultsFromControls();
            state.documentTitle = document.title || state.documentTitle;
            return {
                document: {
                    title: state.documentTitle || 'Presentation',
                    aspectRatio: state.aspectRatio,
                    stage: {
                        width: state.currentStageWidth,
                        height: state.currentStageHeight
                    }
                },
                defaults: {
                    text: defaults
                }
            };
        }

        function readNumericStyle(element, prop, fallback) {
            const value = Number.parseFloat(element.style[prop]);
            if (Number.isFinite(value)) return value;
            const computed = Number.parseFloat(getComputedStyle(element)[prop]);
            return Number.isFinite(computed) ? computed : fallback;
        }

        function readFovFromWrapper(wrapper) {
            if (!wrapper) return null;
            const mode = wrapper.dataset.iframeScaleMode || 'fov';
            const scale = Number.parseFloat(wrapper.dataset.iframeScale);
            const offsetX = Number.parseFloat(wrapper.dataset.iframeOffsetX);
            const offsetY = Number.parseFloat(wrapper.dataset.iframeOffsetY);
            const hasData = Number.isFinite(scale) || Number.isFinite(offsetX) || Number.isFinite(offsetY);
            if (!hasData) return null;
            return {
                mode,
                scale: Number.isFinite(scale) ? scale : 1,
                offsetX: Number.isFinite(offsetX) ? offsetX : 0,
                offsetY: Number.isFinite(offsetY) ? offsetY : 0
            };
        }

        function buildElementFromWrapper(wrapper, assetIdByPath) {
            if (!wrapper) return null;
            const elementId = ensureElementId(wrapper);
            const x = readNumericStyle(wrapper, 'left', wrapper.offsetLeft);
            const y = readNumericStyle(wrapper, 'top', wrapper.offsetTop);
            const width = readNumericStyle(wrapper, 'width', wrapper.offsetWidth);
            const height = readNumericStyle(wrapper, 'height', wrapper.offsetHeight);

            const textBox = wrapper.querySelector('.text-box');
            if (textBox || wrapper.classList.contains('draggable-text')) {
                const computed = getComputedStyle(textBox || wrapper);
                const style = {
                    fontFamily: (textBox && textBox.style.fontFamily) || computed.fontFamily || state.textDefaults.fontFamily,
                    fontSize: parseFontSizeValue((textBox && textBox.style.fontSize) || computed.fontSize, state.textDefaults.fontSize),
                    fontColor: (textBox && textBox.style.color) || computed.color || state.textDefaults.fontColor,
                    fontWeight: normalizeFontWeight((textBox && textBox.style.fontWeight) || computed.fontWeight, state.textDefaults.fontBold ? 700 : 400)
                };
                return {
                    id: elementId,
                    type: 'text',
                    x,
                    y,
                    width,
                    height,
                    text: textBox ? textBox.textContent || '' : '',
                    style
                };
            }

            const img = wrapper.querySelector('img');
            if (img) {
                const assetPath = img.dataset.assetPath;
                const src = img.getAttribute('src') || '';
                if (assetPath) {
                    let assetId = assetIdByPath.get(assetPath);
                    if (!assetId) {
                        assetId = ensureAssetRecordForPath(assetPath, state.packageFiles.get(assetPath), assetPath.split('/').pop());
                        if (assetId) assetIdByPath.set(assetPath, assetId);
                    }
                    return {
                        id: elementId,
                        type: 'image',
                        x,
                        y,
                        width,
                        height,
                        source: { kind: 'asset', assetId }
                    };
                }
                return {
                    id: elementId,
                    type: 'image',
                    x,
                    y,
                    width,
                    height,
                    source: { kind: 'url', url: src }
                };
            }

            const video = wrapper.querySelector('video');
            if (video) {
                const assetPath = video.dataset.assetPath;
                const src = video.getAttribute('src') || '';
                if (assetPath) {
                    let assetId = assetIdByPath.get(assetPath);
                    if (!assetId) {
                        assetId = ensureAssetRecordForPath(assetPath, state.packageFiles.get(assetPath), assetPath.split('/').pop());
                        if (assetId) assetIdByPath.set(assetPath, assetId);
                    }
                    return {
                        id: elementId,
                        type: 'video',
                        x,
                        y,
                        width,
                        height,
                        source: { kind: 'asset', assetId },
                        controls: video.controls,
                        autoplay: video.autoplay,
                        muted: video.muted
                    };
                }
                return {
                    id: elementId,
                    type: 'video',
                    x,
                    y,
                    width,
                    height,
                    source: { kind: 'url', url: src },
                    controls: video.controls,
                    autoplay: video.autoplay,
                    muted: video.muted
                };
            }

            const iframe = wrapper.querySelector('iframe');
            if (iframe) {
                const embedType = wrapper.dataset.elementType;
                const embedUrl = wrapper.dataset.embedUrl || iframe.getAttribute('src') || '';
                const externalUrl = wrapper.dataset.externalUrl || '';
                const provider = wrapper.dataset.embedProvider || '';
                const localFilename = iframe.dataset.filename;
                const isEmbed = embedType === 'embed' || (!localFilename && embedUrl && !normalizeAssetPath(embedUrl));
                if (isEmbed) {
                    return {
                        id: elementId,
                        type: 'embed',
                        x,
                        y,
                        width,
                        height,
                        provider: provider || 'external',
                        url: externalUrl || embedUrl,
                        embedUrl,
                        fov: readFovFromWrapper(wrapper) || undefined
                    };
                }

                const assetPath = iframe.dataset.filename || normalizeAssetPath(iframe.getAttribute('src'));
                if (!assetPath) return null;
                let assetId = assetIdByPath.get(assetPath);
                if (!assetId) {
                    assetId = ensureAssetRecordForPath(assetPath, state.packageFiles.get(assetPath), assetPath.split('/').pop());
                    if (assetId) assetIdByPath.set(assetPath, assetId);
                }
                return {
                    id: elementId,
                    type: 'html',
                    x,
                    y,
                    width,
                    height,
                    source: { kind: 'asset', assetId },
                    fov: readFovFromWrapper(wrapper) || { mode: 'fov', scale: 1, offsetX: 0, offsetY: 0 }
                };
            }

            return null;
        }

        function buildContentFromDom(assetIdByPath) {
            const slides = refreshSlides();
            const contentSlides = [];
            slides.forEach((slide) => {
                const slideId = ensureSlideId(slide);
                const elements = [];
                slide.querySelectorAll('.draggable-img').forEach((wrapper) => {
                    const element = buildElementFromWrapper(wrapper, assetIdByPath);
                    if (element) elements.push(element);
                });
                contentSlides.push({ id: slideId, elements });
            });
            return {
                documentId: ensureDocumentId(),
                slides: contentSlides
            };
        }

        function syncModelsFromDom() {
            const { assetIdByPath } = buildAssetIdMapping();
            const content = buildContentFromDom(assetIdByPath);
            const settings = buildSettingsFromDom();
            state.documentModel = normalizeContentModel(content);
            state.settingsModel = normalizeSettingsModel(settings);
            return { content: state.documentModel, settings: state.settingsModel };
        }

        function syncSlideModelFromDom(slide) {
            if (!slide || state.isRendering) return;
            ensureModelsReady();
            const slideId = ensureSlideId(slide);
            const elements = [];
            slide.querySelectorAll('.draggable-img').forEach((wrapper) => {
                const element = buildElementFromWrapper(wrapper, state.assetPathToId);
                if (element) elements.push(element);
            });
            replaceSlideElementsModel(slideId, elements);
        }

        function syncElementModelFromWrapper(wrapper) {
            if (!wrapper || state.isRendering) return;
            const slide = wrapper.closest('.slide');
            if (!slide) return;
            ensureModelsReady();
            const slideId = ensureSlideId(slide);
            const element = buildElementFromWrapper(wrapper, state.assetPathToId);
            if (!element) return;
            upsertElementModel(slideId, element);
        }
