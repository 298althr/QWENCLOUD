// backend/src/remote/ssh.js
// SSH client wrapper using ssh2. Executes a single command on a remote host
// and returns a result shape compatible with the local execute_command handler.

const { Client } = require("ssh2");

function execRemote(hostConfig, command, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const t0 = Date.now();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        client.end();
        resolve({
          exit_code: -1,
          stdout: "",
          stderr: "[timeout]",
          time_ms: Date.now() - t0,
        });
      }
    }, timeoutMs);

    client
      .on("ready", () => {
        client.exec(command, { pty: false }, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              client.end();
              reject(err);
            }
            return;
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code, signal) => {
              clearTimeout(timer);
              if (!settled) {
                settled = true;
                client.end();
                resolve({
                  exit_code: code ?? 0,
                  stdout,
                  stderr,
                  time_ms: Date.now() - t0,
                });
              }
            })
            .on("data", (data) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      })
      .connect({
        host: hostConfig.host,
        port: hostConfig.port || 22,
        username: hostConfig.user,
        privateKey: hostConfig.privateKey,
        readyTimeout: timeoutMs,
        keepaliveInterval: 0,
      });
  });
}

module.exports = { execRemote };
