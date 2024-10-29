module.exports = {
  apps: [
    {
      name: "Music Server",
      exec_mode: "cluster",
      instances: 5,
      script: "ts-node-esm index.ts",
      args: "start",
      node_args: ["--max_old_space_size=16192"],
      watch: false,
      max_memory_restart: "8G",
      env: { PORT: 3000 },
    },
  ],
};
