        function sanitizeFileName(name) {
            const base = (name || '').split(/[\\/]/).pop();
            return base.replace(/[<>:"|?*]/g, '_').trim();
        }

        function splitName(name) {
            const clean = name || '';
            const dot = clean.lastIndexOf('.');
            if (dot <= 0) return { base: clean || 'file', ext: '' };
            return { base: clean.slice(0, dot), ext: clean.slice(dot) };
        }

        function splitPath(path) {
            const normalized = path || '';
            const slash = normalized.lastIndexOf('/');
            const dir = slash === -1 ? '' : normalized.slice(0, slash + 1);
            const file = slash === -1 ? normalized : normalized.slice(slash + 1);
            const { base, ext } = splitName(file);
            return { dir, base, ext };
        }

        function parseDataUrl(value) {
            if (!value || typeof value !== 'string') return null;
            if (!value.startsWith('data:')) return null;
            const commaIndex = value.indexOf(',');
            if (commaIndex === -1) return null;
            const meta = value.slice(5, commaIndex);
            const data = value.slice(commaIndex + 1);
            const parts = meta.split(';').filter(Boolean);
            const mime = parts[0] || 'application/octet-stream';
            const isBase64 = parts.includes('base64');
            return { mime, isBase64, data };
        }

        function decodeBase64ToUint8Array(base64) {
            const cleaned = (base64 || '').replace(/\s+/g, '');
            const binary = atob(cleaned);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }

        function stripExtensionFromName(name, extension) {
            const safeName = sanitizeFileName(name || '');
            if (!safeName) return '';
            if (extension) {
                const suffix = `.${extension.toLowerCase()}`;
                if (safeName.toLowerCase().endsWith(suffix)) {
                    return safeName.slice(0, -suffix.length);
                }
            }
            const { base } = splitName(safeName);
            return base;
        }

        function sanitizePath(path) {
            const normalized = (path || '').replace(/\\/g, '/');
            const parts = normalized.split('/').filter(Boolean);
            const safeParts = parts
                .filter(part => part !== '.' && part !== '..')
                .map(part => part.replace(/[<>:"|?*]/g, '_'));
            return safeParts.join('/');
        }

        function ensurePackageExtension(name) {
            const safeName = sanitizeFileName(name || '');
            if (!safeName) return '';
            const lower = safeName.toLowerCase();
            const ext = `.${CONFIG.PACKAGE_EXTENSION}`;
            if (lower.endsWith(ext)) return safeName;
            const { base } = splitName(safeName);
            return `${base}${ext}`;
        }

        function guessMimeType(name) {
            const lower = (name || '').toLowerCase();
            if (lower.endsWith('.png')) return 'image/png';
            if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
            if (lower.endsWith('.gif')) return 'image/gif';
            if (lower.endsWith('.webp')) return 'image/webp';
            if (lower.endsWith('.svg')) return 'image/svg+xml';
            if (lower.endsWith('.bmp')) return 'image/bmp';
            if (lower.endsWith('.ico')) return 'image/x-icon';
            if (lower.endsWith('.mp4')) return 'video/mp4';
            if (lower.endsWith('.webm')) return 'video/webm';
            if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
            if (lower.endsWith('.mov') || lower.endsWith('.m4v')) return 'video/quicktime';
            if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
            if (lower.endsWith('.css')) return 'text/css';
            if (lower.endsWith('.js')) return 'text/javascript';
            if (lower.endsWith('.json')) return 'application/json';
            return 'application/octet-stream';
        }

        function inferImageExtension(name, type) {
            const extFromName = splitName(sanitizeFileName(name)).ext.toLowerCase();
            if (extFromName) return extFromName.replace('.', '');
            const typeMap = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/svg+xml': 'svg',
                'image/bmp': 'bmp',
                'image/x-icon': 'ico'
            };
            return typeMap[type] || 'png';
        }

        function inferVideoExtension(name, type) {
            const extFromName = splitName(sanitizeFileName(name)).ext.toLowerCase();
            if (extFromName) return extFromName.replace('.', '');
            const typeMap = {
                'video/mp4': 'mp4',
                'video/webm': 'webm',
                'video/ogg': 'ogv',
                'video/quicktime': 'mov'
            };
            return typeMap[type] || 'mp4';
        }

        function normalizeAssetPath(value) {
            if (!value) return null;
            const trimmed = value.trim();
            if (!trimmed) return null;
            const cleaned = trimmed.split('#')[0].split('?')[0];
            if (!cleaned) return null;
            if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(cleaned)) return null;
            const withoutLeading = cleaned.replace(/^\.\//, '').replace(/^\//, '');
            if (withoutLeading.startsWith('..')) return null;
            const safePath = sanitizePath(withoutLeading);
            return safePath || null;
        }

        function extractSrcsetPaths(srcsetValue, assets) {
            if (!srcsetValue) return;
            const candidates = srcsetValue.split(',');
            for (const candidate of candidates) {
                const url = candidate.trim().split(/\s+/)[0];
                const normalized = normalizeAssetPath(url);
                if (normalized) assets.add(normalized);
            }
        }

        function parseUrlCandidate(text) {
            if (!text) return null;
            const lines = String(text)
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);
            if (!lines.length) return null;
            const candidate = lines.find(line => !line.startsWith('#')) || lines[0];
            try {
                return new URL(candidate).toString();
            } catch {
                return null;
            }
        }

        function isVideoUrl(url) {
            if (!url) return false;
            const lower = url.toLowerCase().split('#')[0].split('?')[0];
            return /\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(lower);
        }

        function parseYouTubeStartTime(value) {
            if (!value) return 0;
            const trimmed = String(value).trim().toLowerCase();
            if (!trimmed) return 0;
            if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10) || 0;
            let total = 0;
            const pattern = /(\d+)(h|m|s)/g;
            let match;
            while ((match = pattern.exec(trimmed)) !== null) {
                const amount = Number.parseInt(match[1], 10);
                if (!Number.isFinite(amount)) continue;
                if (match[2] === 'h') total += amount * 3600;
                if (match[2] === 'm') total += amount * 60;
                if (match[2] === 's') total += amount;
            }
            return total;
        }

        function extractYouTubeVideoId(url) {
            if (!url) return null;
            try {
                const parsed = new URL(url);
                const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
                let videoId = '';

                if (host === 'youtu.be') {
                    videoId = parsed.pathname.split('/')[1] || '';
                } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
                    if (parsed.pathname === '/watch') {
                        videoId = parsed.searchParams.get('v') || '';
                    } else if (parsed.pathname.startsWith('/shorts/')) {
                        videoId = parsed.pathname.split('/')[2] || '';
                    } else if (parsed.pathname.startsWith('/embed/')) {
                        videoId = parsed.pathname.split('/')[2] || '';
                    }
                }

                if (!videoId) return null;
                videoId = videoId.split('?')[0].split('&')[0];
                if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

                const startParam = parsed.searchParams.get('t')
                    || parsed.searchParams.get('start')
                    || parsed.searchParams.get('time_continue');
                const startSeconds = parseYouTubeStartTime(startParam);

                return { videoId, startSeconds };
            } catch {
                return null;
            }
        }

        function getYouTubeEmbedUrl(url) {
            const data = extractYouTubeVideoId(url);
            if (!data) return null;
            const params = new URLSearchParams({
                rel: '0',
                modestbranding: '1',
                playsinline: '1'
            });
            if (data.startSeconds > 0) {
                params.set('start', String(data.startSeconds));
            }
            return `https://www.youtube-nocookie.com/embed/${data.videoId}?${params.toString()}`;
        }

        function getUrlHostLabel(url) {
            if (!url) return 'External';
            try {
                const parsed = new URL(url);
                return parsed.hostname || 'External';
            } catch {
                return 'External';
            }
        }
