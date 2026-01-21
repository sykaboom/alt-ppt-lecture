using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace AltPptPlayer;

public partial class MainWindow : Window
{
    private const string WebView2InstallerUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
    private string? _workRoot;
    private bool _isFullscreen;
    private WindowState _prevWindowState;
    private WindowStyle _prevWindowStyle;
    private ResizeMode _prevResizeMode;
    private bool _prevTopmost;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Closing += OnClosing;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        var packagePath = ResolvePackagePathFromArgs();

        if (!await EnsureWebView2RuntimeAsync())
        {
            Close();
            return;
        }

        try
        {
            await InitializeWebViewAsync(packagePath);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Alt PPT Player", MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
        }
    }

    private static string? ResolvePackagePathFromArgs()
    {
        var args = Environment.GetCommandLineArgs();
        if (args.Length < 2) return null;
        var candidate = args[1];
        return File.Exists(candidate) ? candidate : null;
    }

    private static string? PromptForPackagePath()
    {
        var dialog = new OpenFileDialog
        {
            Filter = "ALT PPT (*.altppt;*.zip)|*.altppt;*.zip|HTML (*.html;*.htm)|*.html;*.htm|All files (*.*)|*.*",
            Multiselect = false
        };
        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }

    private async Task<bool> EnsureWebView2RuntimeAsync()
    {
        if (IsWebView2RuntimeAvailable()) return true;

        var result = MessageBox.Show(
            this,
            "Microsoft Edge WebView2 Runtime is required.\nInstall it now?",
            "Alt PPT Player",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes) return false;

        var installerPath = Path.Combine(AppContext.BaseDirectory, "MicrosoftEdgeWebView2Setup.exe");
        if (!File.Exists(installerPath))
        {
            MessageBox.Show(
                this,
                "WebView2 installer not found. Downloading it now...",
                "Alt PPT Player",
                MessageBoxButton.OK,
                MessageBoxImage.Information);

            installerPath = await DownloadWebView2InstallerAsync() ?? installerPath;
        }

        if (!File.Exists(installerPath))
        {
            OpenWebView2DownloadPage();
            MessageBox.Show(
                this,
                "Installer download failed. The download page has been opened.\nInstall and restart the app.",
                "Alt PPT Player",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return false;
        }

        var launched = await RunWebView2InstallerAsync(installerPath);
        if (!launched)
        {
            MessageBox.Show(
                this,
                "Unable to start the WebView2 installer.\nInstall and restart the app.",
                "Alt PPT Player",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            return false;
        }

        var installed = await WaitForWebView2RuntimeAsync(TimeSpan.FromMinutes(2));
        if (!installed)
        {
            MessageBox.Show(
                this,
                "WebView2 installation did not complete.\nInstall and restart the app.",
                "Alt PPT Player",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return false;
        }

        RestartApp();
        return false;
    }

    private static bool IsWebView2RuntimeAvailable()
    {
        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            return !string.IsNullOrWhiteSpace(version);
        }
        catch
        {
            return false;
        }
    }

    private static void OpenWebView2DownloadPage()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = WebView2InstallerUrl,
                UseShellExecute = true
            });
        }
        catch
        {
            // Best-effort: if the browser can't be opened, just fall back to manual install.
        }
    }

    private static async Task<string?> DownloadWebView2InstallerAsync()
    {
        try
        {
            var targetDir = Path.Combine(Path.GetTempPath(), "AltPptPlayer");
            Directory.CreateDirectory(targetDir);
            var targetPath = Path.Combine(targetDir, "MicrosoftEdgeWebView2Setup.exe");

            using var client = new HttpClient();
            using var response = await client.GetAsync(WebView2InstallerUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            await using var input = await response.Content.ReadAsStreamAsync();
            await using var output = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None);
            await input.CopyToAsync(output);

            return targetPath;
        }
        catch
        {
            return null;
        }
    }

    private static async Task<bool> RunWebView2InstallerAsync(string installerPath)
    {
        try
        {
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = installerPath,
                Arguments = "/silent /install",
                UseShellExecute = true
            });
            if (process == null) return false;

            await Task.Run(() => process.WaitForExit());
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> WaitForWebView2RuntimeAsync(TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (IsWebView2RuntimeAvailable()) return true;
            await Task.Delay(1000);
        }
        return IsWebView2RuntimeAvailable();
    }

    private void RestartApp()
    {
        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath)) return;

        var args = BuildRestartArguments();
        Process.Start(new ProcessStartInfo
        {
            FileName = exePath,
            Arguments = args,
            UseShellExecute = true
        });

        Application.Current.Shutdown();
    }

    private static string BuildRestartArguments()
    {
        var args = Environment.GetCommandLineArgs();
        if (args.Length <= 1) return string.Empty;

        var parts = new string[args.Length - 1];
        for (var i = 1; i < args.Length; i++)
        {
            parts[i - 1] = QuoteArgument(args[i]);
        }
        return string.Join(" ", parts);
    }

    private static string QuoteArgument(string arg)
    {
        if (string.IsNullOrEmpty(arg)) return "\"\"";
        if (arg.IndexOfAny(new[] { ' ', '\t', '"' }) < 0) return arg;
        return "\"" + arg.Replace("\"", "\\\"") + "\"";
    }

    private async Task InitializeWebViewAsync(string? packagePath)
    {
        var runtimeRoot = PrepareRuntimeRoot(packagePath, out var initialUrl);

        var userDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AltPptPlayer",
            "WebView2");
        var env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
        await PlayerView.EnsureCoreWebView2Async(env);

        var settings = PlayerView.CoreWebView2.Settings;
        settings.AreDefaultContextMenusEnabled = false;
        settings.IsZoomControlEnabled = false;
        settings.AreBrowserAcceleratorKeysEnabled = false;

        PlayerView.CoreWebView2.NavigationCompleted += (_, _) =>
        {
            PlayerView.Focus();
        };

        PlayerView.CoreWebView2.ContainsFullScreenElementChanged += (_, _) =>
        {
            if (PlayerView.CoreWebView2.ContainsFullScreenElement)
            {
                EnterFullscreen();
            }
            else
            {
                ExitFullscreen();
            }
        };

        PlayerView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "app.altppt",
            runtimeRoot,
            CoreWebView2HostResourceAccessKind.Allow);

        PlayerView.Source = new Uri(initialUrl);
    }

    private string PrepareRuntimeRoot(string? packagePath, out string initialUrl)
    {
        _workRoot = CreateWorkRoot();
        var runtimeRoot = _workRoot;
        Directory.CreateDirectory(runtimeRoot);

        var playerSource = Path.Combine(AppContext.BaseDirectory, "player.html");
        var playerDest = Path.Combine(runtimeRoot, "player.html");
        if (!File.Exists(playerSource))
        {
            throw new InvalidOperationException("player.html not found in the app directory.");
        }
        File.Copy(playerSource, playerDest, true);

        if (string.IsNullOrWhiteSpace(packagePath))
        {
            initialUrl = "https://app.altppt/player.html";
            return runtimeRoot;
        }

        var fileName = Path.GetFileName(packagePath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new InvalidOperationException("Package file name not found.");
        }

        var extension = Path.GetExtension(packagePath).ToLowerInvariant();
        if (extension == ".html" || extension == ".htm")
        {
            var htmlDest = Path.Combine(runtimeRoot, fileName);
            File.Copy(packagePath, htmlDest, true);
            initialUrl = $"https://app.altppt/{Uri.EscapeDataString(fileName)}";
            return runtimeRoot;
        }

        var packagesDir = Path.Combine(runtimeRoot, "packages");
        Directory.CreateDirectory(packagesDir);
        var packageDest = Path.Combine(packagesDir, fileName);
        File.Copy(packagePath, packageDest, true);

        var relativePath = $"packages/{fileName}";
        var encodedPath = Uri.EscapeDataString(relativePath);
        initialUrl = $"https://app.altppt/player.html?package={encodedPath}";
        return runtimeRoot;
    }

    private static string CreateWorkRoot()
    {
        var baseDir = Path.Combine(Path.GetTempPath(), "AltPptPlayer");
        Directory.CreateDirectory(baseDir);
        var root = Path.Combine(baseDir, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        return root;
    }

    private void OnClosing(object? sender, CancelEventArgs e)
    {
        CleanupWorkRoot();
    }

    private void CleanupWorkRoot()
    {
        if (string.IsNullOrWhiteSpace(_workRoot)) return;
        try
        {
            if (Directory.Exists(_workRoot))
            {
                Directory.Delete(_workRoot, true);
            }
        }
        catch
        {
            // Best-effort cleanup.
        }
    }

    private void EnterFullscreen()
    {
        if (_isFullscreen) return;
        _isFullscreen = true;
        _prevWindowState = WindowState;
        _prevWindowStyle = WindowStyle;
        _prevResizeMode = ResizeMode;
        _prevTopmost = Topmost;

        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        WindowState = WindowState.Maximized;
        Topmost = true;
    }

    private void ExitFullscreen()
    {
        if (!_isFullscreen) return;
        _isFullscreen = false;

        Topmost = _prevTopmost;
        WindowStyle = _prevWindowStyle;
        ResizeMode = _prevResizeMode;
        WindowState = _prevWindowState;
    }
}
