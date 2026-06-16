/**
 * Edge Functions - /api/config
 * 替代原 api/config.php，使用 KV 存储配置
 *
 * 部署步骤：
 * 1. 在 Makers 项目设置中创建 KV 命名空间
 * 2. 将命名空间绑定到本项目，变量名填：HOME_KV
 * 3. 在 KV 中手动写入两条记录：
 *    - config_password : 密码的 SHA-256 hash（hex 字符串）
 *      生成方式：浏览器控制台运行
 *        await crypto.subtle.digest('SHA-256', new TextEncoder().encode('admin123')).then(h=>Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''))
 *    - homepage_config  : 默认配置的 JSON 字符串（见底部 getDefaultConfig）
 *
 * 路由：/edge-functions/api/config.js → 可通过 /api/config 访问
 */

export async function onRequestGet(context) {
  const { env } = context;
  const kv = env.HOME_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV_NOT_BOUND', hint: '请在项目设置中绑定 KV 命名空间，变量名：HOME_KV' }, 500);
  }

  const raw = await kv.get('homepage_config');
  if (!raw) {
    // 未初始化，返回默认配置
    const defaultConfig = getDefaultConfig();
    return jsonResponse(defaultConfig);
  }

  try {
    const config = JSON.parse(raw);
    return jsonResponse(config);
  } catch (e) {
    return jsonResponse({ error: 'CONFIG_CORRUPT', detail: e.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.HOME_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV_NOT_BOUND' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'INVALID_JSON' }, 400);
  }

  const { password, config } = body;

  if (!password) {
    return jsonResponse({ error: 'PASSWORD_REQUIRED' }, 401);
  }

  // 验证密码
  const valid = await verifyPassword(kv, password);
  if (!valid) {
    return jsonResponse({ valid: false, error: 'INVALID_PASSWORD' }, 401);
  }

  // 仅验证密码（不传 config）
  if (!config) {
    return jsonResponse({ valid: true });
  }

  // 保存配置（含可选密码修改）
  try {
    if (typeof config !== 'object') throw new Error('config must be an object');
    await kv.put('homepage_config', JSON.stringify(config));

    // 同时修改密码
    if (body.newPassword) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(body.newPassword));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      await kv.put('config_password', newHash);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: 'SAVE_FAILED', message: e.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const kv = env.HOME_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV_NOT_BOUND' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'INVALID_JSON' }, 400);
  }

  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword) {
    return jsonResponse({ error: 'BOTH_PASSWORDS_REQUIRED' }, 400);
  }

  const valid = await verifyPassword(kv, oldPassword);
  if (!valid) {
    return jsonResponse({ error: 'INVALID_OLD_PASSWORD' }, 401);
  }

  // 计算新密码 hash 并保存
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  await kv.put('config_password', newHash);
  return jsonResponse({ success: true });
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

async function verifyPassword(kv, password) {
  const storedHash = await kv.get('config_password');
  if (!storedHash) {
    // 首次使用：如果 KV 里没有密码，默认 "admin123" 可通过验证
    // 强烈建议部署后立即修改密码
    return password === 'admin123';
  }

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return inputHash === storedHash;
}

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
      weatherAuto: false
    },
    user: {
      name: "风栖十月",
      avatar: "https://api.600060.xyz/acg",
      motto: "热爱生活，热爱技术",
      about: "一个热爱技术与创意的开发者，喜欢探索未知的世界。<br>在这里记录生活的点滴，分享技术的乐趣。",
      skills: ["PHP", "iOS", "前端", "服务器运维", "API开发"]
    },
    contacts: [
      { icon: "fab fa-qq", label: "QQ", value: "123456789", link: "" },
      { icon: "fab fa-weixin", label: "微信", value: "WeChat_ID", link: "" },
      { icon: "fas fa-envelope", label: "邮箱", value: "admin@600060.xyz", link: "mailto:admin@600060.xyz" },
      { icon: "fab fa-github", label: "GitHub", value: "github.com/xxx", link: "https://github.com/xxx" }
    ],
    websites: [
      { label: "主页", icon: "fas fa-home", link: "" },
      { label: "博客", icon: "fas fa-blog", link: "https://blog.600060.xyz" },
      { label: "工具", icon: "fas fa-tools", link: "https://tool.600060.xyz" }
    ],
    footer: {
      copyright: "© 2026 风栖十月. All Rights Reserved.",
      icp: "",
      icpLink: "",
      police: "",
      policeLink: ""
    }
  };
}
