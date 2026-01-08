/**
 * Utility functions for parsing JavaScript/JSX files and building symbol maps
 * to support Go to Definition and Peek Definition in Monaco Editor
 */

/**
 * Simple JavaScript/JSX parser to extract exports and imports
 * This is a lightweight parser that handles common cases
 */
export function parseJavaScriptFile(content, filePath) {
  const symbols = {
    exports: [],
    imports: [],
    functions: [],
    variables: [],
    classes: [],
  };

  const lines = content.split('\n');

  // Regular expressions for common patterns
  const exportPatterns = [
    /^export\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/,
    /^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/,
    /^export\s+class\s+(\w+)/,
    /^export\s+(?:const|let|var)\s+(\w+)/,
    /^export\s+{\s*([^}]+)\s*}/,
    /^export\s+default\s+(\w+)/,
  ];

  const importPatterns = [
    /^import\s+(?:\*\s+as\s+(\w+)|{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/,
    /^import\s+['"]([^'"]+)['"]/,
  ];

  const functionPattern = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/;
  const classPattern = /^(?:export\s+)?class\s+(\w+)/;
  const constPattern = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const lineNumber = index + 1;

    // Extract exports
    for (const pattern of exportPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        if (match[1]) {
          // Handle named exports: export { name1, name2 }
          const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
          names.forEach(name => {
            if (name) {
              symbols.exports.push({
                name: name,
                line: lineNumber,
                column: line.indexOf(name),
              });
            }
          });
        }
        break;
      }
    }

    // Extract imports
    for (const pattern of importPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const importPath = match[4] || match[1];
        if (importPath) {
          const importedNames = match[2]
            ? match[2].split(',').map(n => n.trim().split(' as ')[0].trim())
            : match[3] ? [match[3]] : match[1] ? [match[1]] : [];

          symbols.imports.push({
            names: importedNames,
            from: importPath,
            line: lineNumber,
          });
        }
        break;
      }
    }

    // Extract function declarations
    const funcMatch = trimmedLine.match(functionPattern);
    if (funcMatch && funcMatch[1]) {
      symbols.functions.push({
        name: funcMatch[1],
        line: lineNumber,
        column: line.indexOf(funcMatch[1]),
      });
    }

    // Extract class declarations
    const classMatch = trimmedLine.match(classPattern);
    if (classMatch && classMatch[1]) {
      symbols.classes.push({
        name: classMatch[1],
        line: lineNumber,
        column: line.indexOf(classMatch[1]),
      });
    }

    // Extract const/let/var declarations
    const constMatch = trimmedLine.match(constPattern);
    if (constMatch && constMatch[1]) {
      symbols.variables.push({
        name: constMatch[1],
        line: lineNumber,
        column: line.indexOf(constMatch[1]),
      });
    }
  });

  return symbols;
}

/**
 * Resolve import path to actual file path
 */
export function resolveImportPath(importPath, currentFilePath) {
  // Remove file extension if present
  if (importPath.endsWith('.js') || importPath.endsWith('.jsx')) {
    importPath = importPath.slice(0, -importPath.match(/\.(js|jsx)$/)[0].length);
  }

  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
    const pathParts = currentDir.split('/').filter(p => p);
    const importParts = importPath.split('/').filter(p => p && p !== '.');

    // Handle .. navigation
    while (importParts.length > 0 && importParts[0] === '..') {
      importParts.shift();
      if (pathParts.length > 0) {
        pathParts.pop();
      }
    }

    const resolvedPath = '/' + pathParts.concat(importParts).join('/');

    // Try with .jsx first, then .js
    return [resolvedPath + '.jsx', resolvedPath + '.js'];
  }

  // Handle absolute imports (from src/)
  if (importPath.startsWith('/')) {
    return [importPath + '.jsx', importPath + '.js'];
  }

  // Try relative to src directory
  return [`/src/${importPath}.jsx`, `/src/${importPath}.js`, `/${importPath}.jsx`, `/${importPath}.js`];
}

/**
 * Build a symbol map from all files in the project
 */
export async function buildSymbolMap(container, rootPath = '/') {
  const symbolMap = new Map(); // Map<filePath, symbols>
  const fileContents = new Map(); // Map<filePath, content>

  async function scanDirectory(path) {
    try {
      const entries = await container.fs.readdir(path);

      for (const entry of entries) {
        const fullPath = path === '/' ? `/${entry}` : `${path}/${entry}`;

        try {
          // Try to read as directory
          await container.fs.readdir(fullPath);
          // It's a directory, recurse
          await scanDirectory(fullPath);
        } catch {
          // It's a file
          if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            try {
              const content = await container.fs.readFile(fullPath, 'utf-8');
              fileContents.set(fullPath, content);
              const symbols = parseJavaScriptFile(content, fullPath);
              symbolMap.set(fullPath, symbols);
            } catch (err) {
              console.warn(`Failed to read file ${fullPath}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to scan directory ${path}:`, err);
    }
  }

  await scanDirectory(rootPath);

  return { symbolMap, fileContents };
}

/**
 * Find definition of a symbol at a given position
 */
export async function findDefinition(
  symbolName,
  currentFilePath,
  position,
  symbolMap,
  fileContents,
  container
) {
  const currentSymbols = symbolMap.get(currentFilePath);
  if (!currentSymbols) {
    return null;
  }

  // First, check if it's an import - if so, resolve the import path
  for (const imp of currentSymbols.imports) {
    if (imp.names.includes(symbolName) && position.line >= imp.line - 2 && position.line <= imp.line + 2) {
      // This is an imported symbol, resolve the import path
      const possiblePaths = resolveImportPath(imp.from, currentFilePath);

      for (const possiblePath of possiblePaths) {
        const targetSymbols = symbolMap.get(possiblePath);
        if (targetSymbols) {
          // Find the symbol in the target file
          const allSymbols = [
            ...targetSymbols.exports,
            ...targetSymbols.functions,
            ...targetSymbols.classes,
            ...targetSymbols.variables,
          ];

          const definition = allSymbols.find(s => s.name === symbolName);
          if (definition) {
            return {
              uri: `file://${possiblePath}`,
              range: {
                startLineNumber: definition.line,
                startColumn: definition.column + 1,
                endLineNumber: definition.line,
                endColumn: definition.column + symbolName.length + 1,
              },
              filePath: possiblePath,
            };
          }
        }
      }
    }
  }

  // Check if it's defined in the current file
  const allCurrentSymbols = [
    ...currentSymbols.functions,
    ...currentSymbols.classes,
    ...currentSymbols.variables,
    ...currentSymbols.exports,
  ];

  const localDefinition = allCurrentSymbols.find(s => s.name === symbolName);
  if (localDefinition) {
    return {
      uri: `file://${currentFilePath}`,
      range: {
        startLineNumber: localDefinition.line,
        startColumn: localDefinition.column + 1,
        endLineNumber: localDefinition.line,
        endColumn: localDefinition.column + symbolName.length + 1,
      },
      filePath: currentFilePath,
    };
  }

  // Search in all other files
  for (const [filePath, symbols] of symbolMap.entries()) {
    if (filePath === currentFilePath) continue;

    const allSymbols = [
      ...symbols.exports,
      ...symbols.functions,
      ...symbols.classes,
      ...symbols.variables,
    ];

    const definition = allSymbols.find(s => s.name === symbolName);
    if (definition) {
      return {
        uri: `file://${filePath}`,
        range: {
          startLineNumber: definition.line,
          startColumn: definition.column + 1,
          endLineNumber: definition.line,
          endColumn: definition.column + symbolName.length + 1,
        },
        filePath: filePath,
      };
    }
  }

  return null;
}

/**
 * Get word at position in editor
 */
export function getWordAtPosition(model, position) {
  const word = model.getWordAtPosition(position);
  if (word) {
    return word.word;
  }

  // Fallback: try to extract word manually
  const lineContent = model.getLineContent(position.lineNumber);
  const before = lineContent.substring(0, position.column - 1);
  const after = lineContent.substring(position.column - 1);

  const beforeMatch = before.match(/(\w+)$/);
  const afterMatch = after.match(/^(\w+)/);

  if (beforeMatch && afterMatch) {
    return beforeMatch[1] + afterMatch[1];
  } else if (beforeMatch) {
    return beforeMatch[1];
  } else if (afterMatch) {
    return afterMatch[1];
  }

  return null;
}

