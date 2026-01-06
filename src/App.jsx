import { useState, useEffect, useRef } from "react";
import { bootWebContainer } from "./webcontainer";
import { files } from "./const";
import Editor from "./Editor";
import Preview from "./Preview";
import Terminal from "./Terminal";
import FileExplorer from "./FileExplorer";
import "./App.css";

function App() {
  const [container, setContainer] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentRoute, setCurrentRoute] = useState("/");
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedFile, setSelectedFile] = useState("/main.jsx");
  const terminalRef = useRef(null);
  const fileExplorerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Step 1: Boot WebContainer
        const webcontainer = await bootWebContainer();
        if (!mounted) return;
        setContainer(webcontainer);

        // Write to terminal
        const writeToTerminal = (data) => {
          if (terminalRef.current) {
            terminalRef.current.write(data);
          }
        };

        writeToTerminal("\r\n\x1b[32m✓ WebContainer booted successfully\x1b[0m\r\n");

        // Step 2: Mount files
        writeToTerminal("\r\n\x1b[33mMounting files...\x1b[0m\r\n");

        // Mount root files first (without pages directory)
        const rootFiles = {
          "package.json": files["package.json"],
          "index.html": files["index.html"],
          "vite.config.js": files["vite.config.js"],
          "main.jsx": files["main.jsx"],
          "App.jsx": files["App.jsx"],
        };

        await webcontainer.mount(rootFiles);
        writeToTerminal("\x1b[36m✓ Root files mounted\x1b[0m\r\n");

        // Create pages directory and write page files directly
        try {
          await webcontainer.fs.mkdir("/pages", { recursive: true });
          writeToTerminal("\x1b[36m✓ Created /pages directory\x1b[0m\r\n");
        } catch (e) {
          // Directory might already exist
        }

        // Write page files directly using writeFile instead of mount
        try {
          await webcontainer.fs.writeFile("/pages/home.jsx", files["pages/home.jsx"].file.contents);
          writeToTerminal("\x1b[36m✓ Written /pages/home.jsx\x1b[0m\r\n");

          await webcontainer.fs.writeFile("/pages/about.jsx", files["pages/about.jsx"].file.contents);
          writeToTerminal("\x1b[36m✓ Written /pages/about.jsx\x1b[0m\r\n");

          await webcontainer.fs.writeFile("/pages/contact.jsx", files["pages/contact.jsx"].file.contents);
          writeToTerminal("\x1b[36m✓ Written /pages/contact.jsx\x1b[0m\r\n");

          writeToTerminal("\x1b[32m✓ All files created successfully\x1b[0m\r\n");

          // Refresh file explorer to show new files
          if (fileExplorerRef.current && fileExplorerRef.current.refresh) {
            setTimeout(() => {
              fileExplorerRef.current.refresh();
            }, 300);
          }
        } catch (e) {
          writeToTerminal(`\r\n\x1b[31m✗ Error writing page files: ${e.message}\x1b[0m\r\n`);
          throw e;
        }

        // Small delay to ensure files are fully written
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify critical files exist
        try {
          const rootFiles = await webcontainer.fs.readdir("/");
          writeToTerminal(`\r\n\x1b[36mFiles in root: ${rootFiles.join(", ")}\x1b[0m\r\n`);

          // Verify main.jsx exists
          try {
            const mainContent = await webcontainer.fs.readFile("/main.jsx", "utf-8");
            writeToTerminal(`\r\n\x1b[32m✓ Verified main.jsx exists (${mainContent.length} chars)\x1b[0m\r\n`);
          } catch (e) {
            writeToTerminal(`\r\n\x1b[31m✗ Error reading main.jsx: ${e.message}\x1b[0m\r\n`);
          }

          const pagesFiles = await webcontainer.fs.readdir("/pages");
          writeToTerminal(`\r\n\x1b[36mFiles in /pages: ${pagesFiles.join(", ")}\x1b[0m\r\n`);

          // Verify pages files exist
          for (const file of ["home.jsx", "about.jsx", "contact.jsx"]) {
            try {
              const content = await webcontainer.fs.readFile(`/pages/${file}`, "utf-8");
              writeToTerminal(`\r\n\x1b[32m✓ Verified /pages/${file} exists\x1b[0m\r\n`);
            } catch (e) {
              writeToTerminal(`\r\n\x1b[31m✗ Error reading /pages/${file}: ${e.message}\x1b[0m\r\n`);
            }
          }
        } catch (e) {
          writeToTerminal(`\r\n\x1b[33mWarning: Could not verify files: ${e.message}\x1b[0m\r\n`);
        }

        // Step 3: Run npm install
        setIsInstalling(true);
        writeToTerminal("\r\n\x1b[33mRunning npm install...\x1b[0m\r\n");

        let installErrorOutput = "";
        const install = await webcontainer.spawn("npm", ["install"]);

        install.output.pipeTo(
          new WritableStream({
            write(data) {
              writeToTerminal(data);
              installErrorOutput += data;
              // Check for the specific error
              if (data.includes("EIO: invalid file name")) {
                writeToTerminal("\r\n\x1b[31m⚠ Detected EIO error in npm install output\x1b[0m\r\n");
              }
            },
          })
        );

        const installExitCode = await install.exit;
        if (installExitCode === 0) {
          writeToTerminal("\r\n\x1b[32m✓ npm install completed successfully\x1b[0m\r\n");
        } else {
          writeToTerminal(`\r\n\x1b[31m✗ npm install failed with exit code ${installExitCode}\x1b[0m\r\n`);
          if (installErrorOutput.includes("pages/home.jsx")) {
            writeToTerminal("\r\n\x1b[33m⚠ Error related to pages/home.jsx detected\x1b[0m\r\n");
            writeToTerminal("\x1b[33mTrying to verify file exists...\x1b[0m\r\n");
            try {
              const exists = await webcontainer.fs.readFile("/pages/home.jsx", "utf-8");
              writeToTerminal(`\x1b[32m✓ File exists and is readable (${exists.length} chars)\x1b[0m\r\n`);
            } catch (e) {
              writeToTerminal(`\x1b[31m✗ Cannot read file: ${e.message}\x1b[0m\r\n`);
            }
          }
        }
        setIsInstalling(false);

        // Step 4: Start dev server
        setIsStarting(true);
        writeToTerminal("\r\n\x1b[33mStarting Vite dev server...\x1b[0m\r\n");
        const dev = await webcontainer.spawn("npm", ["run", "dev"]);

        let serverReady = false;

        dev.output.pipeTo(
          new WritableStream({
            write(data) {
              writeToTerminal(data);
            },
          })
        );

        // Step 5: Listen for server-ready event
        const serverReadyHandler = (port, url) => {
          if (serverReady) return; // Prevent duplicate calls
          serverReady = true;
          console.log("Server ready event fired:", { port, url });
          writeToTerminal(`\r\n\x1b[32m✓ Dev server ready on port ${port}\x1b[0m\r\n`);
          writeToTerminal(`\x1b[36mPreview URL: ${url}\x1b[0m\r\n`);
          if (mounted) {
            setPreviewUrl(url);
            setIsStarting(false);
          }
        };

        webcontainer.on("server-ready", serverReadyHandler);

        // Log when dev process exits (for debugging)
        dev.exit.then((code) => {
          if (code !== 0 && !serverReady) {
            writeToTerminal(`\r\n\x1b[31m✗ Dev server exited with code ${code}\x1b[0m\r\n`);
            if (mounted) {
              setIsStarting(false);
            }
          }
        });
      } catch (error) {
        console.error("Error initializing WebContainer:", error);
        if (terminalRef.current) {
          terminalRef.current.write(
            `\r\n\x1b[31m✗ Error: ${error.message}\x1b[0m\r\n`
          );
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCodeChange = async (filePath, newCode) => {
    // File is already written by Editor component
    console.log(`File ${filePath} updated`);
    // Refresh file explorer to show any new files/directories
    if (fileExplorerRef.current && fileExplorerRef.current.refresh) {
      setTimeout(() => {
        fileExplorerRef.current.refresh();
      }, 100);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>WebContainer IDE</h1>
        <div className="status">
          {isInstalling && <span>Installing dependencies...</span>}
          {isStarting && <span>Starting dev server...</span>}
          {previewUrl && (
            <>
              <span>✓ Server running</span>
              <span className="preview-url" title="Click to copy">
                {previewUrl}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="main-layout">
        <div className="sidebar">
          <FileExplorer
            ref={fileExplorerRef}
            container={container}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            onFileCreate={() => {
              // File tree will refresh automatically
            }}
          />
        </div>

        <div className="editor-panel">
          <Editor
            container={container}
            filePath={selectedFile}
            onCodeChange={handleCodeChange}
          />
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            {previewUrl && (
              <div className="preview-url-bar">
                <span>Preview URL:</span>
                <input
                  type="text"
                  value={`${previewUrl}${currentRoute === "/" ? "" : currentRoute}`}
                  readOnly
                  onClick={(e) => e.target.select()}
                  style={{
                    flex: 1,
                    margin: "0 8px",
                    padding: "4px 8px",
                    background: "#2a2d2e",
                    border: "1px solid #3e3e42",
                    color: "#d4d4d4",
                    borderRadius: "3px",
                    fontSize: "12px",
                  }}
                />
                <button
                  onClick={() => {
                    const fullUrl = `${previewUrl}${currentRoute === "/" ? "" : currentRoute}`;
                    navigator.clipboard.writeText(fullUrl);
                    alert("URL copied to clipboard!");
                  }}
                  style={{
                    padding: "4px 12px",
                    background: "#4a9eff",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
          <Preview previewUrl={previewUrl} onRouteChange={setCurrentRoute} />
        </div>
      </div>

      <div className="terminal-panel">
        <Terminal ref={terminalRef} container={container} />
      </div>
    </div>
  );
}

export default App;
