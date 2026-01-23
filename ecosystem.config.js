module.exports = {
  apps: [
    {
      name: "Music Server",
      exec_mode: "cluster",
      instances: "max",
      script: "ts-node index.ts",
      args: "start",
      node_args: ["--max_old_space_size=2048 --time"],
      watch: false,
      max_memory_restart: "4G",
      //env: { PORT: 3000 },
    },
  ],
};
