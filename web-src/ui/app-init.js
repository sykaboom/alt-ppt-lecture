        function init() {
            state.documentTitle = document.title || state.documentTitle;
            bindEvents();
            updateInvertButton();
            resizeStage();
            updateSlideVisibility();
            renderThumbnails();
            initializeIframeControls();
            syncModelsFromDom();
        }

        init();

        (function setupPackageAutoLoad() {
            const params = new URLSearchParams(window.location.search);
            const packageUrl = params.get('package');
            if (!packageUrl) return;

            const loadFromUrl = async (url) => {
                try {
                    const resolvedUrl = new URL(url, window.location.href);
                    const response = await fetch(resolvedUrl.toString());
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const buffer = await response.arrayBuffer();
                    const rawName = resolvedUrl.pathname.split('/').pop() || 'package.altppt';
                    const fileName = decodeURIComponent(rawName);
                    const file = new File([buffer], fileName, { type: 'application/zip' });
                    await loadPackageFromFile(file, { skipConfirm: true });
                } catch (err) {
                    alert(`패키지를 불러오지 못했습니다.\n${err.message || err}`);
                }
            };

            loadFromUrl(packageUrl);
        })();
