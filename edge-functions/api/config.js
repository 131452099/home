/**
 * Edge Functions - /api/config
 * Makers (EdgeOne Pages) 部署版本
 * 使用 KV 存储配置，无需 PHP 后端
 *
 * KV 绑定：变量名 HOME_KV → 命名空间
 * 注意：KV 通过变量名直接访问（全局），不是 env.HOME_KV
 */

// ========== GET：获取配置 ==========
export async function onRequestGet(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return jsonResponse({ error: 'KV_NOT_BOUND', hint: '请在项目设置中绑定 KV 命名空间，变量名：HOME_KV' }, 500);
    }

    const raw = await kv.get('homepage_config');
    if (!raw) {
      // 首次使用，返回默认配置并保存
      const defaultConfig = getDefaultConfig();
      await kv.put('homepage_config', JSON.stringify(defaultConfig));
      return jsonResponse(defaultConfig);
    }

    const config = JSON.parse(raw);
    return jsonResponse(config);
  } catch (e) {
    return jsonResponse({ error: 'GET_FAILED', message: e.message }, 500);
  }
}

// ========== POST：验证密码 / 保存配置 ==========
export async function onRequestPost(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return jsonResponse({ valid: false, error: 'KV_NOT_BOUND' });
    }

    let body;
    try {
      body = await context.request.json();
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
      if (!config) return jsonResponse({ valid: true });
      return await saveConfig(kv, body);
    }

    // 场景2：正常验证 SHA-256
    const inputHash = await sha256(password);
    if (inputHash !== storedHash) {
      return jsonResponse({ valid: false, error: 'INVALID_PASSWORD' });
    }

    // 密码正确 → 仅验证或保存配置
    if (!config) return jsonResponse({ valid: true });
    return await saveConfig(kv, body);
  } catch (e) {
    return jsonResponse({ valid: false, error: 'POST_FAILED', message: e.message }, 500);
  }
}

// ========== PUT：修改密码 ==========
export async function onRequestPut(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return jsonResponse({ error: 'KV_NOT_BOUND' }, 500);
    }

    let body;
    try {
      body = await context.request.json();
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
  } catch (e) {
    return jsonResponse({ error: 'PUT_FAILED', message: e.message }, 500);
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

// ========== 获取 KV 实例（兼容不同访问方式）==========
function getKV(context) {
  // EdgeOne Pages: KV 绑定变量名作为全局变量直接可用
  // 尝试多种方式获取 KV 实例
  if (typeof HOME_KV !== 'undefined') return HOME_KV;
  if (context.HOME_KV) return context.HOME_KV;
  if (context.env && context.env.HOME_KV) return context.env.HOME_KV;
  return null;
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

// ========== 默认配置（首次使用时写入 KV）==========
function getDefaultConfig() {
  return {
    title: "个人主页",
    subtitle: "欢迎来到我的个人主页",
    bgImage: "",
    bgColor: "#1a1a2e",
    textColor: "#ffffff",
    websites: [
      { name: "示例网站", url: "https://example.com", icon: "globe" }
    ],
    weather: { enabled: true, city: "北京" },
    music: { enabled: false, url: "" }
  };
}
