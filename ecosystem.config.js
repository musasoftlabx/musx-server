module.exports = {
  apps: [
    {
      name: "Server",
      exec_mode: "cluster",
      instances: Math.ceil((require("os").cpus().length * 100) / 100),
      script: "index.ts",
      args: "start",
      node_args: ["--max_old_space_size=16192"],
      watch: false,
      max_memory_restart: "8G",
      env: { PORT: 3000 },
    },
  ],
};
