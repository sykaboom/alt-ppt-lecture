        function convertEmbeddedImagesInDocument(doc, cache) {
            if (!doc) return 0;
            let converted = 0;
            const images = doc.querySelectorAll('img[src^="data:"]');

            images.forEach((img) => {
                const src = img.getAttribute('src');
                const parsed = parseDataUrl(src);
                if (!parsed || !parsed.isBase64 || !parsed.mime.startsWith('image/')) return;

                if (cache && cache.has(src)) {
                    img.setAttribute('src', './' + cache.get(src));
                    converted += 1;
                    return;
                }

                try {
                    const bytes = decodeBase64ToUint8Array(parsed.data);
                    const blob = new Blob([bytes], { type: parsed.mime });
                    const assetPath = registerImageAsset(blob, '');
                    if (cache) cache.set(src, assetPath);
                    img.setAttribute('src', './' + assetPath);
                    converted += 1;
                } catch (err) { }
            });

            return converted;
        }

        function convertBase64ImagesInHtml(htmlText, cache) {
            if (!htmlText) return { html: htmlText, converted: 0 };
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            const converted = convertEmbeddedImagesInDocument(doc, cache);
            if (!converted) return { html: htmlText, converted: 0 };
            return { html: doc.documentElement.outerHTML, converted };
        }
