; Inno Setup script (draft)

#define AppName "Alt PPT Player"
#define AppVersion "0.1.0"
#define AppExeName "AltPptPlayer.exe"
#define BuildDir "..\\dist\\AltPptPlayer"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\\AltPptPlayer
DefaultGroupName={#AppName}
OutputBaseFilename=AltPptPlayer-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
ChangesAssociations=yes

[Files]
Source: "{#BuildDir}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
; Per-user file association for .altppt
Root: HKCU; Subkey: "Software\\Classes\\.altppt"; ValueType: string; ValueData: "AltPptPlayer.AltPpt"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\\Classes\\AltPptPlayer.AltPpt"; ValueType: string; ValueData: "ALT PPT Package"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\\Classes\\AltPptPlayer.AltPpt\\DefaultIcon"; ValueType: string; ValueData: "{app}\\{#AppExeName},0"
Root: HKCU; Subkey: "Software\\Classes\\AltPptPlayer.AltPpt\\shell\\open\\command"; ValueType: string; ValueData: "\"{app}\\{#AppExeName}\" \"%1\""

[Run]
; Optional: install WebView2 runtime if needed.
; Filename: "{app}\\MicrosoftEdgeWebView2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing WebView2 runtime..."; Flags: waituntilterminated
