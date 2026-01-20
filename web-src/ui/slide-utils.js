        function refreshSlides() {
            if (dom.stage) {
                state.slides = dom.stage.querySelectorAll('.slide');
            } else {
                state.slides = [];
            }
            return state.slides;
        }

        function getActiveSlide() {
            const slides = refreshSlides();
            return slides[state.currentSlideIndex] || null;
        }

        function removeGuideText(slide) {
            if (!slide) return;
            const guideText = slide.querySelector('.guide-text');
            if (guideText) guideText.remove();
        }
