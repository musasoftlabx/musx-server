module.exports = {
  apps: [
    {
      name: "Music Server",
      exec_mode: "cluster",
      instances: 6,
      script: "ts-node-esm index.ts",
      args: "start",
      node_args: ["--max_old_space_size=4096 --time"],
      watch: false,
      max_memory_restart: "4G",
      env: { PORT: 3000 },
    },
  ],
};
