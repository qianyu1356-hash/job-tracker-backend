module.exports = {
  service: {
    name: "express-jhwc", // 和你云托管的服务名保持一致
    port: 80, // 你的服务端口
    volumes: [
      {
        name: "app-data-volume", // 自定义的存储卷名称
        mountPath: "/app/data", // 挂载到容器内的路径，和你的data文件夹对应
        type: "persistent" // 持久化存储类型
      }
    ]
  }
};