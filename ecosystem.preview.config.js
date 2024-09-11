module.exports = {
  apps: [
    {
      name: "IfcLCA-App-Preview",
      script: "/var/www/preview/server.js",
      env: {
        NODE_ENV: "preview",
        PORT: process.env.PORT || 3000,
        DATABASE_URL: process.env.DATABASE_URL || "",
        SESSION_SECRET: process.env.SESSION_SECRET || "",
        EMAIL_USER: process.env.EMAIL_USER || "",
        EMAIL_PASS: process.env.EMAIL_PASS || "",
        PYTHON_CMD: process.env.PYTHON_CMD || "/opt/miniconda3/bin/python3",
        BASE_URL: process.env.BASE_URL || "https://ifclca.com/preview",
      },
    },
  ],
};
