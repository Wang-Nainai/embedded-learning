# 嵌入式与计算机技术教程

> 从 C 语言基础到嵌入式系统与网络通信。

一套面向学习者与工程实践者的开源教程。五册相互独立、可单独阅读，也可以按推荐路线循序学习；全部为单文件 HTML，下载后离线可用。

## 项目目标

市面上的资料常常停在两端：要么只讲语法，要么直接跳到芯片手册。中间那段“为什么这样写、什么时候会出错、怎么验证”很少有人讲清楚。本项目试图补上这一段，用一条连续的主线把 **语言 → 硬件 → 系统 → 通信 → 网络** 串起来。

- 对零基础读者：从第一行 C 开始，不假设你学过单片机。
- 对本科学生：可配合 C 语言、单片机、操作系统与网络课程使用。
- 对自学者：用课程地图、自测题和速查表补齐零散知识。
- 对嵌入式实践者：查寄存器、位操作、队列、协议帧与排错思路。

## 五门教程

| 册 | 教程 | 内容 | 规模 |
|---|---|---|---|
| 01 | [C 语言基础教程](courses/C语言基础教程.html) | 编译链接、类型与数值、控制流程、函数与栈帧、数组与字符串、指针、结构体、多文件工程、动态内存、递归与链表、通讯录项目 | 13 讲 + 附录 |
| 02 | [嵌入式 C 语言进阶教程](courses/嵌入式C语言进阶教程.html) | 启动与内存映射、寄存器与位操作、const/volatile/static、整数宽度、对齐与字节序、函数指针、状态机、环形缓冲区、中断共享数据、优化与未定义行为 | 13 讲 + 附录 |
| 03 | [FreeRTOS 实时操作系统教程](courses/FreeRTOS实时操作系统教程.html) | 任务与调度、tick 与周期任务、队列、信号量、互斥量与优先级继承、事件组与任务通知、中断通信、临界区、软件定时器、内存与栈、故障排查 | 14 讲 + 附录 |
| 04 | [嵌入式通信协议教程](courses/嵌入式通信协议教程.html) | 分层与电平、UART、I²C、SPI、CAN、RS-485、Modbus RTU、自定义二进制协议、粘包分片与校验、逻辑分析仪调试 | 10 讲 + 附录 |
| 05 | [计算机网络教程](courses/计算机网络教程.html) | 分层与封装、以太网与交换机、IPv4 与子网、ARP 与路由、UDP/TCP、DNS/DHCP/NAT、HTTP/HTTPS/TLS、MQTT、Wi-Fi 与 IPv6、网络调试 | 11 讲 + 附录 |

合计 61 讲、31 个交互实验、217 个代码块、61 道带解析的自测题。

## 在线阅读

部署到 GitHub Pages 后，入口为：

- 教程门户：`https://wang-nainai.github.io/embedded-learning/`
- 五册教程：门户首页的课程卡片，或 `courses/` 目录下的对应 HTML

> 以上为部署后的预期地址；是否可访问以仓库 Pages 的实际配置与部署状态为准。

## 本地打开

不需要安装任何依赖：

```bash
git clone https://github.com/Wang-Nainai/embedded-learning.git
cd embedded-learning
```

- 直接双击 `index.html`，或把整个目录拖进浏览器。
- 五册教程在 `courses/` 下，也可以单独复制出来离线阅读。
- 所有 CSS、JavaScript、SVG 都内嵌在 HTML 中，不依赖 CDN、在线字体或远程脚本。

## 项目结构

```text
embedded-learning/
├── index.html                  # 教程门户
├── courses/                    # 五册教程（单文件 HTML）
├── assets/
│   ├── portal.css              # 门户样式
│   └── portal.js               # 门户交互
├── _src/                       # 教程构建源码（可选，维护用）
│   ├── build.py
│   ├── check.py
│   ├── assets/                 # 教程共享样式、脚本、实验
│   └── courses/                # 各册 meta.json 与章节片段
├── AUDIT_REPORT.md             # 质量审计记录
├── CHANGELOG.md
├── LICENSE                     # 教程内容：CC BY 4.0
├── LICENSE-CODE                # 构建脚本：MIT
└── .github/workflows/pages.yml # GitHub Pages 部署
```

## 构建与检查（可选）

教程成品已经提交，日常阅读不需要构建。修改章节片段后重新生成：

```bash
cd _src
python build.py            # 重新生成 courses/ 下的五份 HTML
python build.py c-basics   # 只生成某一册
```

`check.py` 会做 HTML 结构检查，并把可独立运行的 C 示例编译后运行（需要本机有 Clang/GCC；当前脚本默认通过 `python -m ziglang` 调用 Clang）：

```bash
python check.py
```

## GitHub Pages 部署

仓库已包含 `.github/workflows/pages.yml`，采用 GitHub Actions 发布静态文件：

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送到 `main` 分支后，工作流会自动上传整个仓库并发布。
4. 在 **Actions** 中确认 `deploy` 成功，再访问 Pages 地址。

如果不想用 Actions，也可以把 Source 改为 **Deploy from a branch**，选择 `main` / `root`。两种方式都不要删除 `.nojekyll`。

## 反馈与贡献

- 发现技术错误、错别字或失效链接：请开 [Issue](https://github.com/Wang-Nainai/embedded-learning/issues)，注明教程、章节与具体位置。
- 改进内容：欢迎 Pull Request。请保持“先解释原理、再给代码、最后验证”的写法，并在提交前运行 `python check.py`。
- 涉及硬件、RTOS 或总线的修改，请说明验证平台与条件；没有实测的内容不要写成“已验证”。

## 许可证

- **教程正文、插图与交互内容**：采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可，转载或改编请保留作者署名与项目链接。
- **构建脚本与门户代码**（`_src/`、`assets/`、`index.html` 中的脚本）：采用 MIT 许可，详见 `LICENSE-CODE`。

教程中的 C 代码示例属于教学内容，随正文一起按 CC BY 4.0 提供；如果你需要把其中某段代码用于软件项目，也可以按 MIT 使用。

## 致谢

这套教程的内容组织、示例与交互经过多轮审校；仍难免有疏漏，欢迎指出。
