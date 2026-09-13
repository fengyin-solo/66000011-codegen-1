# solo-6600001 - 在线协作白板应用

## 项目简介
构建一个在线协作白板应用，支持多人实时绘图、便签、形状工具，具备画布缩放/平移、图层管理、实时光标显示、导出为PNG/PDF功能，使用WebSocket实现多人同步

## 技术栈
- **前端**: React + TypeScript + Canvas API + Zustand
- **后端**: Node.js + Express + Socket.io
- **数据库**: MongoDB

## 快速开始

### 服务端
```bash
cd server
npm install
npm run dev
```

### 客户端
```bash
cd client
npm install
npm run dev
```

## 功能特性
- 多人实时协作绘图
- 画笔、矩形、圆形、直线、文本工具
- 便签功能
- 图层管理（新建、可见性、锁定）
- 实时光标显示
- 画布缩放/平移
- WebSocket实时同步
