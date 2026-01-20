        function buildManifest(assets) {
            const now = new Date().toISOString();
            if (!state.documentCreatedAt) state.documentCreatedAt = now;
            return {
                format: 'altppt',
                version: '2.0',
                createdAt: state.documentCreatedAt,
                updatedAt: now,
                entry: {
                    content: 'content.json',
                    settings: 'settings.json'
                },
                assets,
                legacy: state.legacySource || undefined
            };
        }
