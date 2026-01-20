        function uniquePath(path) {
            const safePath = sanitizePath(path);
            const fallback = `file_${String(state.fileCounter++).padStart(3, '0')}`;
            const { dir, base, ext } = splitPath(safePath || fallback);
            let candidate = `${dir}${base}${ext}`;
            let index = 1;
            while (state.packageFiles.has(candidate)) {
                candidate = `${dir}${base}-${index}${ext}`;
                index += 1;
            }
            return candidate;
        }

        function extractRequiredAssetsFromHtml(htmlText) {
            const assets = new Set();
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');

            doc.querySelectorAll('[src]').forEach((el) => {
                const normalized = normalizeAssetPath(el.getAttribute('src'));
                if (normalized) assets.add(normalized);
                if (el.hasAttribute('srcset')) {
                    extractSrcsetPaths(el.getAttribute('srcset'), assets);
                }
            });

            doc.querySelectorAll('link[href]').forEach((el) => {
                const normalized = normalizeAssetPath(el.getAttribute('href'));
                if (normalized) assets.add(normalized);
            });

            doc.querySelectorAll('source[srcset]').forEach((el) => {
                extractSrcsetPaths(el.getAttribute('srcset'), assets);
            });

            return assets;
        }

        function registerRequiredAssetsFromHtml(htmlText) {
            extractRequiredAssetsFromHtml(htmlText).forEach(asset => state.requiredAssets.add(asset));
        }

        function matchRequiredAssetPath(fileName) {
            if (!fileName) return null;
            const matches = [];
            state.requiredAssets.forEach((asset) => {
                if (asset.split('/').pop() === fileName && !state.packageFiles.has(asset)) matches.push(asset);
            });
            return matches.length === 1 ? matches[0] : null;
        }

        function resetAssetRegistry() {
            state.assetIndex.clear();
            state.assetPathToId.clear();
            clearAssetObjectUrls();
        }

        function ensureAssetRecordForPath(assetPath, blob, originalName) {
            if (!assetPath) return '';
            const existingId = state.assetPathToId.get(assetPath);
            if (existingId) {
                const record = state.assetIndex.get(existingId);
                if (record) {
                    const mime = blob && blob.type ? blob.type : record.mime || guessMimeType(assetPath);
                    const bytes = blob ? blob.size : record.bytes || 0;
                    state.assetIndex.set(existingId, {
                        ...record,
                        path: assetPath,
                        mime,
                        bytes,
                        originalName: originalName || record.originalName || assetPath.split('/').pop() || assetPath
                    });
                }
                return existingId;
            }

            const assetId = generateAssetId();
            const mime = blob && blob.type ? blob.type : guessMimeType(assetPath);
            const bytes = blob ? blob.size : 0;
            const record = {
                id: assetId,
                path: assetPath,
                mime,
                bytes,
                originalName: originalName || assetPath.split('/').pop() || assetPath
            };
            state.assetIndex.set(assetId, record);
            state.assetPathToId.set(assetPath, assetId);
            return assetId;
        }

        function getAssetIdByPath(assetPath) {
            return assetPath ? state.assetPathToId.get(assetPath) || '' : '';
        }

        function getAssetPathById(assetId) {
            if (!assetId) return '';
            const record = state.assetIndex.get(assetId);
            return record ? record.path : '';
        }

        function buildAssetIdMapping() {
            const assetIdByPath = new Map();
            const assets = [];
            const paths = Array.from(state.packageFiles.keys()).sort();
            paths.forEach((path) => {
                const blob = state.packageFiles.get(path);
                const assetId = ensureAssetRecordForPath(path, blob, path.split('/').pop());
                if (assetId) {
                    assetIdByPath.set(path, assetId);
                    const record = state.assetIndex.get(assetId);
                    if (record) assets.push({ ...record });
                }
            });
            return { assetIdByPath, assets };
        }

        function getAssetUrlByPath(assetPath) {
            if (!assetPath) return '';
            const cached = state.assetObjectUrls.get(assetPath);
            if (cached) return cached;
            const blob = state.packageFiles.get(assetPath);
            if (!blob) return '';
            const url = URL.createObjectURL(blob);
            state.assetObjectUrls.set(assetPath, url);
            return url;
        }

        function clearAssetObjectUrls() {
            state.assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
            state.assetObjectUrls.clear();
        }

        function registerImageAsset(blob, preferredName) {
            const extension = inferImageExtension(preferredName, blob.type || '');
            let baseName = sanitizeFileName(preferredName || '');
            if (!baseName) {
                baseName = `image_${String(state.imageCounter++).padStart(3, '0')}.${extension}`;
            } else if (!baseName.includes('.')) {
                baseName = `${baseName}.${extension}`;
            }
            const assetPath = uniquePath(`${CONFIG.IMAGE_DIR}/${baseName}`);
            state.packageFiles.set(assetPath, blob);
            ensureAssetRecordForPath(assetPath, blob, preferredName || baseName);
            return assetPath;
        }

        function registerVideoAsset(blob, preferredName) {
            const extension = inferVideoExtension(preferredName, blob.type || '');
            let baseName = sanitizeFileName(preferredName || '');
            if (!baseName) {
                baseName = `video_${String(state.videoCounter++).padStart(3, '0')}.${extension}`;
            } else if (!baseName.includes('.')) {
                baseName = `${baseName}.${extension}`;
            }
            const assetPath = uniquePath(`${CONFIG.IMAGE_DIR}/${baseName}`);
            state.packageFiles.set(assetPath, blob);
            ensureAssetRecordForPath(assetPath, blob, preferredName || baseName);
            return assetPath;
        }

        function registerSupportFile(file) {
            const fileName = sanitizeFileName(file.name || '');
            const relativePath = sanitizePath(file.webkitRelativePath || '');
            const matchedPath = relativePath ? null : matchRequiredAssetPath(fileName);
            const rawPath = matchedPath || relativePath || fileName;
            const unique = uniquePath(rawPath || `file_${String(state.fileCounter++).padStart(3, '0')}`);
            state.packageFiles.set(unique, file);
            ensureAssetRecordForPath(unique, file, fileName || unique);
            return unique;
        }

        function getMissingAssets() {
            const missing = new Set();
            state.requiredAssets.forEach((asset) => {
                if (!state.packageFiles.has(asset)) missing.add(asset);
            });
            if (state.documentModel) {
                state.documentModel.slides.forEach((slide) => {
                    (slide.elements || []).forEach((element) => {
                        if (!element || !element.source || element.source.kind !== 'asset') return;
                        const assetPath = getAssetPathById(element.source.assetId);
                        if (assetPath && !state.packageFiles.has(assetPath)) {
                            missing.add(assetPath);
                        }
                    });
                });
            }
            return Array.from(missing);
        }

        function isAssetIdUsedInModel(assetId) {
            if (!state.documentModel || !assetId) return false;
            return state.documentModel.slides.some((slide) => {
                return (slide.elements || []).some((element) => {
                    if (!element || !element.source || element.source.kind !== 'asset') return false;
                    return element.source.assetId === assetId;
                });
            });
        }

        function isAssetPathUsedInModel(assetPath) {
            const assetId = getAssetIdByPath(assetPath);
            return isAssetIdUsedInModel(assetId);
        }

        function removeImageAssetIfUnused(assetPath) {
            if (!assetPath) return;
            const stillUsed = state.documentModel
                ? isAssetPathUsedInModel(assetPath)
                : Array.from(document.querySelectorAll('img[data-asset-path], video[data-asset-path]'))
                    .some((media) => media.dataset.assetPath === assetPath);
            const usedByClipboard = state.clipboardImage && state.clipboardImage.assetPath === assetPath;
            if (!stillUsed && !usedByClipboard) {
                state.packageFiles.delete(assetPath);
                const assetId = state.assetPathToId.get(assetPath);
                if (assetId) {
                    state.assetIndex.delete(assetId);
                    state.assetPathToId.delete(assetPath);
                }
                const cachedUrl = state.assetObjectUrls.get(assetPath);
                if (cachedUrl) {
                    URL.revokeObjectURL(cachedUrl);
                    state.assetObjectUrls.delete(assetPath);
                }
            }
        }

        function removeHtmlAssetIfUnused(fileName) {
            if (!fileName) return;
            const stillUsed = state.documentModel
                ? isAssetPathUsedInModel(fileName)
                : Array.from(document.querySelectorAll('iframe'))
                    .some((iframe) => iframe.dataset.filename === fileName);
            if (!stillUsed) {
                state.packageFiles.delete(fileName);
                const assetId = state.assetPathToId.get(fileName);
                if (assetId) {
                    state.assetIndex.delete(assetId);
                    state.assetPathToId.delete(fileName);
                }
                const cachedUrl = state.assetObjectUrls.get(fileName);
                if (cachedUrl) {
                    URL.revokeObjectURL(cachedUrl);
                    state.assetObjectUrls.delete(fileName);
                }
            }
        }
