        function triggerPackageLoad() {
            if (!dom.packageInput) return;
            dom.packageInput.value = '';
            dom.packageInput.click();
        }

        function parseZipEntries(buffer) {
            const data = new Uint8Array(buffer);
            const view = new DataView(buffer);
            let eocdOffset = -1;

            for (let i = data.length - 22; i >= 0; i--) {
                if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
                    eocdOffset = i;
                    break;
                }
            }

            if (eocdOffset < 0) throw new Error('패키지 끝을 찾을 수 없습니다.');

            const centralDirSize = view.getUint32(eocdOffset + 12, true);
            const centralDirOffset = view.getUint32(eocdOffset + 16, true);
            const centralDirEnd = centralDirOffset + centralDirSize;
            let offset = centralDirOffset;
            const entries = [];

            while (offset < centralDirEnd) {
                if (view.getUint32(offset, true) !== 0x02014b50) break;
                const compression = view.getUint16(offset + 10, true);
                const nameLen = view.getUint16(offset + 28, true);
                const extraLen = view.getUint16(offset + 30, true);
                const commentLen = view.getUint16(offset + 32, true);
                const localHeaderOffset = view.getUint32(offset + 42, true);
                const nameBytes = data.slice(offset + 46, offset + 46 + nameLen);
                const name = textDecoder.decode(nameBytes);
                entries.push({ name, compression, localHeaderOffset });
                offset += 46 + nameLen + extraLen + commentLen;
            }

            const files = new Map();
            for (const entry of entries) {
                if (!entry.name || entry.name.endsWith('/')) continue;
                if (entry.compression !== 0) {
                    throw new Error('압축된 ZIP은 지원하지 않습니다.');
                }

                const localOffset = entry.localHeaderOffset;
                if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
                const nameLen = view.getUint16(localOffset + 26, true);
                const extraLen = view.getUint16(localOffset + 28, true);
                const dataOffset = localOffset + 30 + nameLen + extraLen;
                const dataSize = view.getUint32(localOffset + 18, true);
                const fileData = data.slice(dataOffset, dataOffset + dataSize);
                files.set(entry.name, fileData);
            }

            return files;
        }

        function findMainHtml(files) {
            const htmlEntries = [];
            for (const [name, data] of files.entries()) {
                if (name.toLowerCase().endsWith('.html') || name.toLowerCase().endsWith('.htm')) {
                    htmlEntries.push({ name, data });
                }
            }

            for (const entry of htmlEntries) {
                const text = textDecoder.decode(entry.data);
                const doc = new DOMParser().parseFromString(text, 'text/html');
                if (doc.querySelector('#slide-stage') && doc.querySelector('.slide')) {
                    return { name: entry.name, html: text };
                }
            }

            if (htmlEntries.length > 0) {
                const fallback = htmlEntries[0];
                return { name: fallback.name, html: textDecoder.decode(fallback.data) };
            }
            return null;
        }

        function parseJsonEntry(files, name) {
            if (!files.has(name)) return null;
            try {
                const text = textDecoder.decode(files.get(name));
                return JSON.parse(text);
            } catch (err) {
                return null;
            }
        }

        function syncIdCountersFromContent(content, manifest) {
            resetIdCounters();
            if (content && content.documentId) {
                state.documentId = content.documentId;
                const match = content.documentId.match(/^doc_(\d+)$/);
                if (match) {
                    state.documentCounter = Math.max(state.documentCounter, Number.parseInt(match[1], 10) + 1);
                }
            }
            if (content && Array.isArray(content.slides)) {
                content.slides.forEach((slide) => {
                    if (slide && slide.id) {
                        const match = String(slide.id).match(/^slide_(\d+)$/);
                        if (match) {
                            state.slideCounter = Math.max(state.slideCounter, Number.parseInt(match[1], 10) + 1);
                        }
                    }
                    (slide.elements || []).forEach((el) => {
                        if (el && el.id) {
                            const match = String(el.id).match(/^el_(\d+)$/);
                            if (match) {
                                state.elementCounter = Math.max(state.elementCounter, Number.parseInt(match[1], 10) + 1);
                            }
                        }
                    });
                });
            }
            if (manifest && Array.isArray(manifest.assets)) {
                manifest.assets.forEach((asset) => {
                    if (asset && asset.id) {
                        const match = String(asset.id).match(/^asset_(\d+)$/);
                        if (match) {
                            state.assetCounter = Math.max(state.assetCounter, Number.parseInt(match[1], 10) + 1);
                        }
                    }
                });
            }
        }

        async function loadV2Package(files, file) {
            const manifest = parseJsonEntry(files, 'manifest.json');
            const manifestErrors = validateManifest(manifest || {});
            if (manifestErrors.length > 0) {
                alert(`manifest.json 오류:\n${manifestErrors.join('\n')}`);
                return;
            }

            const contentName = manifest.entry && manifest.entry.content ? manifest.entry.content : 'content.json';
            const settingsName = manifest.entry && manifest.entry.settings ? manifest.entry.settings : 'settings.json';

            const content = parseJsonEntry(files, contentName);
            const settings = parseJsonEntry(files, settingsName);
            const contentErrors = validateContent(content || {});
            const settingsErrors = validateSettings(settings || {});
            if (contentErrors.length > 0 || settingsErrors.length > 0) {
                const errors = contentErrors.concat(settingsErrors);
                alert(`패키지 내용 오류:\n${errors.join('\n')}`);
                return;
            }

            state.packageFiles.clear();
            state.requiredAssets.clear();
            state.clipboardImage = null;
            state.selectedImage = null;
            state.textEditingElement = null;
            state.imageCounter = 1;
            state.videoCounter = 1;
            state.fileCounter = 1;
            state.lastSaveHandle = null;
            state.lastPackageFileName = ensurePackageExtension(file.name || '');
            state.documentCreatedAt = manifest.createdAt || new Date().toISOString();
            state.legacySource = manifest.legacy || null;
            resetAssetRegistry();

            for (const [name, data] of files.entries()) {
                if (name === 'manifest.json' || name === contentName || name === settingsName) continue;
                const blob = new Blob([data], { type: guessMimeType(name) });
                state.packageFiles.set(name, blob);
            }

            if (Array.isArray(manifest.assets)) {
                manifest.assets.forEach((asset) => {
                    if (!asset || !asset.id || !asset.path) return;
                    const blob = state.packageFiles.get(asset.path);
                    const mime = asset.mime || (blob && blob.type) || guessMimeType(asset.path);
                    const bytes = blob ? blob.size : (Number.isFinite(asset.bytes) ? asset.bytes : 0);
                    const record = {
                        id: asset.id,
                        path: asset.path,
                        mime,
                        bytes,
                        originalName: asset.originalName || asset.path.split('/').pop() || asset.path
                    };
                    state.assetIndex.set(asset.id, record);
                    state.assetPathToId.set(asset.path, asset.id);
                });
            }

            for (const [path, blob] of state.packageFiles.entries()) {
                if (path.toLowerCase().endsWith('.html') || path.toLowerCase().endsWith('.htm')) {
                    try {
                        const text = await blob.text();
                        registerRequiredAssetsFromHtml(text);
                    } catch (err) { }
                }
            }

            state.packageFiles.forEach((blob, path) => {
                ensureAssetRecordForPath(path, blob, path.split('/').pop());
            });

            syncIdCountersFromContent(content, manifest);
            renderDocumentFromModel(content, settings, manifest);
            showSaveButton();
        }

        async function loadPackageFromFile(file, options = {}) {
            if (!file) return;
            const skipConfirm = options && options.skipConfirm === true;
            if (!skipConfirm) {
                const proceed = confirm("현재 작업을 덮어쓰고 패키지를 불러올까요?");
                if (!proceed) return;
            }

            let files;
            try {
                const buffer = await file.arrayBuffer();
                files = parseZipEntries(buffer);
            } catch (err) {
                alert(`패키지를 불러오지 못했습니다.\n${err.message}`);
                return;
            }

            if (files.has('manifest.json')) {
                await loadV2Package(files, file);
                return;
            }

            const main = findMainHtml(files);
            if (!main) {
                alert("프레젠테이션 HTML을 찾지 못했습니다.");
                return;
            }

            state.packageFiles.clear();
            state.requiredAssets.clear();
            state.clipboardImage = null;
            state.selectedImage = null;
            state.textEditingElement = null;
            state.imageCounter = 1;
            state.videoCounter = 1;
            state.fileCounter = 1;
            state.lastSaveHandle = null;
            state.lastPackageFileName = ensurePackageExtension(file.name || '');
            state.documentCreatedAt = new Date().toISOString();
            state.legacySource = { source: 'html', entry: main.name };
            state.documentId = '';
            resetIdCounters();
            resetAssetRegistry();
            const embeddedImageCache = new Map();
            let legacyConvertedCount = 0;

            for (const [name, data] of files.entries()) {
                if (name === main.name) continue;
                const blob = new Blob([data], { type: guessMimeType(name) });

                if (name.toLowerCase().endsWith('.html') || name.toLowerCase().endsWith('.htm')) {
                    try {
                        const text = await blob.text();
                        const converted = convertBase64ImagesInHtml(text, embeddedImageCache);
                        if (converted.converted > 0) {
                            legacyConvertedCount += converted.converted;
                            state.packageFiles.set(name, new Blob([converted.html], { type: 'text/html' }));
                            registerRequiredAssetsFromHtml(converted.html);
                        } else {
                            state.packageFiles.set(name, blob);
                            registerRequiredAssetsFromHtml(text);
                        }
                    } catch (err) {
                        state.packageFiles.set(name, blob);
                    }
                } else {
                    state.packageFiles.set(name, blob);
                }
                ensureAssetRecordForPath(name, blob, name.split('/').pop());
            }

            const parsedDoc = new DOMParser().parseFromString(main.html, 'text/html');
            legacyConvertedCount += convertEmbeddedImagesInDocument(parsedDoc, embeddedImageCache);
            const updatedMainHtml = parsedDoc.documentElement.outerHTML;
            registerRequiredAssetsFromHtml(updatedMainHtml);
            const parsedStage = parsedDoc.querySelector('#slide-stage');
            if (!parsedStage) {
                alert("슬라이드 데이터를 찾지 못했습니다.");
                return;
            }

            const loadedWidth = parseInt(parsedStage.style.width) || 1280;
            if (loadedWidth < 1100) {
                state.aspectRatio = '4:3';
            } else {
                state.aspectRatio = '16:9';
            }
            updateStageDimensions();

            const parsedTitle = (parsedDoc.title || '').trim();
            const mainTitle = stripExtensionFromName(main.name, 'html');
            const fallbackTitle = stripExtensionFromName(file.name, CONFIG.PACKAGE_EXTENSION);
            document.title = parsedTitle || mainTitle || fallbackTitle || document.title;
            state.documentTitle = document.title || state.documentTitle;

            const stage = dom.stage;
            stage.innerHTML = '';
            const parsedSlides = parsedStage.querySelectorAll('.slide');
            parsedSlides.forEach((slide, index) => {
                const newSlide = document.createElement('div');
                newSlide.className = 'slide';
                if (slide.classList.contains('iframe-slide')) newSlide.classList.add('iframe-slide');
                if (index === 0) newSlide.classList.add('active');
                newSlide.innerHTML = slide.innerHTML;
                stage.appendChild(newSlide);
            });

            const slides = refreshSlides();
            slides.forEach((slide) => {
                slide.querySelectorAll('.draggable-img').forEach((wrapper) => {
                    wrapper.classList.remove('selected');
                    wrapper.classList.remove('iframe-interactive');
                    let handle = wrapper.querySelector('.resize-handle');
                    if (!handle) {
                        handle = document.createElement('div');
                        handle.className = 'resize-handle';
                        wrapper.appendChild(handle);
                    }
                    setupInteraction(wrapper, handle);
                    if (wrapper.classList.contains('draggable-text')) {
                        initializeTextBox(wrapper);
                    }

                    const img = wrapper.querySelector('img');
                    if (!img) return;
                    const assetPath = normalizeAssetPath(img.getAttribute('src'));
                    if (!assetPath || !state.packageFiles.has(assetPath)) return;
                    const url = getAssetUrlByPath(assetPath);
                    img.src = url;
                    img.dataset.assetPath = assetPath;
                });

                slide.querySelectorAll('iframe').forEach((iframe) => {
                    const srcPath = normalizeAssetPath(iframe.getAttribute('src')) || iframe.dataset.filename;
                    if (!srcPath || !state.packageFiles.has(srcPath)) return;
                    const url = getAssetUrlByPath(srcPath);
                    iframe.dataset.filename = srcPath;
                    iframe.src = url;
                    const wrapper = iframe.closest('.draggable-iframe');
                    if (wrapper) ensureIframeControls(wrapper);
                });

                slide.querySelectorAll('video').forEach((video) => {
                    const srcPath = normalizeAssetPath(video.getAttribute('src')) || video.dataset.assetPath;
                    if (!srcPath || !state.packageFiles.has(srcPath)) return;
                    const url = getAssetUrlByPath(srcPath);
                    video.dataset.assetPath = srcPath;
                    video.src = url;
                    video.controls = true;
                    video.playsInline = true;
                });
            });

            state.currentSlideIndex = 0;
            updateSlideVisibility();
            renderThumbnails();
            initializeIframeControls();
            syncModelsFromDom();
            showSaveButton();
            resizeStage();

            if (legacyConvertedCount > 0) {
                alert(`레거시 base64 이미지 ${legacyConvertedCount}개를 에셋으로 변환했습니다.\n저장하면 최신 패키지로 정리됩니다.`);
            }
        }
