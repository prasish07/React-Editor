import { useState, useEffect, useRef } from "react";

export default function Preview({ previewUrl, onRouteChange }) {
  const [error, setError] = useState(null);
  const [currentRoute, setCurrentRoute] = useState("/");
  const prevUrlRef = useRef(previewUrl);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (prevUrlRef.current !== previewUrl) {
      prevUrlRef.current = previewUrl;
      // Reset error when URL changes
      setTimeout(() => setError(null), 0);
    }
  }, [previewUrl]);

  // Listen for route changes from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from our iframe
      if (event.data && event.data.type === "route-change") {
        const route = event.data.path || "/";
        setCurrentRoute(route);
        if (onRouteChange) {
          onRouteChange(route);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onRouteChange]);

  if (!previewUrl) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#666",
          fontSize: "16px",
          gap: "10px",
        }}
      >
        <div>Starting dev server...</div>
        <div style={{ fontSize: "12px", color: "#858585" }}>
          Check the terminal for progress
        </div>
      </div>
    );
  }

  const fullUrl = previewUrl ? `${previewUrl}${currentRoute === "/" ? "" : currentRoute}` : "";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {error && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            right: "10px",
            background: "#c93c37",
            color: "white",
            padding: "10px",
            borderRadius: "4px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          Error loading preview: {error}
        </div>
      )}
      {previewUrl && currentRoute !== "/" && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            zIndex: 1000,
            fontFamily: "monospace",
          }}
        >
          Route: {currentRoute}
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={previewUrl}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title="Preview"
        onError={(e) => {
          console.error("Iframe error:", e);
          setError("Failed to load preview");
        }}
        onLoad={() => {
          setError(null);
          // Try to get initial route from iframe
          try {
            if (iframeRef.current?.contentWindow) {
              // Inject script to track route changes
              const script = `
                (function() {
                  const originalPushState = history.pushState;
                  const originalReplaceState = history.replaceState;

                  function notifyRouteChange() {
                    window.parent.postMessage({
                      type: 'route-change',
                      path: window.location.pathname
                    }, '*');
                  }

                  history.pushState = function() {
                    originalPushState.apply(history, arguments);
                    notifyRouteChange();
                  };

                  history.replaceState = function() {
                    originalReplaceState.apply(history, arguments);
                    notifyRouteChange();
                  };

                  window.addEventListener('popstate', notifyRouteChange);
                  notifyRouteChange(); // Initial route
                })();
              `;
              iframeRef.current.contentWindow.eval(script);
            }
          } catch (e) {
            // Cross-origin or other error, that's okay
            console.log("Could not inject route tracking:", e);
          }
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
