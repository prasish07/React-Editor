import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  buildSymbolMap,
  findDefinition,
  getWordAtPosition,
} from "./monacoDefinitionProvider";

export default function CodeEditor({ container, filePath, onCodeChange, onFileSelect }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const symbolMapRef = useRef(null);
  const fileContentsRef = useRef(null);
  const monacoConfiguredRef = useRef(false);
  const currentFilePathRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update current file path ref when filePath changes
  useEffect(() => {
    if (filePath) {
      const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
      currentFilePathRef.current = normalizedPath;
    }
  }, [filePath]);

  // Configure Monaco TypeScript defaults and register definition provider
  // This will be called from handleEditorDidMount when monaco is available
  const configureMonaco = (monaco) => {
    if (monacoConfiguredRef.current) return;

    // Configure TypeScript/JavaScript language defaults
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: false,
      noLib: false,
      esModuleInterop: true,
    });

    // Register definition provider for JavaScript/JSX
    monaco.languages.registerDefinitionProvider(["javascript", "typescript", "javascriptreact", "typescriptreact"], {
      provideDefinition: async (model, position) => {
        if (!container || !symbolMapRef.current || !fileContentsRef.current) {
          return null;
        }

        // Get current file path from ref (which is updated when filePath prop changes)
        let currentFilePath = currentFilePathRef.current;

        // Fallback: try to extract from model URI
        if (!currentFilePath) {
          currentFilePath = model.uri.path;
          // Monaco URIs might have file:// prefix, extract just the path
          if (currentFilePath.startsWith('/file:')) {
            currentFilePath = currentFilePath.replace('/file:', '');
          }
          // Remove file:// prefix if present
          if (currentFilePath.startsWith('file://')) {
            currentFilePath = currentFilePath.replace('file://', '');
          }
        }

        // Ensure path starts with /
        if (currentFilePath && !currentFilePath.startsWith('/')) {
          currentFilePath = `/${currentFilePath}`;
        }

        const word = getWordAtPosition(model, position);

        if (!word || !currentFilePath) {
          return null;
        }

        try {
          const definition = await findDefinition(
            word,
            currentFilePath,
            { line: position.lineNumber, column: position.column },
            symbolMapRef.current,
            fileContentsRef.current,
            container
          );

          if (definition) {
            return [{
              uri: monaco.Uri.parse(definition.uri),
              range: new monaco.Range(
                definition.range.startLineNumber,
                definition.range.startColumn,
                definition.range.endLineNumber,
                definition.range.endColumn
              ),
            }];
          }
        } catch (err) {
          console.error("Error finding definition:", err);
        }

        return null;
      },
    });

    monacoConfiguredRef.current = true;
  };

  // Build symbol map when container is available
  useEffect(() => {
    if (!container) return;

    let cancelled = false;

    async function buildMap() {
      try {
        const { symbolMap, fileContents } = await buildSymbolMap(container);
        if (!cancelled) {
          symbolMapRef.current = symbolMap;
          fileContentsRef.current = fileContents;
        }
      } catch (err) {
        console.error("Error building symbol map:", err);
      }
    }

    buildMap();

    return () => {
      cancelled = true;
    };
  }, [container]);

  // Rebuild symbol map when files change
  useEffect(() => {
    if (!container || !filePath) return;

    let cancelled = false;

    async function updateSymbolMap() {
      try {
        const { symbolMap, fileContents } = await buildSymbolMap(container);
        if (!cancelled) {
          symbolMapRef.current = symbolMap;
          fileContentsRef.current = fileContents;
        }
      } catch (err) {
        console.error("Error updating symbol map:", err);
      }
    }

    // Debounce updates
    const timeoutId = setTimeout(() => {
      updateSymbolMap();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [container, code]);

  useEffect(() => {
    if (!container || !filePath) {
      return;
    }

    let cancelled = false;

    // Use setTimeout to defer state updates
    const timeoutId = setTimeout(() => {
      if (mountedRef.current && !cancelled) {
        setLoading(true);
        setError(null);
      }
    }, 0);

    // Normalize file path - ensure it starts with /
    const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;

    // Read initial file content
    container.fs
      .readFile(normalizedPath, "utf-8")
      .then((content) => {
        if (!cancelled && mountedRef.current) {
          setCode(content);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && mountedRef.current) {
          console.error(`Error reading file ${normalizedPath}:`, err);
          setError(`Failed to read file: ${normalizedPath}`);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [container, filePath]);

  const handleEditorChange = async (value) => {
    setCode(value);
    if (container && filePath && value !== null) {
      try {
        // Normalize file path - ensure it starts with /
        const normalizedPath = filePath.startsWith("/")
          ? filePath
          : `/${filePath}`;
        // Write file to WebContainer
        await container.fs.writeFile(normalizedPath, value);
        onCodeChange?.(normalizedPath, value);
      } catch (err) {
        const normalizedPath = filePath.startsWith("/")
          ? filePath
          : `/${filePath}`;
        console.error(`Error writing file ${normalizedPath}:`, err);
        setError(`Failed to write file: ${normalizedPath}`);
      }
    }
  };

  if (!filePath) {
    return (
      <div style={{ padding: "20px", color: "#666" }}>
        Select a file to edit
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "20px", color: "#666" }}>Loading file...</div>
    );
  }

  if (error) {
    return <div style={{ padding: "20px", color: "#f48771" }}>{error}</div>;
  }

  const handleEditorDidMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Configure Monaco if not already configured
    configureMonaco(monacoInstance);

    // Helper function to get current file path
    const getCurrentFilePath = () => {
      const normalizedPath = filePath?.startsWith("/") ? filePath : `/${filePath || ""}`;
      return normalizedPath;
    };

    // Handle Go to Definition command (F12, Ctrl+Click)
    editor.addCommand(monacoInstance.KeyCode.F12, () => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!position || !model || !container || !symbolMapRef.current) return;

      const word = getWordAtPosition(model, position);
      if (!word) return;

      const currentFilePath = getCurrentFilePath();

      findDefinition(
        word,
        currentFilePath,
        { line: position.lineNumber, column: position.column },
        symbolMapRef.current,
        fileContentsRef.current,
        container
      ).then((definition) => {
        if (definition && onFileSelect) {
          // Navigate to the definition file
          onFileSelect(definition.filePath);

          // Set cursor position after a short delay to ensure file is loaded
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setPosition({
                lineNumber: definition.range.startLineNumber,
                column: definition.range.startColumn,
              });
              editorRef.current.revealLineInCenter(definition.range.startLineNumber);
            }
          }, 100);
        }
      }).catch((err) => {
        console.error("Error navigating to definition:", err);
      });
    });

    // Enable Ctrl+Click (Cmd+Click on Mac) for Go to Definition
    editor.onMouseDown((e) => {
      if (e.event.ctrlKey || e.event.metaKey) {
        e.event.preventDefault();
        const position = e.target.position;
        if (!position) return;

        const model = editor.getModel();
        if (!model || !container || !symbolMapRef.current) return;

        const word = getWordAtPosition(model, position);
        if (!word) return;

        const currentFilePath = getCurrentFilePath();

        findDefinition(
          word,
          currentFilePath,
          { line: position.lineNumber, column: position.column },
          symbolMapRef.current,
          fileContentsRef.current,
          container
        ).then((definition) => {
          if (definition && onFileSelect) {
            onFileSelect(definition.filePath);
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.setPosition({
                  lineNumber: definition.range.startLineNumber,
                  column: definition.range.startColumn,
                });
                editorRef.current.revealLineInCenter(definition.range.startLineNumber);
              }
            }, 100);
          }
        }).catch((err) => {
          console.error("Error navigating to definition:", err);
        });
      }
    });
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="javascript"
      language={
        filePath.endsWith(".jsx") || filePath.endsWith(".js")
          ? "javascript"
          : filePath.endsWith(".json")
          ? "json"
          : filePath.endsWith(".html")
          ? "html"
          : filePath.endsWith(".css")
          ? "css"
          : "javascript"
      }
      value={code}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      path={filePath}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        quickSuggestions: true,
        parameterHints: { enabled: true },
        hover: { enabled: true },
        definitionLinkOpensInPeek: true, // Enable peek definition
        gotoLocation: {
          multiple: "peek",
        },
      }}
    />
  );
}
