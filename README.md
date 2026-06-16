个人主页系统
简洁美观的个人主页/导航页，支持网站展示、天气查询、音乐播放等功能。

功能特性
🎨 渐变背景、毛玻璃效果、响应式布局
🔗 网站导航卡片，支持自定义图标
🌤️ 实时天气显示
🎵 音乐播放器
🔒 密码保护的后台管理
本地开发
直接用浏览器打开 index.html 即可预览（配置修改通过 localStorage）。

bash
复制
# 或用本地服务器
npx serve .
部署到 Makers (EdgeOne Pages)
方案一：纯静态（无后台）
直接上传 index.html 到 Makers，配置通过浏览器 localStorage 存储。

缺点： 换设备后配置丢失。

方案二：边缘函数 + KV 存储（推荐）
支持后台管理，配置持久化到 KV。

第一步：推送代码到 Makers
bash
复制
git init
git add .
git commit -m "初始提交"
# 在 Makers 控制台关联仓库并部署
或直接拖拽上传项目文件（不含 api/ PHP 文件夹）。

第二步：绑定 KV 存储
进入 Makers 项目控制台
左侧菜单找到 「KV 存储」
点击 「创建命名空间」，名称随意（如 homepage-kv）
进入 「项目设置」→「变量绑定」
添加 KV 绑定：
变量名： HOME_KV
命名空间： 选择刚才创建的
⚠️ 重要： 绑定完成后需重新部署才会生效！

第三步：初始化密码
用 Makers 控制台的 KV 管理工具，添加一条记录：

Key	Value
config_password	240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
这是 admin123 的 SHA-256 哈希值，可自行用 echo -n "你的密码" | sha256sum 生成。

同时添加默认配置（可选，首次登录会自动写入）：

Key	Value
homepage_config	{"title":"我的主页","subtitle":"欢迎","bgColor":"#1a1a2e","textColor":"#ffffff","websites":[],"weather":{"enabled":true,"city":"北京"},"music":{"enabled":false,"url":""}}
第四步：访问
前台：https://你的域名/
后台：https://你的域名/admin.html
登录密码：admin123
KV 访问方式说明（重要）
EdgeOne Pages 的 KV 绑定不是通过 env.HOME_KV 访问的！

正确写法（变量名作为全局对象）：

javascript
复制
// ✅ 正确
const value = await HOME_KV.get('key');

// ❌ 错误（Cloudflare Workers 写法，EO Pages 不适用）
const value = await env.HOME_KV.get('key');
文件结构
personal-homepage/
├── index.html              # 前台主页
├── admin.html             # 后台管理
├── edge-functions/
│   └── api/
│       └── config.js     # 边缘函数（Makers 部署用）
├── api/
│   └── config.php        # PHP 后端（虚拟主机部署用）
└── MAKERS_DEPLOY.md     # Makers 部署说明
虚拟主机部署（PHP 版本）
如果用传统虚拟主机（支持 PHP），用 PHP 版本：

上传 index.html、admin.html、api/ 文件夹
访问 https://你的域名/admin.html
首次登录密码：admin123
后台会自动修改 api/config.dat 的密码哈希
注意：api/config.php 需要 password_hash() 函数支持（PHP 5.5+）

常见问题
登录提示「密码错误」
检查 KV 里 config_password 的值是否正确
确认 KV 绑定变量名是 HOME_KV（区分大小写）
绑定后必须重新部署
边缘函数报错 KV_NOT_BOUND
KV 绑定没有生效，检查变量名是否正确
确认部署是在绑定 KV 之后触发的
修改配置后不生效
检查 KV 是否绑定成功
在浏览器访问 https://你的域名/api/config 看是否返回 JSON
修改密码
登录后台 → 右上角「修改密码」→ 输入旧密码和新密码。

自定义
修改背景图
后台 → 「背景设置」→ 填入图片 URL（留空则使用随机 API）

添加网站链接
后台 → 「网站管理」→ 添加名称、URL、图标

图标名称参考 Font Awesome：https://fontawesome.com/icons

技术栈
前端：原生 HTML/CSS/JS
后端（可选）：PHP 或 EdgeOne 边缘函数
存储：KV 或 localStorage
