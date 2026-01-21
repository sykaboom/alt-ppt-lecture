        function bindEvents() {
            if (dom.navPrev) dom.navPrev.addEventListener('click', prevSlide);
            if (dom.navNext) dom.navNext.addEventListener('click', nextSlide);
            if (dom.ratioBtn) dom.ratioBtn.addEventListener('click', toggleAspectRatio);
            if (dom.fitBtn) dom.fitBtn.addEventListener('click', toggleDisplayMode);
            if (dom.invertBtn) dom.invertBtn.addEventListener('click', toggleInvertMode);
            if (dom.fsBtn) dom.fsBtn.addEventListener('click', startPresentation);
            if (dom.addSlideBtn) dom.addSlideBtn.addEventListener('click', addNewSlide);
            if (dom.addTextBtn) dom.addTextBtn.addEventListener('click', createDraggableTextBox);
            if (dom.fontBoldBtn) dom.fontBoldBtn.addEventListener('click', toggleTextBold);
            if (dom.deleteSlideBtn) dom.deleteSlideBtn.addEventListener('click', deleteCurrentSlide);
            if (dom.deleteElementBtn) dom.deleteElementBtn.addEventListener('click', deleteSelectedImage);
            if (dom.openPackageBtn) dom.openPackageBtn.addEventListener('click', triggerPackageLoad);
            if (dom.saveBtn) dom.saveBtn.addEventListener('click', savePackage);
            if (dom.saveAsBtn) dom.saveAsBtn.addEventListener('click', savePackageAs);

            const handleTextControlChange = () => applyTextControlsToSelection();
            if (dom.fontFamilySelect) dom.fontFamilySelect.addEventListener('change', handleTextControlChange);
            if (dom.fontSizeInput) {
                dom.fontSizeInput.addEventListener('input', handleTextControlChange);
                dom.fontSizeInput.addEventListener('change', handleTextControlChange);
            }
            if (dom.fontColorInput) dom.fontColorInput.addEventListener('input', handleTextControlChange);

            window.addEventListener('resize', resizeStage);

            window.addEventListener('wheel', (e) => {
                if (dom.thumbnailStrip && dom.thumbnailStrip.contains(e.target)) return;
                const iframeWrapper = e.target.closest('.draggable-iframe');
                if (iframeWrapper) {
                    if (iframeWrapper.classList.contains('iframe-interactive')) return;
                    const metrics = getWrapperMetrics(iframeWrapper);
                    const anchor = {
                        x: (e.clientX - metrics.rect.left) / metrics.scaleX,
                        y: (e.clientY - metrics.rect.top) / metrics.scaleY
                    };
                    const current = getIframeViewState(iframeWrapper);
                    const zoomFactor = Math.exp(-e.deltaY * 0.001);
                    const nextScale = current.viewScale / zoomFactor;
                    zoomIframeView(iframeWrapper, nextScale, anchor);
                    e.preventDefault();
                    return;
                }
                if (e.target.closest('.draggable-video')) return;
                if (isTextEditingActive(e.target)) return;
                if (e.deltaY > 0) nextSlide(); else prevSlide();
            }, { passive: false });

            if (dom.thumbnailStrip) {
                dom.thumbnailStrip.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    dom.thumbnailStrip.scrollLeft += (e.deltaY + e.deltaX);
                }, { passive: false });

                dom.thumbnailStrip.addEventListener('contextmenu', (e) => {
                    const thumb = e.target.closest('.thumbnail');
                    if (!thumb) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const index = Number.parseInt(thumb.dataset.index, 10);
                    if (Number.isFinite(index)) requestDeleteSlide(index);
                });
            }

            window.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (e.target.closest('.draggable-iframe')) return;
                if (e.target.closest('.draggable-video')) return;
                if (document.body.classList.contains('is-fullscreen')) {
                    if (state.currentSlideIndex === 0) return;
                    prevSlide();
                } else {
                    nextSlide();
                }
            });

            window.addEventListener('click', (e) => {
                if (!document.body.classList.contains('is-fullscreen')) return;
                if (e.target.closest('button') || e.target.closest('.nav-zone')) return;
                if (e.target.closest('.draggable-iframe')) return;
                if (e.target.closest('.draggable-video')) return;

                const slides = refreshSlides();
                if (state.currentSlideIndex >= slides.length - 1) {
                    exitPresentation();
                    state.currentSlideIndex = 0;
                    updateSlideVisibility();
                } else {
                    nextSlide();
                }
            });

            window.addEventListener('keydown', (e) => {
                const isModKey = e.ctrlKey || e.metaKey;
                const key = e.key.toLowerCase();
                const isTextEditing = isTextEditingActive(e.target);

                if (isTextEditing) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        exitTextEditing();
                    }
                    return;
                }

                const isFormField = e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
                if (isFormField) return;

                if (e.code === 'Space' || e.key === ' ') {
                    if (!state.isSpacePressed) {
                        state.isSpacePressed = true;
                        document.body.classList.add('pan-mode');
                    }
                    e.preventDefault();
                    return;
                }

                const canCopyImage = state.selectedImage && state.selectedImage.querySelector('img[data-asset-path]');
                if (isModKey && key === 'c' && canCopyImage) {
                    e.preventDefault();
                    copySelectedImage();
                    return;
                }

                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide();
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevSlide();
                if (e.key === 'Delete' && state.selectedImage) deleteSelectedImage();
            });

            window.addEventListener('keyup', (e) => {
                if (e.code === 'Space' || e.key === ' ') {
                    state.isSpacePressed = false;
                    document.body.classList.remove('pan-mode');
                    document.body.classList.remove('is-panning');
                    state.activeIframePan = null;
                }
            });

            if (dom.packageInput) {
                dom.packageInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) loadPackageFromFile(file);
                });
            }

            const stage = dom.stage;
            stage.addEventListener('dragenter', (e) => {
                e.preventDefault();
                stage.classList.add('drag-over');
            });

            stage.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            stage.addEventListener('dragleave', (e) => {
                if (!stage.contains(e.relatedTarget)) stage.classList.remove('drag-over');
            });

            stage.addEventListener('drop', (e) => {
                e.preventDefault();
                stage.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleDroppedFiles(files, { supportOnly: e.shiftKey || e.altKey });
                    return;
                }
                const urlText = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                const url = parseUrlCandidate(urlText);
                if (url && isVideoUrl(url)) {
                    createDraggableVideoFromUrl(url);
                    return;
                }
                const youtubeEmbed = url ? getYouTubeEmbedUrl(url) : null;
                if (youtubeEmbed) {
                    createDraggableIframeFromUrl(youtubeEmbed, { label: 'YouTube', title: 'YouTube video', provider: 'youtube', sourceUrl: url });
                }
            });

            document.addEventListener('dragover', (e) => { e.preventDefault(); });
            document.addEventListener('drop', (e) => {
                if (!stage.contains(e.target)) e.preventDefault();
                stage.classList.remove('drag-over');
            });

            window.addEventListener('paste', async (e) => {
                if (isTextEditingActive(e.target)) return;
                const isFormField = e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
                if (isFormField) return;
                const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
                if (!clipboardData) return;
                const items = Array.from(clipboardData.items || []);

                const imageItems = items.filter((item) => item.type && item.type.startsWith('image/'));
                if (imageItems.length > 0) {
                    e.preventDefault();
                    if (imageItems.length === 1 && state.clipboardImage) {
                        const blob = imageItems[0].getAsFile();
                        if (blob && await doesClipboardImageMatchInternal(blob)) {
                            pasteClipboardImage();
                            return;
                        }
                    }
                    imageItems.forEach((item) => {
                        const blob = item.getAsFile();
                        if (blob) createDraggableImageFromBlob(blob);
                    });
                    if (state.clipboardImage) {
                        clearClipboardImage();
                    }
                    return;
                }

                const textItems = items.filter((item) => item.type === 'text/plain' || item.type === 'text/uri-list');
                if (textItems.length > 0) {
                    e.preventDefault();
                    let pending = textItems.length;
                    let textHandled = false;

                    textItems.forEach((item) => {
                        item.getAsString((text) => {
                            const url = parseUrlCandidate(text);
                            if (url && isVideoUrl(url)) {
                                createDraggableVideoFromUrl(url);
                                textHandled = true;
                            } else {
                                const youtubeEmbed = url ? getYouTubeEmbedUrl(url) : null;
                                if (youtubeEmbed) {
                                    createDraggableIframeFromUrl(youtubeEmbed, { label: 'YouTube', title: 'YouTube video', provider: 'youtube', sourceUrl: url });
                                    textHandled = true;
                                }
                            }

                            pending -= 1;
                            if (pending === 0 && !textHandled && state.clipboardImage) {
                                pasteClipboardImage();
                            }
                        });
                    });
                    return;
                }

                if (state.clipboardImage) {
                    e.preventDefault();
                    pasteClipboardImage();
                }
            });

            document.addEventListener('mousedown', (e) => {
                if (state.textEditingElement) {
                    const editingBox = getTextBox(state.textEditingElement);
                    if (editingBox && !editingBox.contains(e.target)) exitTextEditing();
                }
                if (!e.target.closest('.draggable-img') && !e.target.closest('button') && !e.target.closest('.nav-zone') && !e.target.closest('.text-controls')) {
                    deselectImage();
                }
            });

            document.addEventListener('mousedown', (e) => {
                if (!state.isSpacePressed) return;
                if (e.button !== 0) return;
                const wrapper = e.target.closest('.draggable-iframe');
                if (!wrapper) return;
                if (wrapper.classList.contains('iframe-interactive')) return;
                if (e.target.closest('.iframe-controls')) return;
                e.preventDefault();
                e.stopPropagation();
                const current = getIframeViewState(wrapper);
                const metrics = getWrapperMetrics(wrapper);
                state.activeIframePan = {
                    wrapper,
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: current.offsetX,
                    originY: current.offsetY,
                    viewScale: current.viewScale,
                    scaleX: metrics.scaleX,
                    scaleY: metrics.scaleY
                };
                document.body.classList.add('is-panning');
            });

            document.addEventListener('mousemove', (e) => {
                if (!state.activeIframePan) return;
                const pan = state.activeIframePan;
                const dx = (e.clientX - pan.startX) / pan.scaleX;
                const dy = (e.clientY - pan.startY) / pan.scaleY;
                const nextX = pan.originX + dx;
                const nextY = pan.originY + dy;
                applyIframeView(pan.wrapper, pan.viewScale, nextX, nextY);
            });

            document.addEventListener('mouseup', () => {
                if (!state.activeIframePan) return;
                state.activeIframePan = null;
                document.body.classList.remove('is-panning');
                showSaveButton();
            });
        }

        function handleDroppedFiles(files, options = {}) {
            const supportOnly = options.supportOnly === true;
            let addedSupport = false;

            for (const file of files) {
                const fileName = file.name.toLowerCase();
                if (!supportOnly) {
                    if (file.type.startsWith('image/')) {
                        createDraggableImageFromBlob(file, file.name);
                    } else if (file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(fileName)) {
                        createDraggableVideoFromBlob(file, file.name);
                    } else if (fileName.endsWith('.html') || fileName.endsWith('.htm') || file.type === 'text/html') {
                        transformCurrentSlideToHtml(file);
                    } else {
                        registerSupportFile(file);
                        addedSupport = true;
                    }
                } else {
                    registerSupportFile(file);
                    addedSupport = true;
                }
            }

            if (addedSupport) showSaveButton();
        }

        function transformCurrentSlideToHtml(fileOrName) {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            removeGuideText(activeSlide);

            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-img draggable-iframe selected';
            ensureElementId(wrapper);
            const layout = getDefaultIframeLayout();
            wrapper.style.left = `${layout.left}px`;
            wrapper.style.top = `${layout.top}px`;
            wrapper.style.width = `${layout.width}px`;
            wrapper.style.height = `${layout.height}px`;

            const iframe = document.createElement('iframe');
            let displayName = "";

            if (fileOrName instanceof File) {
                let baseName = sanitizeFileName(fileOrName.name || '');
                if (baseName && !baseName.includes('.')) baseName = `${baseName}.html`;
                const fallbackName = `slide_${String(state.fileCounter++).padStart(3, '0')}.html`;
                const fileName = uniquePath(baseName || fallbackName);

                state.packageFiles.set(fileName, fileOrName);
                iframe.dataset.filename = fileName;
                displayName = fileName;

                const objectUrl = URL.createObjectURL(fileOrName);
                iframe.src = objectUrl;
                iframe.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });

                fileOrName.text()
                    .then(text => registerRequiredAssetsFromHtml(text))
                    .catch(() => { });
            } else {
                iframe.src = './' + fileOrName;
                displayName = fileOrName;
                iframe.dataset.filename = fileOrName;
            }

            const handles = createIframeResizeHandles();

            wrapper.appendChild(iframe);
            handles.forEach((handle) => wrapper.appendChild(handle));
            activeSlide.appendChild(wrapper);

            ensureIframeControls(wrapper);
            setupInteraction(wrapper, handles);
            selectImage(wrapper);
            syncElementModelFromWrapper(wrapper);
            showSaveButton();
        }
