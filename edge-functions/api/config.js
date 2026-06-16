/**
 * Edge Functions - /api/config
 * 代理模式：将请求转发到 PHP 后端 (api.600060.xyz)
 * 这样无需 KV，配置正常持久化，密码验证走 PHP bcrypt
 *
 * 部署：将本项目推送到 Makers 即可
 * 依赖：api.600060.xyz 的 PHP 后端正常运行
 */

// PHP 后端地址（你的虚拟主机上的 API）
const PHP_API = 'https://api.600060.xyz/api/config.php';

// ========== GET：获取配置（代理到 PHP 后端）==========
export async function onRequestGet(context) {
  try {
    const response = await fetch(PHP_API, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Makers-Edge-Function',
      },
    });

    if (!response.ok) {
      // PHP 后端不可用，返回默认配置
      return jsonResponse(getDefaultConfig());
    }

    const data = await response.json();
    return jsonResponse(data);
  } catch (e) {
    // 网络错误，返回默认配置
    return jsonResponse(getDefaultConfig());
  }
}

// ========== POST：验证密码 / 保存配置（代理到 PHP 后端）==========
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const response = await fetch(PHP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Makers-Edge-Function',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return jsonResponse(data, response.status);
  } catch (e) {
    return jsonResponse({
      valid: false,
      error: 'PHP_API_UNREACHABLE',
      message: '无法连接 PHP 后端，请确认 api.600060.xyz 正常运行',
      detail: String(e.message),
    }, 503);
  }
}

// ========== PUT：修改密码（代理到 PHP 后端）==========
export async function onRequestPut(context) {
  try {
    const body = await context.request.json();

    const response = await fetch(PHP_API, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Makers-Edge-Function',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return jsonResponse(data, response.status);
  } catch (e) {
    return jsonResponse({
      error: 'PHP_API_UNREACHABLE',
      message: '无法连接 PHP 后端',
    }, 503);
  }
}

export function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ========== 辅助函数 ==========
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ========== 默认配置（PHP 后端不可用时的降级）==========
function getDefaultConfig() {
  return {
    site: {
      title: "个人主页",
      bgApi: "https://www.dmoe.cc/random.php",
      bgRefresh: 60,
      accent: "#7c5cfc",
      musicEnabled: true,
      musicUrl: "__BUILTIN__",
      musicTitle: "音乐",
      weatherCity: "北京",
      weatherLat: 39.9,
      weatherLon: 116.4,
      weatherAuto: false,
    },
    user: {
      name: "风栖十月",
      avatar: "https://api.600060.xyz/acg",
      motto: "热爱生活，热爱技术",
      about: "一个热爱技术与创意的开发者，喜欢探索未知的世界。<br>在这里记录生活的点滴，分享技术的乐趣。",
      skills: ["PHP", "iOS", "前端", "服务器运维", "API开发"],
    },
    contacts: [
      { icon: "fab fa-qq", label: "QQ", value: "123456789", link: "" },
      { icon: "fab fa-weixin", label: "微信", value: "WeChat_ID", link: "" },
      { icon: "fas fa-envelope", label: "邮箱", value: "admin@600060.xyz", link: "mailto:admin@600060.xyz" },
      { icon: "fab fa-github", label: "GitHub", value: "github.com/xxx", link: "https://github.com/xxx" },
    ],
    websites: [
      { label: "主页", icon: "fas fa-home", link: "" },
      { label: "博客", icon: "fas fa-blog", link: "https://blog.600060.xyz" },
      { label: "工具", icon: "fas fa-tools", link: "https://tool.600060.xyz" },
    ],
    footer: {
      copyright: "© 2026 风栖十月. All Rights Reserved.",
      icp: "",
      icpLink: "",
      police: "",
      policeLink: "",
    },
  };
}
