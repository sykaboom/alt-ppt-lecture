        function applySettingsFromModel(settings) {
            if (!settings || !settings.document) return;
            const docSettings = settings.document;
            if (docSettings.title) {
                document.title = docSettings.title;
                state.documentTitle = docSettings.title;
            }
            if (docSettings.aspectRatio === '16:9' || docSettings.aspectRatio === '4:3') {
                state.aspectRatio = docSettings.aspectRatio;
            }
            updateStageDimensions();

            const defaults = settings.defaults && settings.defaults.text ? settings.defaults.text : null;
            if (defaults) {
                state.textDefaults = {
                    fontFamily: defaults.fontFamily || state.textDefaults.fontFamily,
                    fontSize: Number.isFinite(defaults.fontSize) ? defaults.fontSize : state.textDefaults.fontSize,
                    fontColor: defaults.fontColor || state.textDefaults.fontColor,
                    fontBold: defaults.fontWeight ? Number(defaults.fontWeight) >= 600 : state.textDefaults.fontBold
                };
            }
            syncTextControls(null);
        }

        function createElementWrapperFromModel(element, assetIdToPath) {
            if (!element) return null;
            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img';
            if (element.type === 'video') wrapper.classList.add('draggable-video');
            if (element.type === 'html' || element.type === 'embed') wrapper.classList.add('draggable-iframe');
            if (element.type === 'text') wrapper.classList.add('draggable-text');

            if (element.id) wrapper.dataset.elementId = element.id;
            wrapper.style.left = `${Number.isFinite(element.x) ? element.x : 0}px`;
            wrapper.style.top = `${Number.isFinite(element.y) ? element.y : 0}px`;
            wrapper.style.width = `${Number.isFinite(element.width) ? element.width : 320}px`;
            wrapper.style.height = `${Number.isFinite(element.height) ? element.height : 180}px`;

            if (element.type === 'image') {
                const img = document.createElement('img');
                let src = '';
                if (element.source && element.source.kind === 'asset' && element.source.assetId) {
                    const assetPath = assetIdToPath.get(element.source.assetId) || '';
                    if (assetPath) {
                        src = getAssetUrlByPath(assetPath);
                        img.dataset.assetPath = assetPath;
                    }
                } else if (element.source && element.source.kind === 'url' && element.source.url) {
                    src = element.source.url;
                }
                img.src = src;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.display = 'block';
                img.ondragstart = () => false;
                wrapper.appendChild(img);
                const handles = createMediaResizeHandles();
                handles.forEach((item) => wrapper.appendChild(item));
                setupInteraction(wrapper, handles);
                return wrapper;
            } else if (element.type === 'video') {
                const video = document.createElement('video');
                let src = '';
                if (element.source && element.source.kind === 'asset' && element.source.assetId) {
                    const assetPath = assetIdToPath.get(element.source.assetId) || '';
                    if (assetPath) {
                        src = getAssetUrlByPath(assetPath);
                        video.dataset.assetPath = assetPath;
                    }
                } else if (element.source && element.source.kind === 'url' && element.source.url) {
                    src = element.source.url;
                }
                video.src = src;
                video.controls = element.controls !== false;
                video.autoplay = element.autoplay === true;
                video.muted = element.muted === true;
                video.playsInline = true;
                video.preload = 'metadata';
                wrapper.appendChild(video);
                const handles = createMediaResizeHandles();
                handles.forEach((item) => wrapper.appendChild(item));
                setupInteraction(wrapper, handles);
                return wrapper;
            } else if (element.type === 'html' || element.type === 'embed') {
                const iframe = document.createElement('iframe');
                let src = '';
                if (element.type === 'html' && element.source && element.source.kind === 'asset' && element.source.assetId) {
                    const assetPath = assetIdToPath.get(element.source.assetId) || '';
                    if (assetPath) {
                        src = getAssetUrlByPath(assetPath);
                        iframe.dataset.filename = assetPath;
                    }
                } else if (element.type === 'embed' && element.embedUrl) {
                    src = element.embedUrl;
                }
                iframe.src = src;
                iframe.allowFullscreen = true;
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');

                if (element.type === 'embed') {
                    wrapper.dataset.elementType = 'embed';
                    wrapper.dataset.embedProvider = element.provider || '';
                    wrapper.dataset.externalUrl = element.url || '';
                    wrapper.dataset.embedUrl = element.embedUrl || '';
                }

                const handles = createIframeResizeHandles();
                wrapper.appendChild(iframe);
                handles.forEach((item) => wrapper.appendChild(item));

                if (element.fov) {
                    applyIframeView(wrapper, element.fov.scale || 1, element.fov.offsetX || 0, element.fov.offsetY || 0);
                }

                ensureIframeControls(wrapper);
                setupInteraction(wrapper, handles);
                return wrapper;
            } else if (element.type === 'text') {
                const textBox = document.createElement('div');
                textBox.className = 'text-box';
                textBox.dataset.placeholder = '텍스트 입력';
                textBox.textContent = element.text || '';
                textBox.setAttribute('contenteditable', 'false');
                textBox.setAttribute('spellcheck', 'false');
                if (element.style) {
                    if (element.style.fontFamily) textBox.style.fontFamily = element.style.fontFamily;
                    if (Number.isFinite(element.style.fontSize)) textBox.style.fontSize = `${element.style.fontSize}px`;
                    if (element.style.fontColor) textBox.style.color = element.style.fontColor;
                    if (element.style.fontWeight) textBox.style.fontWeight = String(element.style.fontWeight);
                }
                wrapper.appendChild(textBox);
                const handle = createResizeHandle('corner');
                wrapper.appendChild(handle);
                setupInteraction(wrapper, handle);
                initializeTextBox(wrapper);
                return wrapper;
            }
            return wrapper;
        }

        function renderDocumentFromModel(content, settings, manifest) {
            state.isRendering = true;
            setModelsFromLoad(content || {}, settings || {}, manifest || null);
            try {
                clearAssetObjectUrls();
                if (dom.stage) dom.stage.innerHTML = '';
                if (!content || !Array.isArray(content.slides)) return;

                const assetIdToPath = new Map();
                if (manifest && Array.isArray(manifest.assets)) {
                    manifest.assets.forEach((asset) => {
                        if (asset && asset.id && asset.path) {
                            assetIdToPath.set(asset.id, asset.path);
                        }
                    });
                }

                applySettingsFromModel(settings);

                content.slides.forEach((slide, index) => {
                    const slideEl = document.createElement('div');
                    slideEl.className = 'slide';
                    if (index === 0) slideEl.classList.add('active');
                    if (slide && slide.id) slideEl.dataset.slideId = slide.id;
                    (slide.elements || []).forEach((element) => {
                        const wrapper = createElementWrapperFromModel(element, assetIdToPath);
                        if (wrapper) slideEl.appendChild(wrapper);
                    });
                    dom.stage.appendChild(slideEl);
                });

                state.currentSlideIndex = 0;
                updateSlideVisibility();
                renderThumbnails();
                initializeIframeControls();
                resizeStage();
            } finally {
                state.isRendering = false;
            }
        }
