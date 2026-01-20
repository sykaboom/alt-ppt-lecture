        const crcTable = (() => {
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let k = 0; k < 8; k++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c >>> 0;
            }
            return table;
        })();

        function crc32(data) {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < data.length; i++) {
                const byte = data[i];
                crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }

        function toDosDateTime(date) {
            const year = Math.max(1980, date.getFullYear());
            const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
            const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
            return { dosDate, dosTime };
        }

        async function toUint8Array(data) {
            if (data instanceof Uint8Array) return data;
            if (typeof data === 'string') return textEncoder.encode(data);
            if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
            return new Uint8Array(0);
        }

        function buildZip(entries) {
            let offset = 0;
            const parts = [];
            const records = [];
            const { dosDate, dosTime } = toDosDateTime(new Date());

            for (const entry of entries) {
                const nameBytes = textEncoder.encode(entry.name);
                const data = entry.data;
                const crc = crc32(data);

                const localHeader = new Uint8Array(30 + nameBytes.length);
                const localView = new DataView(localHeader.buffer);
                localView.setUint32(0, 0x04034b50, true);
                localView.setUint16(4, 20, true);
                localView.setUint16(6, 0x0800, true);
                localView.setUint16(8, 0, true);
                localView.setUint16(10, dosTime, true);
                localView.setUint16(12, dosDate, true);
                localView.setUint32(14, crc, true);
                localView.setUint32(18, data.length, true);
                localView.setUint32(22, data.length, true);
                localView.setUint16(26, nameBytes.length, true);
                localView.setUint16(28, 0, true);
                localHeader.set(nameBytes, 30);

                parts.push(localHeader, data);
                records.push({ nameBytes, crc, size: data.length, offset, time: dosTime, date: dosDate });
                offset += localHeader.length + data.length;
            }

            const centralStart = offset;

            for (const record of records) {
                const centralHeader = new Uint8Array(46 + record.nameBytes.length);
                const view = new DataView(centralHeader.buffer);
                view.setUint32(0, 0x02014b50, true);
                view.setUint16(4, 20, true);
                view.setUint16(6, 20, true);
                view.setUint16(8, 0x0800, true);
                view.setUint16(10, 0, true);
                view.setUint16(12, record.time, true);
                view.setUint16(14, record.date, true);
                view.setUint32(16, record.crc, true);
                view.setUint32(20, record.size, true);
                view.setUint32(24, record.size, true);
                view.setUint16(28, record.nameBytes.length, true);
                view.setUint16(30, 0, true);
                view.setUint16(32, 0, true);
                view.setUint16(34, 0, true);
                view.setUint16(36, 0, true);
                view.setUint32(38, 0, true);
                view.setUint32(42, record.offset, true);
                centralHeader.set(record.nameBytes, 46);
                parts.push(centralHeader);
                offset += centralHeader.length;
            }

            const centralSize = offset - centralStart;
            const end = new Uint8Array(22);
            const endView = new DataView(end.buffer);
            endView.setUint32(0, 0x06054b50, true);
            endView.setUint16(4, 0, true);
            endView.setUint16(6, 0, true);
            endView.setUint16(8, records.length, true);
            endView.setUint16(10, records.length, true);
            endView.setUint32(12, centralSize, true);
            endView.setUint32(16, centralStart, true);
            endView.setUint16(20, 0, true);
            parts.push(end);

            return new Blob(parts, { type: 'application/zip' });
        }

        function savePackageAs() {
            savePackage({ forceSaveAs: true });
        }

        async function savePackage(options = {}) {
            deselectImage();

            const missingAssets = getMissingAssets();
            if (missingAssets.length > 0) {
                const preview = missingAssets.slice(0, 10).join('\n');
                const more = missingAssets.length > 10 ? `\n...외 ${missingAssets.length - 10}개` : '';
                const proceed = confirm(`다음 리소스가 패키지에 없습니다:\n${preview}${more}\n\nShift/Alt 드래그로 지원 파일만 추가할 수 있습니다.\n그래도 저장할까요?`);
                if (!proceed) return;
            }
            const forceSaveAs = options.forceSaveAs === true;
            const date = new Date();
            const timeString = `${date.getHours()}시${date.getMinutes()}분`;
            const defaultBaseName = `Presentation_Package_${timeString}`;
            const defaultPackageName = `${defaultBaseName}.${CONFIG.PACKAGE_EXTENSION}`;
            let packageHandle = forceSaveAs ? null : state.lastSaveHandle;
            let packageFileName = ensurePackageExtension(state.lastPackageFileName) || defaultPackageName;
            if (!packageFileName) packageFileName = defaultPackageName;

            if (!packageHandle) {
                try {
                    if (window.showSaveFilePicker) {
                        packageHandle = await window.showSaveFilePicker({
                            suggestedName: packageFileName,
                            types: [{ description: `Package (*.${CONFIG.PACKAGE_EXTENSION})`, accept: { 'application/zip': [`.${CONFIG.PACKAGE_EXTENSION}`] } }],
                        });
                        if (packageHandle && packageHandle.name) {
                            packageFileName = packageHandle.name;
                        }
                        state.lastSaveHandle = packageHandle;
                        state.lastPackageFileName = packageFileName;
                    }
                } catch (err) { console.log(err); }
            } else if (packageHandle.name) {
                packageFileName = packageHandle.name;
            }

            const baseTitle = stripExtensionFromName(packageFileName, CONFIG.PACKAGE_EXTENSION) || defaultBaseName;
            document.title = baseTitle;
            state.documentTitle = baseTitle;
            state.lastPackageFileName = packageFileName;

            const { assetIdByPath, assets } = buildAssetIdMapping();
            let contentModel = state.documentModel;
            if (!contentModel || !Array.isArray(contentModel.slides)) {
                contentModel = buildContentFromDom(assetIdByPath);
                contentModel = normalizeContentModel(contentModel);
                state.documentModel = contentModel;
            }
            let settingsModel;
            if (state.settingsModel) {
                settingsModel = syncSettingsModelFromState();
            } else {
                settingsModel = buildSettingsFromDom();
                settingsModel = normalizeSettingsModel(settingsModel);
                state.settingsModel = settingsModel;
            }
            const manifestModel = buildManifest(assets);

            const entries = [
                { name: 'manifest.json', data: textEncoder.encode(JSON.stringify(manifestModel, null, 2)) },
                { name: 'content.json', data: textEncoder.encode(JSON.stringify(contentModel, null, 2)) },
                { name: 'settings.json', data: textEncoder.encode(JSON.stringify(settingsModel, null, 2)) }
            ];
            for (const [name, blob] of state.packageFiles.entries()) {
                entries.push({ name, data: await toUint8Array(blob) });
            }

            const content = buildZip(entries);

            try {
                if (packageHandle) {
                    const writable = await packageHandle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    alert("패키지 파일로 저장되었습니다!");
                    return;
                }
            } catch (err) { console.log(err); }

            const link = document.createElement('a');
            const url = URL.createObjectURL(content);
            link.href = url;
            link.download = packageFileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
            alert("다운로드 폴더에 패키지 파일로 저장되었습니다!");
        }
