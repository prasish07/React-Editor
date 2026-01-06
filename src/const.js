export const files = {
  "package.json": {
    file: {
      contents: `{
  "name": "react-vite-app",
  "private": true,
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}`,
    },
  },
  "index.html": {
    file: {
      contents: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`,
    },
  },
  "vite.config.js": {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    strictPort: true
  }
})`,
    },
  },
  "main.jsx": {
    file: {
      contents: `import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);`,
    },
  },
  "App.jsx": {
    file: {
      contents: `import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/home";
import About from "./pages/about";
import Contact from "./pages/contact";

function App() {
  const location = useLocation();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          background: "#2a2d2e",
          padding: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Link
            to="/"
            style={{
              color: location.pathname === "/" ? "#4a9eff" : "#d4d4d4",
              textDecoration: "none",
              marginRight: "2rem",
              fontWeight: location.pathname === "/" ? "bold" : "normal",
            }}
          >
            Home
          </Link>
          <Link
            to="/about"
            style={{
              color: location.pathname === "/about" ? "#4a9eff" : "#d4d4d4",
              textDecoration: "none",
              marginRight: "2rem",
              fontWeight: location.pathname === "/about" ? "bold" : "normal",
            }}
          >
            About
          </Link>
          <Link
            to="/contact"
            style={{
              color: location.pathname === "/contact" ? "#4a9eff" : "#d4d4d4",
              textDecoration: "none",
              fontWeight: location.pathname === "/contact" ? "bold" : "normal",
            }}
          >
            Contact
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1rem" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;`,
    },
  },
  "pages/home.jsx": {
    file: {
      contents: `export default function Home() {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to the home page!</p>
      <p>This is a React app running in WebContainer with React Router.</p>
    </div>
  );
}`,
    },
  },
  "pages/about.jsx": {
    file: {
      contents: `export default function About() {
  return (
    <div>
      <h1>About Page</h1>
      <p>This is the about page.</p>
      <p>Learn more about our application here.</p>
    </div>
  );
}`,
    },
  },
  "pages/contact.jsx": {
    file: {
      contents: `export default function Contact() {
  return (
    <div>
      <h1>Contact Page</h1>
      <p>Get in touch with us!</p>
      <form style={{ marginTop: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Name:
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Email:
          </label>
          <input
            type="email"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Message:
          </label>
          <textarea
            rows="5"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "0.5rem 2rem",
            background: "#4a9eff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}`,
    },
  },
};
