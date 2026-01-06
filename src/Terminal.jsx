import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const WebTerminal = forwardRef(function WebTerminal({ container }, ref) {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const processRef = useRef(null);

  // Expose write method to parent
  useImperativeHandle(ref, () => ({
    write: (data) => {
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.write(data);
      }
    },
  }));

  useEffect(() => {
    if (!container || !terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
      },
      fontSize: 14,
      fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.open(terminalRef.current);
    fitAddon.fit();
    terminalInstanceRef.current = term;

    // Spawn bash process
    container.spawn("bash").then((proc) => {
      processRef.current = proc;

      // Pipe output to terminal
      proc.output.pipeTo(
        new WritableStream({
          write(data) {
            term.write(data);
          },
        })
      );

      // Pipe terminal input to process
      term.onData((data) => {
        if (proc.input && !proc.killed) {
          proc.input.write(data);
        }
      });

      // Handle process exit
      proc.exit.then(() => {
        term.write("\r\nProcess exited.\r\n");
        // Restart bash if it exits
        setTimeout(() => {
          if (container && terminalRef.current) {
            container.spawn("bash").then((newProc) => {
              processRef.current = newProc;
              newProc.output.pipeTo(
                new WritableStream({
                  write(data) {
                    term.write(data);
                  },
                })
              );
              term.onData((data) => {
                if (newProc.input && !newProc.killed) {
                  newProc.input.write(data);
                }
              });
            });
          }
        }, 1000);
      });
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (processRef.current && !processRef.current.killed) {
        processRef.current.kill();
      }
      term.dispose();
    };
  }, [container]);

  return (
    <div
      ref={terminalRef}
      style={{
        height: "100%",
        width: "100%",
        padding: "10px",
        boxSizing: "border-box",
      }}
    />
  );
});

export default WebTerminal;
