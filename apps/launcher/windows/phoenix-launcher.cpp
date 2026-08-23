#include <windows.h>
#include <shellapi.h>
#include <fstream>
#include <string>

namespace {
constexpr UINT trayMessage = WM_APP + 1;
constexpr UINT openCommand = 1001;
constexpr UINT quitCommand = 1002;

NOTIFYICONDATAW trayIcon{};
PROCESS_INFORMATION launcherProcess{};
HANDLE launcherJob = nullptr;
HANDLE instanceMutex = nullptr;
HANDLE stopEvent = nullptr;
bool quitting = false;

std::wstring executableDirectory() {
  wchar_t path[MAX_PATH]{};
  GetModuleFileNameW(nullptr, path, MAX_PATH);
  std::wstring result(path);
  const auto separator = result.find_last_of(L"\\/");
  return separator == std::wstring::npos ? L"." : result.substr(0, separator);
}

std::wstring launcherStateDirectory() {
  wchar_t localAppData[MAX_PATH]{};
  const DWORD length = GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) return L".";
  const std::wstring product = std::wstring(localAppData, length) + L"\\PHOENIX";
  CreateDirectoryW(product.c_str(), nullptr);
  const std::wstring logs = product + L"\\Logs";
  CreateDirectoryW(logs.c_str(), nullptr);
  return logs;
}

void requestStop() {
  const std::wstring path = launcherStateDirectory() + L"\\launcher.stop";
  std::ofstream stop(path, std::ios::binary | std::ios::trunc);
  stop << "stop\n";
}

void openPhoenix() {
  ShellExecuteW(nullptr, L"open", L"http://127.0.0.1:3400", nullptr, nullptr, SW_SHOWNORMAL);
}

bool startLauncher() {
  const std::wstring directory = executableDirectory();
  const std::wstring runtime = directory + L"\\runtime\\node.exe";
  const std::wstring script = directory + L"\\scripts\\package\\launcher.mjs";
  std::wstring command = L"\"" + runtime + L"\" \"" + script + L"\"";

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;
  const BOOL created = CreateProcessW(
    nullptr,
    command.data(),
    nullptr,
    nullptr,
    FALSE,
    CREATE_NO_WINDOW,
    nullptr,
    directory.c_str(),
    &startup,
    &launcherProcess
  );
  if (!created) return false;

  CloseHandle(launcherProcess.hThread);
  launcherJob = CreateJobObjectW(nullptr, nullptr);
  if (launcherJob) {
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    SetInformationJobObject(launcherJob, JobObjectExtendedLimitInformation, &limits, sizeof(limits));
    AssignProcessToJobObject(launcherJob, launcherProcess.hProcess);
  }
  return true;
}

void stopLauncher() {
  if (!launcherProcess.hProcess) return;
  requestStop();
  if (WaitForSingleObject(launcherProcess.hProcess, 7000) == WAIT_TIMEOUT) {
    TerminateProcess(launcherProcess.hProcess, 1);
  }
  CloseHandle(launcherProcess.hProcess);
  launcherProcess.hProcess = nullptr;
  if (launcherJob) {
    CloseHandle(launcherJob);
    launcherJob = nullptr;
  }
}

void showTrayMenu(HWND window) {
  POINT point{};
  GetCursorPos(&point);
  HMENU menu = CreatePopupMenu();
  AppendMenuW(menu, MF_STRING | MF_DEFAULT, openCommand, L"Open PHOENIX");
  AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(menu, MF_STRING, quitCommand, L"Quit");
  SetForegroundWindow(window);
  TrackPopupMenu(menu, TPM_RIGHTBUTTON, point.x, point.y, 0, window, nullptr);
  DestroyMenu(menu);
}

LRESULT CALLBACK windowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  if (message == trayMessage) {
    if (LOWORD(lParam) == WM_LBUTTONDBLCLK) openPhoenix();
    else if (LOWORD(lParam) == WM_RBUTTONUP || LOWORD(lParam) == WM_CONTEXTMENU) showTrayMenu(window);
    return 0;
  }
  if (message == WM_COMMAND) {
    if (LOWORD(wParam) == openCommand) openPhoenix();
    else if (LOWORD(wParam) == quitCommand) {
      quitting = true;
      DestroyWindow(window);
    }
    return 0;
  }
  if (message == WM_DESTROY) {
    Shell_NotifyIconW(NIM_DELETE, &trayIcon);
    stopLauncher();
    PostQuitMessage(0);
    return 0;
  }
  return DefWindowProcW(window, message, wParam, lParam);
}
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR commandLine, int) {
  if (std::wstring(commandLine).find(L"--stop") != std::wstring::npos) {
    HANDLE existingStopEvent = OpenEventW(EVENT_MODIFY_STATE, FALSE, L"Local\\PhoenixLauncherStop");
    if (existingStopEvent) {
      SetEvent(existingStopEvent);
      CloseHandle(existingStopEvent);
    }
    requestStop();
    return 0;
  }

  instanceMutex = CreateMutexW(nullptr, TRUE, L"Local\\PhoenixLauncher");
  if (!instanceMutex || GetLastError() == ERROR_ALREADY_EXISTS) {
    openPhoenix();
    if (instanceMutex) CloseHandle(instanceMutex);
    return 0;
  }
  stopEvent = CreateEventW(nullptr, TRUE, FALSE, L"Local\\PhoenixLauncherStop");
  if (!stopEvent) {
    CloseHandle(instanceMutex);
    return 1;
  }

  const wchar_t className[] = L"PhoenixTrayWindow";
  WNDCLASSW windowClass{};
  windowClass.lpfnWndProc = windowProcedure;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = className;
  windowClass.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  RegisterClassW(&windowClass);
  HWND window = CreateWindowExW(0, className, L"PHOENIX", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, instance, nullptr);
  if (!window) return 1;

  if (!startLauncher()) {
    MessageBoxW(nullptr, L"PHOENIX could not start its background launcher.", L"PHOENIX", MB_OK | MB_ICONERROR);
    CloseHandle(instanceMutex);
    return 1;
  }

  trayIcon.cbSize = sizeof(trayIcon);
  trayIcon.hWnd = window;
  trayIcon.uID = 1;
  trayIcon.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_INFO;
  trayIcon.uCallbackMessage = trayMessage;
  trayIcon.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  wcscpy_s(trayIcon.szTip, L"PHOENIX");
  wcscpy_s(trayIcon.szInfoTitle, L"PHOENIX");
  wcscpy_s(trayIcon.szInfo, L"PHOENIX is starting. Right-click this icon for controls.");
  trayIcon.dwInfoFlags = NIIF_INFO;
  Shell_NotifyIconW(NIM_ADD, &trayIcon);
  trayIcon.uVersion = NOTIFYICON_VERSION_4;
  Shell_NotifyIconW(NIM_SETVERSION, &trayIcon);

  MSG message{};
  bool running = true;
  while (running) {
    HANDLE handles[] = {launcherProcess.hProcess, stopEvent};
    const DWORD wait = MsgWaitForMultipleObjects(2, handles, FALSE, INFINITE, QS_ALLINPUT);
    if (wait == WAIT_OBJECT_0) {
      if (!quitting) {
        MessageBoxW(nullptr, L"PHOENIX stopped unexpectedly. Check the PHOENIX log directory for details.", L"PHOENIX", MB_OK | MB_ICONERROR);
      }
      DestroyWindow(window);
      break;
    }
    if (wait == WAIT_OBJECT_0 + 1) {
      quitting = true;
      DestroyWindow(window);
      break;
    }
    while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
      if (message.message == WM_QUIT) { running = false; break; }
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
  }

  CloseHandle(stopEvent);
  CloseHandle(instanceMutex);
  return static_cast<int>(message.wParam);
}
