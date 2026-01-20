using System;
using System.ComponentModel;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace AltPptPlayer;

public partial class MainWindow : Window
{
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
