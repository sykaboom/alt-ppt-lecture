        function isPlainObjectValue(value) {
            return value && typeof value === 'object' && !Array.isArray(value);
        }

        function cloneJson(value) {
            if (value === undefined || value === null) return value;
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (err) {
                return value;
            }
        }

        function normalizeContentModel(content) {
            const model = isPlainObjectValue(content) ? content : {};
            if (!model.documentId) model.documentId = ensureDocumentId();
            if (!Array.isArray(model.slides)) model.slides = [];
            model.slides = model.slides.map((slide) => {
                const slideModel = isPlainObjectValue(slide) ? slide : {};
                if (!slideModel.id) slideModel.id = generateId('slide', 'slideCounter');
                if (!Array.isArray(slideModel.elements)) slideModel.elements = [];
                slideModel.elements = slideModel.elements
                    .map((el) => {
                        const elementModel = isPlainObjectValue(el) ? el : null;
                        if (!elementModel) return null;
                        if (!elementModel.id) elementModel.id = generateId('el', 'elementCounter');
                        return elementModel;
                    })
                    .filter(Boolean);
                return slideModel;
            });
            return model;
        }

        function normalizeSettingsModel(settings) {
            const model = isPlainObjectValue(settings) ? settings : {};
            if (!isPlainObjectValue(model.document)) model.document = {};
            if (!isPlainObjectValue(model.document.stage)) model.document.stage = {};
            if (!isPlainObjectValue(model.defaults)) model.defaults = {};
            if (!isPlainObjectValue(model.defaults.text)) model.defaults.text = {};

            if (!model.document.title) {
                model.document.title = state.documentTitle || 'Presentation';
            }
            if (!model.document.aspectRatio) {
                model.document.aspectRatio = state.aspectRatio;
            }
            if (!Number.isFinite(model.document.stage.width)) {
                model.document.stage.width = state.currentStageWidth;
            }
            if (!Number.isFinite(model.document.stage.height)) {
                model.document.stage.height = state.currentStageHeight;
            }

            const defaults = model.defaults.text;
            if (!defaults.fontFamily) defaults.fontFamily = state.textDefaults.fontFamily;
            if (!Number.isFinite(defaults.fontSize)) defaults.fontSize = state.textDefaults.fontSize;
            if (!defaults.fontColor) defaults.fontColor = state.textDefaults.fontColor;
            if (!Number.isFinite(defaults.fontWeight)) {
                defaults.fontWeight = state.textDefaults.fontBold ? 700 : 400;
            }

            return model;
        }

        function setModelsFromLoad(content, settings, manifest) {
            state.documentModel = normalizeContentModel(cloneJson(content) || {});
            state.settingsModel = normalizeSettingsModel(cloneJson(settings) || {});
            state.manifestModel = manifest ? cloneJson(manifest) : null;
        }

        function ensureModelsReady() {
            if (!state.documentModel) {
                state.documentModel = normalizeContentModel({});
            }
            if (!state.settingsModel) {
                state.settingsModel = normalizeSettingsModel({});
            }
            return { content: state.documentModel, settings: state.settingsModel };
        }

        function syncSettingsModelFromState() {
            const settings = normalizeSettingsModel(state.settingsModel || {});
            settings.document.title = state.documentTitle || settings.document.title || 'Presentation';
            settings.document.aspectRatio = state.aspectRatio;
            settings.document.stage.width = state.currentStageWidth;
            settings.document.stage.height = state.currentStageHeight;

            const defaults = settings.defaults.text;
            defaults.fontFamily = state.textDefaults.fontFamily || defaults.fontFamily;
            defaults.fontSize = Number.isFinite(state.textDefaults.fontSize) ? state.textDefaults.fontSize : defaults.fontSize;
            defaults.fontColor = state.textDefaults.fontColor || defaults.fontColor;
            defaults.fontWeight = state.textDefaults.fontBold ? 700 : 400;

            state.settingsModel = settings;
            return settings;
        }

        function getSlideModelIndex(slideId) {
            if (!state.documentModel || !slideId) return -1;
            return state.documentModel.slides.findIndex((slide) => slide && slide.id === slideId);
        }

        function ensureSlideModel(slideId, index) {
            ensureModelsReady();
            if (!slideId) {
                slideId = generateId('slide', 'slideCounter');
            }
            const existingIndex = getSlideModelIndex(slideId);
            if (existingIndex >= 0) {
                return state.documentModel.slides[existingIndex];
            }
            const slideModel = { id: slideId, elements: [] };
            const slides = state.documentModel.slides;
            if (Number.isFinite(index) && index >= 0 && index <= slides.length) {
                slides.splice(index, 0, slideModel);
            } else {
                slides.push(slideModel);
            }
            return slideModel;
        }

        function replaceSlideElementsModel(slideId, elements) {
            const slideModel = ensureSlideModel(slideId);
            slideModel.elements = Array.isArray(elements) ? elements : [];
        }

        function removeSlideModel(slideId) {
            if (!state.documentModel || !slideId) return;
            state.documentModel.slides = state.documentModel.slides.filter((slide) => slide && slide.id !== slideId);
        }

        function upsertElementModel(slideId, element) {
            if (!element) return;
            const slideModel = ensureSlideModel(slideId);
            const elementId = element.id || generateId('el', 'elementCounter');
            element.id = elementId;
            const index = slideModel.elements.findIndex((el) => el && el.id === elementId);
            if (index >= 0) {
                slideModel.elements[index] = element;
            } else {
                slideModel.elements.push(element);
            }
        }

        function removeElementModel(slideId, elementId) {
            if (!state.documentModel || !slideId || !elementId) return;
            const slideIndex = getSlideModelIndex(slideId);
            if (slideIndex < 0) return;
            const slideModel = state.documentModel.slides[slideIndex];
            slideModel.elements = slideModel.elements.filter((el) => el && el.id !== elementId);
        }
