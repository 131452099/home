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

  // 先检查 KV 是否绑定
  if (!kv) {
    return jsonResponse({ valid: false, error: 'KV_NOT_BOUND', hint: '请在 Makers 项目设置中绑定 KV 命名空间，变量名：HOME_KV' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ valid: false, error: 'INVALID_JSON' });
  }

  const { password, config } = body;

  if (!password) {
    return jsonResponse({ valid: false, error: 'PASSWORD_REQUIRED' });
  }

  // 获取存储的密码哈希
  const storedHash = (await kv.get('config_password') || '').trim();

  // 场景1：KV 中没有设置密码 → admin123 可直接通过（首次初始化）
  if (!storedHash && password === 'admin123') {
    if (!config) return jsonResponse({ valid: true, _debug: '首次使用，admin123 直接通过' });
    return await saveConfig(kv, body);
  }

  // 场景2：正常验证 SHA-256
  const inputHash = await sha256(password);
  if (inputHash !== storedHash) {
    return jsonResponse({
      valid: false,
      error: 'INVALID_PASSWORD',
      _debug: { hasStoredHash: !!storedHash, inputPrefix: inputHash.substring(0, 8) + '...', storedPrefix: storedHash ? storedHash.substring(0, 8) + '...' : '(空)' }
    });
  }

  // 密码正确 → 仅验证或保存配置
  if (!config) return jsonResponse({ valid: true });
  return await saveConfig(kv, body);
}

// ========== 保存配置 ==========
async function saveConfig(kv, body) {
  const { config, newPassword } = body;
  try {
    if (typeof config !== 'object') throw new Error('config must be an object');
    await kv.put('homepage_config', JSON.stringify(config));

    if (newPassword) {
      const newHash = await sha256(newPassword);
      await kv.put('config_password', newHash);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: 'SAVE_FAILED', message: e.message });
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

  // 验证旧密码
  const storedHash = (await kv.get('config_password') || '').trim();
  const oldHash = await sha256(oldPassword);
  if (oldHash !== storedHash) {
    return jsonResponse({ error: 'INVALID_OLD_PASSWORD' }, 401);
  }

  // 计算新密码 hash 并保存
  const newHash = await sha256(newPassword);
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

async function sha256(str) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
