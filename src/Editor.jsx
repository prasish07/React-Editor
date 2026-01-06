import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";

export default function CodeEditor({ container, filePath, onCodeChange }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
      }}
    />
  );
}
