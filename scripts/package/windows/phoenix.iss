[Setup]
AppId={{CFBC7EE5-6215-4C6B-9A68-73679F436E6B}
AppName=PHOENIX
AppVersion=@@PhoenixVersion@@
AppPublisher=PHOENIX Project
DefaultDirName={localappdata}\Programs\PHOENIX
DefaultGroupName=PHOENIX
DisableProgramGroupPage=yes
LicenseFile=@@LicensePath@@
SetupIconFile=@@IconPath@@
OutputDir=@@OutputRoot@@
OutputBaseFilename=PHOENIX-@@PhoenixVersion@@-windows-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
AppMutex=Local\PhoenixLauncher
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\Phoenix.exe

[Files]
Source: "@@PayloadRoot@@\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "@@LauncherPath@@"; DestDir: "{app}"; DestName: "Phoenix.exe"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\PHOENIX"; Filename: "{app}\Phoenix.exe"; IconFilename: "{app}\Phoenix.exe"
Name: "{userdesktop}\PHOENIX"; Filename: "{app}\Phoenix.exe"; IconFilename: "{app}\Phoenix.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\Phoenix.exe"; Description: "Launch PHOENIX"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Phoenix.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopPHOENIX"
