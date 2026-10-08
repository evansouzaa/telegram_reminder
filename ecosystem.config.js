module.exports = {
  apps: [
    {
      name: "telegram-reminder-web",
      script: require.resolve("next/dist/bin/next"),
      interpreter: "node",
      args: "start",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
      env: {
        PORT: process.env.PORT || "3000",
      },
    },
    {
      name: "telegram-reminder-worker",
      script: require.resolve("tsx/cli"),
      interpreter: "node",
      args: ["src/server/worker.ts"],
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
    },
  ],
};
