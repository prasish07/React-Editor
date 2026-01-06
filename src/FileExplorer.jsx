import { useState, useEffect, useImperativeHandle, forwardRef } from "react";

const FileExplorer = forwardRef(function FileExplorer({ container, selectedFile, onFileSelect, onFileCreate }, ref) {
  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(["/", "/pages"]));
  const [creatingItem, setCreatingItem] = useState(null);
  const [newItemName, setNewItemName] = useState("");

  useEffect(() => {
    if (!container) return;
    loadFileTree();
  }, [container]);

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refresh: loadFileTree,
  }));

  const loadFileTree = async () => {
    if (!container) return;

    try {
      const tree = await buildFileTree(container, "/");
      setFileTree(tree);
    } catch (error) {
      console.error("Error loading file tree:", error);
    }
  };

  const buildFileTree = async (container, path) => {
    const items = [];
    try {
      // WebContainer readdir returns an array of strings (file/directory names)
      const entries = await container.fs.readdir(path);

      // Debug: log what files actually exist
      if (path === "/pages") {
        console.log("Files in /pages directory:", entries);
      }

      for (const entryName of entries) {
        const fullPath = path === "/" ? `/${entryName}` : `${path}/${entryName}`;

        // Check if it's a directory by trying to readdir
        let isDirectory = false;
        try {
          await container.fs.readdir(fullPath);
          isDirectory = true;
        } catch {
          // If readdir fails, it's a file
          isDirectory = false;
        }

        const item = {
          name: entryName,
          path: fullPath,
          type: isDirectory ? "directory" : "file",
        };

        if (isDirectory) {
          item.children = await buildFileTree(container, fullPath);
        }

        items.push(item);
      }
    } catch (error) {
      console.error(`Error reading directory ${path}:`, error);
    }

    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateClick = (parentPath = "/", type = "file") => {
    setCreatingItem({ parentPath, type });
    setNewItemName("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!newItemName.trim() || !container) return;

    try {
      const fullPath =
        creatingItem.parentPath === "/"
          ? `/${newItemName}`
          : `${creatingItem.parentPath}/${newItemName}`;

      if (creatingItem.type === "directory") {
        await container.fs.mkdir(fullPath, { recursive: true });
      } else {
        await container.fs.writeFile(fullPath, "");
      }

      setCreatingItem(null);
      setNewItemName("");
      await loadFileTree();
    } catch (error) {
      console.error("Error creating item:", error);
      alert(`Failed to create ${creatingItem.type}: ${error.message}`);
    }
  };

  const handleDelete = async (path, type) => {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;
    if (!container) return;

    try {
      if (type === "directory") {
        await container.fs.rm(path, { recursive: true });
      } else {
        await container.fs.rm(path);
      }
      await loadFileTree();
      if (selectedFile === path) {
        onFileSelect(null);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert(`Failed to delete: ${error.message}`);
    }
  };

  const renderTreeItem = (item, level = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
    const indent = level * 16;

    return (
      <div key={item.path}>
        <div
          className={`file-tree-item ${isSelected ? "selected" : ""}`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={(e) => {
            if (item.type === "directory") {
              e.stopPropagation();
              toggleFolder(item.path);
            } else {
              onFileSelect(item.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span className="file-icon">
            {item.type === "directory" ? (isExpanded ? "📂" : "📁") : "📄"}
          </span>
          <span className="file-name">{item.name}</span>
          <div className="file-actions">
            {item.type === "directory" && (
              <>
                <button
                  className="file-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateClick(item.path, "file");
                  }}
                  title="New File"
                >
                  +
                </button>
                <button
                  className="file-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateClick(item.path, "directory");
                  }}
                  title="New Folder"
                >
                  📁
                </button>
              </>
            )}
            <button
              className="file-action-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.path, item.type);
              }}
              title="Delete"
            >
              ×
            </button>
          </div>
        </div>
        {item.type === "directory" && isExpanded && item.children && (
          <div>{item.children.map((child) => renderTreeItem(child, level + 1))}</div>
        )}
        {item.type === "directory" && isExpanded && creatingItem?.parentPath === item.path && (
          <div style={{ paddingLeft: `${indent + 24}px`, padding: "4px 8px" }}>
            <form onSubmit={handleCreateSubmit}>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => setCreatingItem(null)}
                autoFocus
                placeholder={creatingItem.type === "directory" ? "Folder name" : "File name"}
                style={{
                  width: "100%",
                  padding: "4px",
                  background: "#2a2d2e",
                  border: "1px solid #3e3e42",
                  color: "#d4d4d4",
                  borderRadius: "3px",
                }}
              />
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h3>Explorer</h3>
        <div className="file-explorer-actions">
          <button
            className="file-action-btn"
            onClick={() => handleCreateClick("/", "file")}
            title="New File"
          >
            +
          </button>
          <button
            className="file-action-btn"
            onClick={() => handleCreateClick("/", "directory")}
            title="New Folder"
          >
            📁
          </button>
        </div>
      </div>
      <div className="file-tree">
        {creatingItem?.parentPath === "/" && (
          <div style={{ padding: "4px 8px" }}>
            <form onSubmit={handleCreateSubmit}>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => setCreatingItem(null)}
                autoFocus
                placeholder={creatingItem.type === "directory" ? "Folder name" : "File name"}
                style={{
                  width: "100%",
                  padding: "4px",
                  background: "#2a2d2e",
                  border: "1px solid #3e3e42",
                  color: "#d4d4d4",
                  borderRadius: "3px",
                }}
              />
            </form>
          </div>
        )}
        {fileTree.map((item) => renderTreeItem(item))}
      </div>
    </div>
  );
});

export default FileExplorer;

