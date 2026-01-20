        function resetIdCounters() {
            state.documentCounter = 1;
            state.slideCounter = 1;
            state.elementCounter = 1;
            state.assetCounter = 1;
        }

        function generateId(prefix, counterKey) {
            const current = Number.isFinite(state[counterKey]) ? state[counterKey] : 1;
            state[counterKey] = current + 1;
            return `${prefix}_${String(current).padStart(3, '0')}`;
        }

        function ensureDocumentId() {
            if (!state.documentId) {
                state.documentId = generateId('doc', 'documentCounter');
            }
            return state.documentId;
        }

        function ensureSlideId(slide) {
            if (!slide) return '';
            if (!slide.dataset.slideId) {
                slide.dataset.slideId = generateId('slide', 'slideCounter');
            }
            return slide.dataset.slideId;
        }

        function ensureElementId(wrapper) {
            if (!wrapper) return '';
            if (!wrapper.dataset.elementId) {
                wrapper.dataset.elementId = generateId('el', 'elementCounter');
            }
            return wrapper.dataset.elementId;
        }

        function generateAssetId() {
            return generateId('asset', 'assetCounter');
        }
