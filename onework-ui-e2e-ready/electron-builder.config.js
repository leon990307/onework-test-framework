module.exports = {
  appId: "com.onework.e2e-demo",
  productName: "OneworkDemo",
  directories: {
    app: "demo-electron-app",
    output: "dist"
  },
  files: [
    "main.js",
    "renderer/**/*",
    "package.json"
  ],
  win: {
    target: "dir"
  },
  asar: false
};
