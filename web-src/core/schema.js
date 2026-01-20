        function isPlainObject(value) {
            return value && typeof value === 'object' && !Array.isArray(value);
        }

        function isFiniteNumber(value) {
            return Number.isFinite(value);
        }

        function validateManifest(manifest) {
            const errors = [];
            if (!isPlainObject(manifest)) {
                errors.push('manifest.notObject');
                return errors;
            }
            if (manifest.format !== 'altppt') errors.push('manifest.format');
            if (manifest.version !== '2.0') errors.push('manifest.version');
            if (!isPlainObject(manifest.entry)) errors.push('manifest.entry');
            if (!manifest.entry || !manifest.entry.content) errors.push('manifest.entry.content');
            if (!manifest.entry || !manifest.entry.settings) errors.push('manifest.entry.settings');
            if (manifest.assets && !Array.isArray(manifest.assets)) errors.push('manifest.assets');
            if (Array.isArray(manifest.assets)) {
                const ids = new Set();
                manifest.assets.forEach((asset, index) => {
                    if (!isPlainObject(asset)) {
                        errors.push(`manifest.assets.${index}.notObject`);
                        return;
                    }
                    if (!asset.id) errors.push(`manifest.assets.${index}.id`);
                    if (!asset.path) errors.push(`manifest.assets.${index}.path`);
                    if (asset.id) {
                        if (ids.has(asset.id)) errors.push(`manifest.assets.${index}.id.duplicate`);
                        ids.add(asset.id);
                    }
                });
            }
            return errors;
        }

        function validateContent(content) {
            const errors = [];
            if (!isPlainObject(content)) {
                errors.push('content.notObject');
                return errors;
            }
            if (!content.documentId) errors.push('content.documentId');
            if (!Array.isArray(content.slides)) errors.push('content.slides');
            (content.slides || []).forEach((slide, index) => {
                if (!isPlainObject(slide)) {
                    errors.push(`content.slides.${index}.notObject`);
                    return;
                }
                if (!slide.id) errors.push(`content.slides.${index}.id`);
                if (!Array.isArray(slide.elements)) errors.push(`content.slides.${index}.elements`);
                (slide.elements || []).forEach((el, elIndex) => {
                    if (!isPlainObject(el)) {
                        errors.push(`content.slides.${index}.elements.${elIndex}.notObject`);
                        return;
                    }
                    if (!el.id) errors.push(`content.slides.${index}.elements.${elIndex}.id`);
                    if (!el.type) errors.push(`content.slides.${index}.elements.${elIndex}.type`);
                    ['x', 'y', 'width', 'height'].forEach((key) => {
                        if (el[key] !== undefined && !isFiniteNumber(el[key])) {
                            errors.push(`content.slides.${index}.elements.${elIndex}.${key}`);
                        }
                    });
                });
            });
            return errors;
        }

        function validateSettings(settings) {
            const errors = [];
            if (!isPlainObject(settings)) {
                errors.push('settings.notObject');
                return errors;
            }
            if (!isPlainObject(settings.document)) errors.push('settings.document');
            if (settings.document) {
                const ratio = settings.document.aspectRatio;
                if (ratio && ratio !== '16:9' && ratio !== '4:3') {
                    errors.push('settings.document.aspectRatio');
                }
                if (settings.document.stage) {
                    if (!isFiniteNumber(settings.document.stage.width)) errors.push('settings.document.stage.width');
                    if (!isFiniteNumber(settings.document.stage.height)) errors.push('settings.document.stage.height');
                }
            }
            if (settings.defaults && settings.defaults.text) {
                const text = settings.defaults.text;
                if (text.fontSize !== undefined && !isFiniteNumber(text.fontSize)) errors.push('settings.defaults.text.fontSize');
            }
            return errors;
        }
