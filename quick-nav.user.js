// ==UserScript==
// @name         Leomxiao加速器
// @namespace    http://tampermonkey.net/
// @version      4.3.1
// @description  在所有网页右下角显示常用工具快捷导航按钮，竖状排列，一键跳转。含恶意改名自动查询功能（Ant Design弹窗+Element UI输入框适配）。
// @author       leomxiao
// @match        *://*/*
// @match        file:///*
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ===================== iframe 检测 =====================
  // 如果当前脚本运行在 iframe 中（而非顶层窗口），则不创建导航按钮
  // 避免在登录框、嵌入页面等 iframe 中重复出现按钮
  let isInIframe = false;
  try {
    isInIframe = (window.self !== window.top);
  } catch (e) {
    // 跨域 iframe 中访问 window.top 会抛出 SecurityError，说明一定在 iframe 中
    isInIframe = true;
  }
  if (isInIframe) {
    console.log('[快捷导航] 检测到 iframe 环境，跳过导航按钮创建');
    return; // 直接退出，不注入任何UI
  }

  // ===================== 按钮配置 =====================
  const NAV_ITEMS = [
    {
      label: '🏠 主页',
      url: 'file:///C:/Users/leomxiao/CodeBuddy/20260324155943/index.html',
      color: '#6366f1', // indigo
    },
    {
      label: '🔍 查询频道',
      url: 'https://admin.qqchannel.woa.com/xy/app/prod/qq_channel/search_guild',
      color: '#3b82f6', // blue
    },
    {
      label: '🔄 转换频道号',
      url: 'https://admin.qqchannel.woa.com/xy/app/prod/qq_channel/guild_num_to_id',
      color: '#0ea5e9', // sky
    },
    {
      label: '📋 入驻审核',
      url: 'https://qgame.woa.com/wuji/xy/app/prod/open_sop/game-apply',
      color: '#10b981', // emerald
    },
    {
      label: '📦 内嵌审核',
      url: 'https://qgame.woa.com/wuji/xy/app/prod/open_sop/act_board_review',
      color: '#f59e0b', // amber
    },
    {
      label: '🔢 ID转频道号',
      url: 'https://admin.qqchannel.woa.com/xy/app/prod/qq_channel/search_guild',
      color: '#8b5cf6', // violet
      special: 'id_to_channel', // 标记为特殊按钮
    },
    {
      label: '🚨 恶意改名查询',
      url: 'https://beacon.woa.com/datatalk/shouq/card/38474',
      color: '#ef4444', // red
      special: 'malicious_rename', // 标记为特殊按钮
    },
  ];

  // ===================== 样式注入 =====================
  GM_addStyle(`
    /* ===== 导航容器 ===== */
    #quick-nav-container {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      user-select: none;
      pointer-events: none; /* 容器不拦截事件，让子元素决定 */
      /* 关键修复：容器只包裹内容大小，不占多余空间 */
      width: fit-content;
      height: fit-content;
    }

    /* ===== 展开/收起触发按钮 ===== */
    #quick-nav-toggle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      z-index: 10;
      pointer-events: auto;
    }

    #quick-nav-toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
    }

    /* 收起状态时的触发按钮 */
    #quick-nav-toggle.active {
      transform: rotate(45deg);
      background: linear-gradient(135deg, #ef4444, #f97316);
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45);
    }

    #quick-nav-toggle.active:hover {
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
    }

    /* ===== 按钮面板 ===== */
    #quick-nav-panel {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 12px;
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: none; /* 面板本身不拦截事件，只有按钮拦截 */
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  margin-bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      /* 展开时正常显示 */
      visibility: visible;
      max-height: 800px;
      overflow: visible;
    }

    #quick-nav-panel.hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      /* 关键修复：收起时完全不占空间，不阻挡底层页面交互 */
      visibility: hidden;
      max-height: 0;
      overflow: hidden;
      margin-bottom: 0;
    }

    /* ===== 导航按钮 ===== */
    .quick-nav-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: none;
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.3px;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }

    #quick-nav-panel.hidden .quick-nav-btn {
      opacity: 0;
      transform: translateX(30px);
      pointer-events: none; /* 收起时按钮不拦截事件 */
    }

    /* 逐个延迟出现动画 */
    .quick-nav-btn:nth-child(1) { transition-delay: 0.03s; }
    .quick-nav-btn:nth-child(2) { transition-delay: 0.07s; }
    .quick-nav-btn:nth-child(3) { transition-delay: 0.11s; }
    .quick-nav-btn:nth-child(4) { transition-delay: 0.15s; }
    .quick-nav-btn:nth-child(5) { transition-delay: 0.19s; }
    .quick-nav-btn:nth-child(6) { transition-delay: 0.23s; }
    .quick-nav-btn:nth-child(7) { transition-delay: 0.27s; }

    .quick-nav-btn:hover {
      transform: translateX(-4px) scale(1.03);
      box-shadow: 0 5px 18px rgba(0, 0, 0, 0.25);
      filter: brightness(1.1);
    }

    .quick-nav-btn:active {
      transform: scale(0.97);
    }
  `);

  // ===================== 创建 DOM =====================
  const container = document.createElement('div');
  container.id = 'quick-nav-container';

  // 按钮面板
  const panel = document.createElement('div');
  panel.id = 'quick-nav-panel';

  NAV_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'quick-nav-btn';
    btn.textContent = item.label;
    btn.style.background = `linear-gradient(135deg, ${item.color}, ${adjustColor(item.color, 25)})`;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 特殊按钮：ID转频道号 - 先读取剪贴板验证后跳转
      if (item.special === 'id_to_channel') {
        try {
          const clipText = await navigator.clipboard.readText();
          if (!clipText || !clipText.trim()) {
            alert('⚠️ 剪贴板为空！\n\n请先复制一个15~20位的纯数字频道ID再点击此按钮。');
            return;
          }
          // 支持多行输入：换行分隔的多个ID
          const lines = clipText.trim().split(/[\r\n]+/).map(s => s.trim()).filter(s => s.length > 0);
          // 校验每行：都必须是15~20位纯数字
          const invalidLines = lines.filter(s => !/^\d{15,20}$/.test(s));
          if (lines.length === 0) {
            alert('⚠️ 剪贴板为空！\n\n请先复制一个或多个15~20位的纯数字频道ID（换行分隔）再点击此按钮。');
            return;
          }
          if (invalidLines.length > 0) {
            alert('⚠️ 剪贴板中有不符合格式的内容！\n\n要求：每行一个15~20位纯数字\n不合格的行：\n' + invalidLines.join('\n'));
            return;
          }
          // 存储到 GM 跨页传递（用换行拼接）
          GM_setValue('id_to_channel_text', lines.join('\n'));
          GM_setValue('id_to_channel_trigger', Date.now());
          GM_openInTab(item.url, { active: true, insert: true });
        } catch (err) {
          alert('⚠️ 无法读取剪贴板，请确认已授予剪贴板权限。\n\n错误信息：' + err.message);
        }
        return;
      }

      // 特殊按钮：恶意改名查询 - 先读取剪贴板再跳转
      if (item.special === 'malicious_rename') {
        try {
          const clipText = await navigator.clipboard.readText();
          if (!clipText || !clipText.trim()) {
            alert('⚠️ 剪贴板为空！请先复制频道ID（纯数字，多个以换行分隔）再点击此按钮。');
            return;
          }
          // 解析剪贴板：支持换行分隔的多个数字字符串
          const ids = clipText.trim().split(/[\r\n]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
          if (ids.length === 0) {
            alert('⚠️ 剪贴板内容不是有效的频道ID！请确保是纯数字，多个以换行分隔。\n\n当前剪贴板内容：\n' + clipText);
            return;
          }
          // 存储到 GM 跨页传递
          GM_setValue('malicious_rename_ids', JSON.stringify(ids));
          GM_setValue('malicious_rename_trigger', Date.now());
          GM_openInTab(item.url, { active: true, insert: true });
        } catch (err) {
          alert('⚠️ 无法读取剪贴板，请确认已授予剪贴板权限。\n\n错误信息：' + err.message);
        }
        return;
      }

      // 普通按钮：直接跳转
      GM_openInTab(item.url, { active: true, insert: true });
    });

    panel.appendChild(btn);
  });

  // 触发按钮
  const toggle = document.createElement('button');
  toggle.id = 'quick-nav-toggle';
  toggle.innerHTML = '⚡';
  toggle.title = '快捷导航';

  let isOpen = false; // 默认收起，避免遮挡原网页内容
  panel.classList.add('hidden'); // 初始化为收起状态
  toggle.classList.add('active'); // 初始化触发按钮为收起样式
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen = !isOpen;
    toggle.classList.toggle('active', !isOpen);
    panel.classList.toggle('hidden', !isOpen);
  });

  // 点击页面其他区域自动收起
  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target)) {
      isOpen = false;
      toggle.classList.add('active');
      panel.classList.add('hidden');
    }
  });

  container.appendChild(panel);
  container.appendChild(toggle);
  document.body.appendChild(container);

  // ===================== 工具函数 =====================
  /**
   * 将 hex 颜色调亮/调暗
   * @param {string} hex - 如 '#6366f1'
   * @param {number} amount - 正值变亮，负值变暗
   * @returns {string} 调整后的 hex 颜色
   */
  function adjustColor(hex, amount) {
    hex = hex.replace('#', '');
    const num = parseInt(hex, 16);
    let r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    let b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  // ===================== 恶意改名查询 - 自动化操作（仅在 beacon.woa.com 页面执行） =====================
  if (window.location.href.includes('beacon.woa.com/datatalk/shouq/card/38474')) {
    const trigger = GM_getValue('malicious_rename_trigger', 0);
    const idsJson = GM_getValue('malicious_rename_ids', '');

    // 检查是否有待执行的任务（5分钟内的触发才算有效）
    if (trigger && Date.now() - trigger < 5 * 60 * 1000 && idsJson) {
      const ids = JSON.parse(idsJson);
      // 清理存储，防止重复执行
      GM_deleteValue('malicious_rename_trigger');
      GM_deleteValue('malicious_rename_ids');

      console.log('[快捷导航] 恶意改名查询：检测到任务，频道ID列表 =', ids);

      // 等待页面完全加载（beacon.woa.com 加载较慢，需要额外等待 Vue 渲染完毕）
      showToast('⏳ 等待页面加载完成...', 4000);
      waitForPageReady().then(() => {
        console.log('[快捷导航] 页面加载完成，开始自动化操作');
        runMaliciousRenameAutomation(ids);
      });
    }
  }

  // 用于诊断：记录频道号查询轮询次数（需在使用前声明）
  let _channelPollCount = 0;

  // ===================== ID转频道号 - 自动化操作（仅在 admin.qqchannel.woa.com/search_guild 页面执行） =====================
  if (window.location.href.includes('admin.qqchannel.woa.com/xy/app/prod/qq_channel/search_guild')) {
    const trigger = GM_getValue('id_to_channel_trigger', 0);
    const idText = GM_getValue('id_to_channel_text', '');

    // 检查是否有待执行的任务（5分钟内的触发才算有效）
    if (trigger && Date.now() - trigger < 5 * 60 * 1000 && idText) {
      // 清理存储，防止重复执行
      GM_deleteValue('id_to_channel_trigger');
      GM_deleteValue('id_to_channel_text');

      console.log('[快捷导航] ID转频道号：检测到任务，频道ID =', idText);

      // 重置轮询计数器
      _channelPollCount = 0;

      // 等待页面完全加载
      showToast('⏳ 等待页面加载完成...', 4000);
      waitForPageReady().then(() => {
        console.log('[快捷导航] 页面加载完成，开始ID转频道号自动化');
        runIdToChannelAutomation(idText);
      });
    }
  }

  /**
   * ID转频道号自动化操作
   *
   * 步骤：
   * 1. 点击"频道ID"选项卡
   * 2. 在 textarea 中填入 ID
   * 3. 点击搜索按钮
   * 4. 等待结果表格出现
   * 5. 提取频道号
   * 6. 弹窗确认并复制到剪贴板
   */
  function runIdToChannelAutomation(idText) {
    showToast('🚀 开始ID转频道号，请稍候...');

    // 第一步：找到并点击"频道ID"选项卡
    waitForElement(
      () => findChannelIdTab(),
      30000,
      500
    ).then((tabEl) => {
      console.log('[快捷导航] 找到"频道ID"选项卡');
      showToast('🔍 点击"频道ID"选项卡...');
      tabEl.click();

      // 等待选项卡切换生效
      return new Promise(resolve => setTimeout(resolve, 800));
    }).then(() => {
      // 第二步：找到 textarea 并填入 ID
      showToast('✏️ 正在填入频道ID...');
      return waitForElement(
        () => findSearchTextarea(),
        10000,
        500
      );
    }).then((textarea) => {
      console.log('[快捷导航] 找到输入框 textarea');

      // 使用 setNativeValueTextarea 设置值
      setNativeValueTextarea(textarea, idText);

      // 等待 Vue 响应
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      // 第三步：点击搜索按钮
      showToast('🔎 正在点击搜索...');
      return waitForElement(
        () => findSearchButton(),
        10000,
        500
      );
    }).then((searchBtn) => {
      console.log('[快捷导航] 找到搜索按钮');
      searchBtn.click();

      // 第四步：等待查询结果出现
      // 关键：先等一段时间让请求发出、旧结果被清除、loading 状态出现
      showToast('📊 正在查询，等待结果...', 10000);
      return new Promise(resolve => setTimeout(resolve, 3000));
    }).then(() => {
      // 现在开始轮询等待结果
      return waitForElement(
        () => findChannelNumberResults(),
        60000, // 最多等 1 分钟
        2000
      );
    }).then((channelNumbers) => {
      console.log('[快捷导航] 查询完成，频道号列表:', channelNumbers);

      // 第五步：弹窗显示结果并询问是否复制
      const resultText = channelNumbers.join('\n');
      const confirmed = confirm(
        '✅ 查询成功！找到 ' + channelNumbers.length + ' 个频道号：\n\n' +
        resultText +
        '\n\n是否复制到剪贴板？'
      );

      if (confirmed) {
        // 使用 GM_setClipboard 复制到剪贴板
        GM_setClipboard(resultText, 'text');
        showToast('📋 已复制 ' + channelNumbers.length + ' 个频道号到剪贴板！', 3000);
        console.log('[快捷导航] 频道号已复制到剪贴板');
      } else {
        showToast('ℹ️ 已取消复制', 2000);
      }
    }).catch((err) => {
      console.error('[快捷导航] ID转频道号自动化失败：', err);

      // 如果是超时，提供更友好的提示
      if (err.message && err.message.includes('超时')) {
        // 尝试最后一次从页面中抓取所有可能的频道号（更宽泛）
        const lastChance = lastResortExtract();
        if (lastChance && lastChance.length > 0) {
          const resultText = lastChance.join('\n');
          const confirmed = confirm(
            '✅ 通过备用方式找到 ' + lastChance.length + ' 个频道号：\n\n' +
            resultText +
            '\n\n是否复制到剪贴板？'
          );
          if (confirmed) {
            GM_setClipboard(resultText, 'text');
            showToast('📋 已复制到剪贴板！', 3000);
          }
          return;
        }

        showToast('⚠️ 等待查询结果超时，请查看控制台日志协助诊断', 8000);
        alert('⚠️ 等待查询结果超时！\n\n可能原因：\n1. 查询尚未完成（网络较慢）\n2. 页面DOM结构与脚本不匹配\n\n请打开浏览器控制台（F12），查看 [快捷导航] 开头的日志，\n特别是"DOM 诊断信息"部分，反馈给开发者以便修复。');
      } else {
        showToast('❌ 操作失败：' + err.message + '\n请手动操作', 5000);
      }
    });
  }

  /**
   * 查找"频道ID"选项卡
   * 目标元素：<span class="tag-select_label">频道ID</span>
   */
  function findChannelIdTab() {
    // 精确匹配：span.tag-select_label 内容为"频道ID"
    const labels = document.querySelectorAll('span.tag-select_label');
    for (const el of labels) {
      if (el.textContent.trim() === '频道ID' && el.offsetParent !== null) {
        console.log('[快捷导航] 精确匹配到 span.tag-select_label "频道ID"');
        return el;
      }
    }

    // 备选：在所有 span 中查找
    const allSpans = document.querySelectorAll('span');
    for (const el of allSpans) {
      if (el.textContent.trim() === '频道ID' && el.offsetParent !== null && el.children.length === 0) {
        console.log('[快捷导航] 备选匹配到"频道ID" span');
        return el;
      }
    }

    return null;
  }

  /**
   * 查找搜索用的 textarea
   * 目标元素：<textarea class="wuji-textarea ant-input" placeholder="支持批量查询...">
   */
  function findSearchTextarea() {
    // 精确匹配：textarea.wuji-textarea
    const textareas = document.querySelectorAll('textarea.wuji-textarea');
    for (const el of textareas) {
      if (el.offsetParent !== null) {
        console.log('[快捷导航] 找到 textarea.wuji-textarea');
        return el;
      }
    }

    // 备选1：textarea.ant-input
    const antTextareas = document.querySelectorAll('textarea.ant-input');
    for (const el of antTextareas) {
      if (el.offsetParent !== null) {
        console.log('[快捷导航] 找到 textarea.ant-input');
        return el;
      }
    }

    // 备选2：任何可见的 textarea
    const allTextareas = document.querySelectorAll('textarea');
    for (const el of allTextareas) {
      if (el.offsetParent !== null) {
        console.log('[快捷导航] 备选找到可见 textarea');
        return el;
      }
    }

    return null;
  }

  /**
   * 设置 textarea 的值（兼容 Vue 响应式）
   */
  function setNativeValueTextarea(textarea, text) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    )?.set;

    // 聚焦
    textarea.focus();
    textarea.click();

    // 先清空
    if (nativeSetter) {
      nativeSetter.call(textarea, '');
    } else {
      textarea.value = '';
    }

    // 方式1：execCommand('insertText') - 最接近真实输入
    let execSuccess = false;
    try {
      execSuccess = document.execCommand('insertText', false, text);
      console.log('[快捷导航] textarea execCommand insertText 结果:', execSuccess);
    } catch (e) {
      console.log('[快捷导航] textarea execCommand 不可用:', e.message);
    }

    // 方式2：如果 execCommand 未生效，使用 setter + event
    if (!execSuccess || textarea.value !== text) {
      if (nativeSetter) {
        nativeSetter.call(textarea, text);
      } else {
        textarea.value = text;
      }

      try {
        textarea.dispatchEvent(new InputEvent('input', {
          data: text,
          inputType: 'insertText',
          isComposing: false,
          bubbles: true,
          cancelable: true,
        }));
      } catch (e) {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // 补充 change 事件
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[快捷导航] textarea 值已设置:', textarea.value);
  }

  /**
   * 查找搜索按钮
   * 目标元素：<button class="ant-btn ant-btn-primary"> 内含 <i class="anticon anticon-search"> + <span>搜索</span>
   */
  function findSearchButton() {
    // 精确匹配：含搜索图标的 primary 按钮
    const primaryBtns = document.querySelectorAll('button.ant-btn-primary');
    for (const btn of primaryBtns) {
      const hasSearchIcon = btn.querySelector('.anticon-search');
      const btnText = btn.textContent.replace(/\s/g, '');
      if (hasSearchIcon && btnText.includes('搜索') && btn.offsetParent !== null) {
        console.log('[快捷导航] 精确匹配到搜索按钮（含 anticon-search 图标）');
        return btn;
      }
    }

    // 备选1：任何 primary 按钮含"搜索"文字
    for (const btn of primaryBtns) {
      if (btn.textContent.replace(/\s/g, '').includes('搜索') && btn.offsetParent !== null) {
        console.log('[快捷导航] 备选匹配到含"搜索"文字的 primary 按钮');
        return btn;
      }
    }

    // 备选2：任何按钮含"搜索"
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent.replace(/\s/g, '').includes('搜索') && btn.offsetParent !== null) {
        console.log('[快捷导航] 备选匹配到含"搜索"文字的按钮');
        return btn;
      }
    }

    return null;
  }

  /**
   * 查找查询结果中的频道号
   * 目标：在结果表格中找到"频道号"标题对应的值
   * 结构：div.w-arrayList-cell-left-title 文本为"频道号"，
   *       同级或相邻的元素包含频道号值
   *
   * 返回：频道号字符串数组，或 null（表示结果尚未加载）
   */
  function findChannelNumberResults() {
    _channelPollCount++;

    // 首先检查：如果页面有 loading 状态（spinner / 遮罩），说明还在加载
    const loadingEl = document.querySelector('.ant-spin-spinning, .ant-spin-blur, .loading-mask, .w-loading');
    if (loadingEl && loadingEl.offsetParent !== null) {
      console.log('[快捷导航] 检测到 loading 状态，继续等待...');
      return null; // 仍在加载
    }

    const channelNumbers = [];

    // ==== 方式1：通过 .w-arrayList-cell-left-title 查找 "频道号" ====
    const titleEls = document.querySelectorAll('.w-arrayList-cell-left-title');
    if (_channelPollCount <= 3) {
      console.log('[快捷导航] .w-arrayList-cell-left-title 数量:', titleEls.length);
    }
    for (const titleEl of titleEls) {
      const titleText = titleEl.textContent.trim();
      if (titleText !== '频道号') continue;

      const cell = titleEl.closest('.w-arrayList-cell') ||
                   titleEl.closest('.w-arrayList-cell-left') ||
                   titleEl.parentElement;

      if (cell) {
        const valueEl = cell.querySelector('.w-arrayList-cell-left-value') ||
                        cell.querySelector('.w-arrayList-cell-right') ||
                        cell.querySelector('[class*="value"]');
        if (valueEl) {
          const val = valueEl.textContent.trim();
          if (val && val !== '-' && val !== '暂无内容') {
            channelNumbers.push(val);
            continue;
          }
        }

        // 备选：取 cell 内所有文本节点，排除标题本身
        const allText = cell.textContent.replace(titleText, '').trim();
        if (allText && allText !== '-' && allText !== '暂无内容') {
          channelNumbers.push(allText);
        }
      }
    }

    if (channelNumbers.length > 0) {
      console.log('[快捷导航] 方式1找到频道号:', channelNumbers);
      return channelNumbers;
    }

    // ==== 方式2：通过表格列索引查找 ====
    const thCells = document.querySelectorAll('th, .ant-table-cell');
    let colIndex = -1;
    thCells.forEach((th, i) => {
      if (th.textContent.trim() === '频道号') {
        colIndex = i;
      }
    });

    if (colIndex >= 0) {
      const rows = document.querySelectorAll('tbody tr, .ant-table-tbody tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, .ant-table-cell');
        if (cells[colIndex]) {
          const val = cells[colIndex].textContent.trim();
          if (val && val !== '-') {
            channelNumbers.push(val);
          }
        }
      }
    }

    if (channelNumbers.length > 0) {
      console.log('[快捷导航] 方式2找到频道号:', channelNumbers);
      return channelNumbers;
    }

    // ==== 方式3：全文搜索 —— 遍历整个页面查找 "频道号" 文本及相邻的值 ====
    // 这是最宽泛的搜索方式，用来应对未知的 DOM 结构
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      // 只检查叶子节点或文本内容精确匹配"频道号"的元素
      if (el.children.length === 0 && el.textContent.trim() === '频道号') {
        // 找到了"频道号"标签，查找相邻元素获取值
        const parent = el.parentElement;
        if (parent) {
          const siblings = parent.querySelectorAll('*');
          for (const sib of siblings) {
            if (sib === el) continue;
            const sibText = sib.textContent.trim();
            // 频道号通常是纯数字（可能带#前缀），长度适中
            if (sibText && sibText !== '频道号' && sibText !== '-' && sibText.length < 50) {
              // 进一步验证：看起来像频道号（数字，或 # 开头的数字）
              if (/^#?\d+$/.test(sibText.replace(/\s/g, ''))) {
                channelNumbers.push(sibText);
              }
            }
          }
        }

        // 也尝试找同级的下一个兄弟元素
        let nextSib = el.nextElementSibling;
        if (nextSib) {
          const sibText = nextSib.textContent.trim();
          if (sibText && /^#?\d+$/.test(sibText.replace(/\s/g, ''))) {
            if (!channelNumbers.includes(sibText)) {
              channelNumbers.push(sibText);
            }
          }
        }
      }
    }

    if (channelNumbers.length > 0) {
      console.log('[快捷导航] 方式3(全文搜索)找到频道号:', channelNumbers);
      return channelNumbers;
    }

    // ==== 方式4：在 iframe 中搜索（有些后台系统用 iframe 嵌套页面） ====
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) continue;

        // 在 iframe 内查找
        const iframeTitles = iframeDoc.querySelectorAll('.w-arrayList-cell-left-title');
        for (const titleEl of iframeTitles) {
          if (titleEl.textContent.trim() !== '频道号') continue;
          const cell = titleEl.closest('.w-arrayList-cell') ||
                       titleEl.closest('.w-arrayList-cell-left') ||
                       titleEl.parentElement;
          if (cell) {
            const valueEl = cell.querySelector('.w-arrayList-cell-left-value') ||
                            cell.querySelector('.w-arrayList-cell-right') ||
                            cell.querySelector('[class*="value"]');
            if (valueEl) {
              const val = valueEl.textContent.trim();
              if (val && val !== '-') channelNumbers.push(val);
            }
          }
        }

        // 宽泛搜索 iframe
        if (channelNumbers.length === 0) {
          const iframeAllEls = iframeDoc.querySelectorAll('*');
          for (const el of iframeAllEls) {
            if (el.children.length === 0 && el.textContent.trim() === '频道号') {
              const parent = el.parentElement;
              if (parent) {
                const siblings = parent.querySelectorAll('*');
                for (const sib of siblings) {
                  if (sib === el) continue;
                  const sibText = sib.textContent.trim();
                  if (sibText && /^#?\d+$/.test(sibText.replace(/\s/g, ''))) {
                    channelNumbers.push(sibText);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // 跨域 iframe 无法访问，忽略
      }
    }

    if (channelNumbers.length > 0) {
      console.log('[快捷导航] 方式4(iframe)找到频道号:', channelNumbers);
      return channelNumbers;
    }

    // ==== 只有明确的"无结果"标志才返回空数组 ====
    const emptyIndicators = document.querySelectorAll(
      '.ant-empty-description, .ant-empty, .empty-text, .no-data'
    );
    for (const el of emptyIndicators) {
      if (el.offsetParent !== null && el.textContent.trim().length > 0) {
        console.log('[快捷导航] 检测到明确的空结果提示:', el.textContent.trim());
        return [];
      }
    }

    // ==== 诊断：第5次轮询时输出页面 DOM 关键信息帮助调试 ====
    if (_channelPollCount === 5) {
      console.log('[快捷导航] === DOM 诊断信息 ===');
      // 打印页面中包含"频道号"文字的所有元素
      const allDomEls = document.querySelectorAll('*');
      let found = false;
      for (const el of allDomEls) {
        if (el.textContent.includes('频道号') && el.children.length <= 2) {
          console.log('[快捷导航] 包含"频道号"的元素:', el.tagName, el.className, '|', el.textContent.substring(0, 100));
          found = true;
        }
      }
      if (!found) {
        console.log('[快捷导航] 页面中没有找到任何包含"频道号"文字的元素！');
        console.log('[快捷导航] iframe 数量:', document.querySelectorAll('iframe').length);
        console.log('[快捷导航] 页面 body 前500字符:', document.body?.textContent?.substring(0, 500));
      }
      console.log('[快捷导航] === 诊断结束 ===');
    }

    console.log('[快捷导航] 未检测到频道号结果，继续等待... (轮询第' + _channelPollCount + '次)');
    return null;
  }

  /**
   * 最后的备用频道号提取 —— 超时后的最后一搏
   * 更宽泛地搜索页面上所有可能是频道号的内容
   */
  function lastResortExtract() {
    const channelNumbers = [];
    console.log('[快捷导航] === 启动最后备用提取 ===');

    // 策略A：查找所有包含"频道号"三个字的元素，然后在其父/祖先容器中搜索数字
    const allElements = document.querySelectorAll('*');
    const channelLabelEls = [];
    for (const el of allElements) {
      if (el.children.length === 0 && el.textContent.trim() === '频道号') {
        channelLabelEls.push(el);
        console.log('[快捷导航] 备用提取: 发现"频道号"标签:', el.tagName, el.className, '父元素:', el.parentElement?.tagName, el.parentElement?.className);
      }
    }

    for (const labelEl of channelLabelEls) {
      // 往上找3层，在每层容器中查找像频道号的值
      let container = labelEl.parentElement;
      for (let level = 0; level < 3 && container; level++) {
        const texts = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (t && t !== '频道号' && /^\d{4,15}$/.test(t)) {
            texts.push(t);
          }
        }
        if (texts.length > 0) {
          console.log('[快捷导航] 备用提取: 在第' + level + '层父容器中找到数字文本:', texts);
          for (const t of texts) {
            if (!channelNumbers.includes(t)) channelNumbers.push(t);
          }
          break;
        }
        container = container.parentElement;
      }
    }

    // 策略B：从 body 全文中正则提取 —— 查找 "频道号" 后面的数字
    if (channelNumbers.length === 0) {
      const bodyText = document.body?.innerText || '';
      // 匹配 "频道号" 后跟随的数字（可能隔几个字符或换行）
      const matches = bodyText.match(/频道号[\s\S]{0,30}?(\d{4,15})/g);
      if (matches) {
        for (const m of matches) {
          const numMatch = m.match(/(\d{4,15})/);
          if (numMatch && !channelNumbers.includes(numMatch[1])) {
            channelNumbers.push(numMatch[1]);
          }
        }
        console.log('[快捷导航] 备用提取: 正则匹配到频道号:', channelNumbers);
      }
    }

    console.log('[快捷导航] === 备用提取结果:', channelNumbers, '===');
    return channelNumbers;
  }

  /**
   *
   * 页面实际 DOM 结构（经诊断确认）：
   * - 弹窗框架：Ant Design (ant-modal-wrap → ant-modal → ant-modal-body / ant-modal-footer)
   * - 分隔符复选框：Element UI el-checkbox（无 dsjtj- 前缀），value=ENTER/COMMA/SPACE/SEMI
   * - 值输入区域：Element UI el-select（无 dsjtj- 前缀）
   *   - input.el-select__input.is-small（目标输入框）
   *   - 已有值标签：span.el-tag → i.el-tag__close.el-icon-close
   * - 保存按钮：button.ant-btn.ant-btn-primary（文本"保 存"）
   * - 频道ID按钮：span.text-labels.clickable（在 div.tag-with-conf.gray 内）
   */
  function runMaliciousRenameAutomation(ids) {
    showToast('🚀 开始自动填写频道ID，请稍候...');

    // 第一步：找到并点击"频道ID"筛选按钮（打开"全局筛选" ant-modal 弹窗）
    waitForElement(
      () => findChannelIdFilterButton(),
      30000,
      500
    ).then((filterBtn) => {
      console.log('[快捷导航] 找到"频道ID"筛选按钮:', filterBtn.tagName, filterBtn.className);
      showToast('🔍 找到频道ID筛选按钮，点击中...');
      filterBtn.click();

      // 第二步：等待 ant-modal "全局筛选"弹窗出现并渲染完毕
      showToast('📝 等待弹窗内容渲染...');
      return waitForElement(
        () => findFilterModal(),
        20000,
        800
      );
    }).then((modal) => {
      console.log('[快捷导航] 弹窗已渲染，容器:', modal.tagName, modal.className?.substring?.(0, 80));
      showToast('✏️ 正在勾选空格分隔符...');

      // 第三步：勾选"空格"分隔符复选框
      ensureSpaceChecked(modal);

      // 等待勾选生效
      return new Promise(resolve => setTimeout(() => resolve(modal), 600));
    }).then((modal) => {
      showToast('🗑️ 清除已有标签...');

      // 第四步：清除 el-select 中已有的标签
      const tagCount = clearExistingTags(modal);

      // 等标签清除动画结束（每个标签间隔 150ms）
      const waitTime = Math.max(500, tagCount * 200);
      return new Promise(resolve => setTimeout(() => resolve(modal), waitTime));
    }).then((modal) => {
      showToast('✏️ 正在填入频道ID...');

      // 第五步：逐个填入 ID 并按回车生成标签
      // el-select 的标签模式通常需要"输入值 → 回车 → 生成标签"循环
      const input = findSelectInput(modal);
      if (!input) {
        throw new Error('未找到 el-select 输入框');
      }
      console.log('[快捷导航] 找到输入框:', input.tagName, input.className);

      // 先尝试方式 A：整体输入（依赖空格分隔符）
      // 如果已勾选"空格"分隔符，一次性输入后回车应能自动拆分
      input.focus();
      input.click();
      // 给一点时间让 focus 事件处理完
      return new Promise(resolve => setTimeout(() => resolve({ modal, input }), 300));
    }).then(({ modal, input }) => {
      // 先尝试方式 A：一次性输入全部内容（空格分隔）+ 回车
      const inputText = ids.join(' ');
      setNativeValue(input, inputText);
      console.log('[快捷导航] 已填入内容:', inputText, '当前 input.value:', input.value);

      // 等待 Vue 响应
      return new Promise(resolve => setTimeout(() => resolve({ modal, input }), 400));
    }).then(({ modal, input }) => {
      // 按回车确认
      pressEnter(input);
      console.log('[快捷导航] 已按下第一次回车');

      // 等待标签生成
      return new Promise(resolve => setTimeout(() => resolve({ modal, input }), 800));
    }).then(({ modal, input }) => {
      // 检查是否生成了标签
      const tags = modal.querySelectorAll('.el-tag');
      console.log('[快捷导航] 回车后检测到', tags.length, '个标签');

      if (tags.length >= ids.length) {
        console.log('[快捷导航] 方式A成功：检测到足够的标签');
        return modal;
      }

      // 方式 A 未完全生效，尝试方式 B：逐个输入
      console.log('[快捷导航] 方式A标签不足，切换方式B：逐个输入');

      // 收集还需要输入的 ID
      const existingTagTexts = new Set();
      tags.forEach(tag => {
        const text = tag.textContent.replace(/×/g, '').trim();
        if (text) existingTagTexts.add(text);
      });

      const remaining = ids.filter(id => !existingTagTexts.has(String(id)));
      console.log('[快捷导航] 还需输入', remaining.length, '个ID:', remaining);

      if (remaining.length === 0) return modal;

      // 逐个输入：每个 ID 单独输入 + 回车
      let chain = Promise.resolve();
      for (let i = 0; i < remaining.length; i++) {
        const idStr = String(remaining[i]);
        chain = chain.then(() => {
          input.focus();
          input.click();
          return new Promise(resolve => setTimeout(resolve, 200));
        }).then(() => {
          setNativeValue(input, idStr);
          console.log('[快捷导航] 逐个输入第', i + 1, '个:', idStr);
          return new Promise(resolve => setTimeout(resolve, 300));
        }).then(() => {
          pressEnter(input);
          console.log('[快捷导航] 逐个输入：已回车确认第', i + 1, '个');
          return new Promise(resolve => setTimeout(resolve, 500));
        });
      }

      return chain.then(() => modal);
    }).then((modal) => {
      // 最终验证标签数量
      const finalTags = modal.querySelectorAll('.el-tag');
      console.log('[快捷导航] 最终标签数量:', finalTags.length, '(期望:', ids.length, ')');
      finalTags.forEach((tag, i) => {
        console.log('[快捷导航] 标签', i + 1, ':', tag.textContent.replace(/×/g, '').trim());
      });

      if (finalTags.length === 0) {
        console.warn('[快捷导航] ⚠️ 警告：标签为 0！可能输入值未被组件识别');
        showToast('⚠️ 输入可能未被识别，请检查弹窗内容', 5000);
        // 不立即点保存，给用户手动检查的机会
        return new Promise(resolve => setTimeout(() => resolve(modal), 3000));
      }

      return new Promise(resolve => setTimeout(() => resolve(modal), 300));
    }).then((modal) => {
      // 第七步：点击保存按钮
      const saveBtn = findSaveButton(modal);
      if (saveBtn) {
        saveBtn.click();
        console.log('[快捷导航] 已点击保存');
        showToast('✅ 已保存，等待弹窗关闭...', 2000);
      } else {
        showToast('⚠️ 未找到保存按钮，请手动点击保存', 5000);
      }

      // 等待保存操作完成、弹窗关闭
      return new Promise(resolve => setTimeout(resolve, 1500));
    }).then(() => {
      // 第八步：点击"立即分析"按钮
      showToast('🔄 正在点击"立即分析"...');

      return waitForElement(
        () => findAnalyzeButton(),
        15000,
        500
      );
    }).then((analyzeBtn) => {
      analyzeBtn.click();
      console.log('[快捷导航] 已点击"立即分析"按钮');
      showToast('📊 正在查询，等待结果出现...', 5000);

      // 第九步：等待查询完成（下载按钮出现 = 表格已渲染）
      return waitForElement(
        () => findDownloadButton(),
        120000,  // 查询可能较慢，最多等 2 分钟
        2000
      );
    }).then((downloadBtn) => {
      console.log('[快捷导航] 查询完成，找到下载按钮');
      showToast('⬇️ 查询完成！正在点击下载...', 2000);

      // 第十步：点击下载按钮
      downloadBtn.click();
      console.log('[快捷导航] 已点击下载按钮');

      // 等待下载弹窗出现
      return waitForElement(
        () => findDownloadModal(),
        10000,
        500
      );
    }).then((downloadModal) => {
      console.log('[快捷导航] 下载弹窗已出现');

      // 第十一步：选择 Excel 文件类型
      selectExcelRadio(downloadModal);

      // 等待选择生效
      return new Promise(resolve => setTimeout(() => resolve(downloadModal), 500));
    }).then((downloadModal) => {
      // 第十二步：点击"下载到本地"按钮
      const downloadLocalBtn = findDownloadLocalButton(downloadModal);
      if (downloadLocalBtn) {
        downloadLocalBtn.click();
        console.log('[快捷导航] 已点击"下载到本地"按钮');
        showToast('🎉 全部操作完成！文件正在下载...', 5000);
      } else {
        showToast('⚠️ 未找到"下载到本地"按钮，请手动点击', 5000);
      }
    }).catch((err) => {
      console.error('[快捷导航] 自动化操作失败：', err);
      showToast('❌ 自动操作失败：' + err.message + '\n请手动操作', 5000);
    });
  }

  // ===================== DOM 查找辅助函数 =====================

  /**
   * 查找"频道ID"筛选按钮
   * 诊断确认：在过滤条件区域有一个 span.text-labels.clickable 包含"频道ID"文字，
   *           位于 div.tag-with-conf.gray > li > ul.draggable-list 中
   * 点击后会弹出 ant-modal "全局筛选"弹窗
   */
  function findChannelIdFilterButton() {
    // 精确匹配：过滤条件区域的 span.text-labels.clickable
    const clickableLabels = document.querySelectorAll('span.text-labels.clickable');
    for (const el of clickableLabels) {
      if (el.textContent.trim() === '频道ID' && el.offsetParent !== null) {
        console.log('[快捷导航] 精确匹配到 span.text-labels.clickable "频道ID"');
        return el;
      }
    }

    // 备选1：在 filter-and-order / filter-list-container 区域找
    const filterArea = document.querySelector('.filter-and-order, .filter-list-container');
    if (filterArea) {
      const spans = filterArea.querySelectorAll('span');
      for (const el of spans) {
        if (el.textContent.trim() === '频道ID' && el.offsetParent !== null) {
          console.log('[快捷导航] 在过滤区域找到"频道ID"');
          return el;
        }
      }
    }

    // 备选2：tag-with-conf 内找
    const tagConfs = document.querySelectorAll('.tag-with-conf');
    for (const tag of tagConfs) {
      if (tag.textContent.includes('频道ID') && tag.offsetParent !== null) {
        // 优先点击内部的 span.text-labels
        const label = tag.querySelector('span.text-labels');
        if (label) {
          console.log('[快捷导航] 在 tag-with-conf 内找到"频道ID" span');
          return label;
        }
        console.log('[快捷导航] 在 tag-with-conf 内找到"频道ID" div');
        return tag;
      }
    }

    // 最终备选：宽泛搜索
    const allElements = document.querySelectorAll('span, div, button, a');
    for (const el of allElements) {
      const text = el.textContent.trim();
      if (text === '频道ID' && el.offsetParent !== null && el.children.length === 0) {
        console.log('[快捷导航] 宽泛匹配到"频道ID":', el.tagName, el.className);
        return el;
      }
    }

    return null;
  }

  /**
   * 查找"全局筛选"弹窗（Ant Design Modal）
   * 弹窗结构：div.ant-modal-wrap (visible) → div.ant-modal → div.ant-modal-content
   *            → div.ant-modal-body (包含分隔符+输入区域)
   *            → div.ant-modal-footer (包含"取消"+"保存"按钮)
   * 弹窗标题含"全局筛选"，body 内含"分隔符配置"文字
   *
   * 返回：可见的 ant-modal-wrap 元素，或 null
   */
  function findFilterModal() {
    // 查找所有 ant-modal-wrap
    const modalWraps = document.querySelectorAll('.ant-modal-wrap');
    for (const wrap of modalWraps) {
      // 检查是否可见（ant-modal-wrap 隐藏时 display:none）
      const style = window.getComputedStyle(wrap);
      if (style.display === 'none') continue;

      // 检查内容是否包含"全局筛选"
      const text = wrap.textContent || '';
      if (text.includes('全局筛选') && text.includes('分隔符')) {
        // 确认弹窗内有 el-select__input（说明渲染完毕）
        const selectInput = wrap.querySelector('input.el-select__input');
        if (selectInput) {
          console.log('[快捷导航] 找到"全局筛选"弹窗，el-select__input 已就绪');
          return wrap;
        }
        // 也检查 el-select（可能 input 的 class 略有不同）
        const elSelect = wrap.querySelector('.el-select');
        if (elSelect) {
          console.log('[快捷导航] 找到"全局筛选"弹窗，el-select 已就绪');
          return wrap;
        }
        console.log('[快捷导航] 找到"全局筛选"弹窗，但 el-select 尚未渲染');
        // 不返回 null，弹窗已存在但内部组件尚未就绪，继续等待
      }
    }

    return null;
  }

  /**
   * 勾选"空格"分隔符复选框
   * 诊断确认结构：
   *   div.saperator-setting > div.el-checkbox-group > label.el-checkbox
   *     > span.el-checkbox__input > input[type="checkbox"][value="SPACE"]
   *     > span.el-checkbox__label  → 文本"空格"
   * 未勾选时 label 没有 is-checked class，勾选后有
   */
  function ensureSpaceChecked(container) {
    const searchRoot = container || document;

    // 方案A：精确查找 value="SPACE" 的 checkbox
    const spaceCheckbox = searchRoot.querySelector('input[type="checkbox"][value="SPACE"]');
    if (spaceCheckbox) {
      const label = spaceCheckbox.closest('label.el-checkbox') || spaceCheckbox.closest('label');
      if (label) {
        const isChecked = label.classList.contains('is-checked') ||
                          label.querySelector('.is-checked') !== null;
        if (!isChecked) {
          label.click();
          console.log('[快捷导航] 已勾选"空格"分隔符 (通过 value=SPACE)');
        } else {
          console.log('[快捷导航] "空格"分隔符已勾选，无需操作');
        }
        return;
      }
    }

    // 方案B：在 saperator-setting 区域查找文字"空格"对应的 checkbox
    const separatorArea = searchRoot.querySelector('.saperator-setting');
    if (separatorArea) {
      const labels = separatorArea.querySelectorAll('label.el-checkbox');
      for (const label of labels) {
        if (label.textContent.trim() === '空格') {
          const isChecked = label.classList.contains('is-checked') ||
                            label.querySelector('.is-checked') !== null;
          if (!isChecked) {
            label.click();
            console.log('[快捷导航] 已勾选"空格" (在 saperator-setting 内)');
          } else {
            console.log('[快捷导航] "空格"已勾选 (在 saperator-setting 内)');
          }
          return;
        }
      }
    }

    // 方案C：宽泛搜索所有 label.el-checkbox
    const checkboxLabels = searchRoot.querySelectorAll('label.el-checkbox');
    console.log('[快捷导航] 找到 el-checkbox 数量:', checkboxLabels.length);
    for (const label of checkboxLabels) {
      if (label.textContent.trim() === '空格') {
        const isChecked = label.classList.contains('is-checked') ||
                          label.querySelector('.is-checked') !== null;
        if (!isChecked) {
          label.click();
          console.log('[快捷导航] 已勾选"空格" (方案C)');
        } else {
          console.log('[快捷导航] "空格"已勾选 (方案C)');
        }
        return;
      }
    }

    console.log('[快捷导航] 未找到"空格"复选框');
  }

  /**
   * 清除 el-select 中已有的标签
   * 诊断确认：标签是 span.el-tag.el-tag--info.el-tag--mini.el-tag--light
   *           关闭按钮是内部的 i.el-tag__close.el-icon-close
   * 返回清除的标签数量
   */
  function clearExistingTags(container) {
    const searchRoot = container || document;
    // 在弹窗的 value-component 区域找标签关闭按钮
    const closeBtns = searchRoot.querySelectorAll('.el-tag__close');
    console.log('[快捷导航] 找到', closeBtns.length, '个已有标签需要清除');
    const btnsArray = Array.from(closeBtns);
    // 从后往前点击，避免 DOM 变化导致索引错乱
    btnsArray.reverse().forEach((btn, i) => {
      setTimeout(() => {
        btn.click();
        console.log('[快捷导航] 已清除第', btnsArray.length - i, '个标签');
      }, i * 150);
    });
    return btnsArray.length;
  }

  /**
   * 在弹窗容器中查找 el-select 的输入框
   * 诊断确认目标：input.el-select__input.is-small
   *   父级链：div.el-select__tags → div.el-select.array-string.el-select--small
   *           → div.value-component → div.filter-list-item
   */
  function findSelectInput(container) {
    const searchRoot = container || document;

    // 精确匹配：input.el-select__input
    const elSelectInput = searchRoot.querySelector('input.el-select__input');
    if (elSelectInput && elSelectInput.offsetParent !== null) {
      console.log('[快捷导航] 找到 input.el-select__input');
      return elSelectInput;
    }

    // 备选1：在 .el-select__tags 内找 input
    const tagsDiv = searchRoot.querySelector('.el-select__tags');
    if (tagsDiv) {
      const input = tagsDiv.querySelector('input');
      if (input) {
        console.log('[快捷导航] 在 el-select__tags 中找到 input');
        return input;
      }
    }

    // 备选2：在 .value-component 内找 input
    const valueComp = searchRoot.querySelector('.value-component');
    if (valueComp) {
      const input = valueComp.querySelector('input.el-select__input') ||
                    valueComp.querySelector('input[type="text"]');
      if (input) {
        console.log('[快捷导航] 在 value-component 中找到 input');
        return input;
      }
    }

    // 备选3：在 .el-select 内找 input
    const elSelectDiv = searchRoot.querySelector('.el-select.array-string');
    if (elSelectDiv) {
      const input = elSelectDiv.querySelector('input[type="text"]');
      if (input) {
        console.log('[快捷导航] 在 el-select.array-string 中找到 input');
        return input;
      }
    }

    // 最终备选：找所有可见的 text input（排除 ant-select 内的 disabled 输入框）
    const allInputs = searchRoot.querySelectorAll('input[type="text"]');
    for (const inp of allInputs) {
      // 排除 ant-select-search__field（字段选择器的搜索框，通常不可见或 disabled 的）
      if (inp.classList.contains('ant-select-search__field')) continue;
      if (inp.offsetParent !== null) {
        console.log('[快捷导航] 最终备选: 找到可见 text input, class=', inp.className);
        return inp;
      }
    }

    return null;
  }

  /**
   * 设置 input 值（兼容 Vue 2/3 / Element UI 响应式）
   *
   * Element UI 的 el-select（可创建标签模式）内部监听的事件链较复杂。
   * 简单 set value + input event 不足以让组件识别。
   * 策略：尝试多种方式，确保 Vue 组件能感知到值变化。
   */
  function setNativeValue(input, text) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    )?.set;

    // 先清空
    if (nativeSetter) {
      nativeSetter.call(input, '');
    } else {
      input.value = '';
    }

    // ---- 方式1：尝试 execCommand('insertText')，最接近真实输入 ----
    input.focus();
    let execSuccess = false;
    try {
      // 使用 document.execCommand 模拟真实文字输入
      // 这种方式能正确触发 Vue/React 的 input 事件拦截
      execSuccess = document.execCommand('insertText', false, text);
      console.log('[快捷导航] execCommand insertText 结果:', execSuccess, '当前 value:', input.value);
    } catch (e) {
      console.log('[快捷导航] execCommand 不可用:', e.message);
    }

    // ---- 方式2：如果 execCommand 未生效，使用 InputEvent ----
    if (!execSuccess || input.value !== text) {
      console.log('[快捷导航] execCommand 未生效，使用 InputEvent 方式');
      if (nativeSetter) {
        nativeSetter.call(input, text);
      } else {
        input.value = text;
      }

      // 用 InputEvent（而非普通 Event），更接近浏览器原生行为
      try {
        input.dispatchEvent(new InputEvent('input', {
          data: text,
          inputType: 'insertText',
          isComposing: false,
          bubbles: true,
          cancelable: true,
        }));
      } catch (e) {
        // 回退到普通 Event
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // ---- 方式3：补充 compositionstart → compositionend 序列 ----
    // 中文输入法场景下 Vue 2 依赖 composition 事件
    input.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    input.dispatchEvent(new CompositionEvent('compositionupdate', { data: text, bubbles: true }));
    input.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }));

    // 补充 change 事件
    input.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('[快捷导航] setNativeValue 完成，最终 value:', input.value);
  }

  /**
   * 在输入框中模拟按下回车键
   */
  function pressEnter(input) {
    const enterEvent = (type) => new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(enterEvent('keydown'));
    input.dispatchEvent(enterEvent('keypress'));
    input.dispatchEvent(enterEvent('keyup'));
  }

  /**
   * 查找保存按钮
   * 诊断确认：button.ant-btn.ant-btn-primary 文本"保 存"
   *           位于 div.ant-modal-footer 内
   */
  function findSaveButton(container) {
    const searchRoot = container || document;

    // 精确匹配：弹窗 footer 内的 primary 按钮
    const footer = searchRoot.querySelector('.ant-modal-footer');
    if (footer) {
      const primaryBtn = footer.querySelector('button.ant-btn-primary');
      if (primaryBtn) {
        const text = primaryBtn.textContent.replace(/\s/g, '');
        if (text === '保存') {
          console.log('[快捷导航] 找到 ant-modal-footer 内的 primary 保存按钮');
          return primaryBtn;
        }
      }
      // footer 内找任何包含"保存"的按钮
      const btns = footer.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.replace(/\s/g, '') === '保存') {
          console.log('[快捷导航] 找到 ant-modal-footer 内的保存按钮');
          return btn;
        }
      }
    }

    // 备选：在容器内找所有按钮
    const buttons = searchRoot.querySelectorAll('button');
    const candidates = [];
    for (const btn of buttons) {
      const text = btn.textContent.replace(/\s/g, '');
      if (text === '保存' && btn.offsetParent !== null) {
        candidates.push(btn);
      }
    }
    console.log('[快捷导航] 找到', candidates.length, '个可见"保存"按钮');

    if (candidates.length > 0) {
      // 优先 primary
      for (const btn of candidates) {
        if (btn.classList.contains('ant-btn-primary') || btn.className.includes('primary')) {
          console.log('[快捷导航] 选中 primary 保存按钮');
          return btn;
        }
      }
      return candidates[candidates.length - 1];
    }

    return null;
  }

  /**
   * 查找"立即分析"按钮
   * 用户确认：<button class="el-tooltip analytics-btn ant-btn"><span>立即分析</span></button>
   * 保存弹窗关闭后，该按钮出现在主页面中
   */
  function findAnalyzeButton() {
    // 精确匹配：带 analytics-btn 类的按钮
    const analyticsBtns = document.querySelectorAll('button.analytics-btn');
    for (const btn of analyticsBtns) {
      if (btn.textContent.trim().includes('立即分析') && btn.offsetParent !== null) {
        console.log('[快捷导航] 精确匹配到 button.analytics-btn "立即分析"');
        return btn;
      }
    }

    // 备选：在所有可见按钮中找文字"立即分析"
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent.trim().includes('立即分析') && btn.offsetParent !== null) {
        console.log('[快捷导航] 备选匹配到"立即分析"按钮, class=', btn.className);
        return btn;
      }
    }

    return null;
  }

  /**
   * 查找下载按钮
   * 用户确认：button.download-data-button.ant-btn.ant-btn-sm
   *           内含 i.file-icon.iconfont.icona-xiazai_download11
   * 当查询结果表格渲染完成后，该按钮变得可见
   */
  function findDownloadButton() {
    // 精确匹配：带 download-data-button 类的按钮
    const dlBtns = document.querySelectorAll('button.download-data-button');
    for (const btn of dlBtns) {
      if (btn.offsetParent !== null) {
        console.log('[快捷导航] 找到 download-data-button');
        return btn;
      }
    }

    // 备选：找含下载图标的按钮
    const iconBtns = document.querySelectorAll('button i.icona-xiazai_download11');
    for (const icon of iconBtns) {
      const btn = icon.closest('button');
      if (btn && btn.offsetParent !== null) {
        console.log('[快捷导航] 通过下载图标找到按钮');
        return btn;
      }
    }

    return null;
  }

  /**
   * 查找下载配置弹窗
   * 弹窗标题包含"下载配置"/"下载到本地"等，是 Ant Design modal
   * 点击下载按钮后弹出，内含文件类型选择（EXCEL/CSV等）和"下载到本地"按钮
   */
  function findDownloadModal() {
    // 查找所有 ant-modal-wrap
    const modals = document.querySelectorAll('.ant-modal-wrap');
    console.log('[快捷导航] findDownloadModal: 找到', modals.length, '个 ant-modal-wrap');

    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i];

      // 用 getComputedStyle 检查是否可见（比 inline style 更可靠）
      const computedStyle = window.getComputedStyle(modal);
      const isHidden = computedStyle.display === 'none' ||
                       computedStyle.visibility === 'hidden' ||
                       computedStyle.opacity === '0';
      if (isHidden) {
        console.log('[快捷导航] findDownloadModal: modal[' + i + '] 不可见，跳过');
        continue;
      }

      const text = modal.textContent || '';

      // 宽松匹配：只要包含"下载"相关关键字之一即可
      // 排除"全局筛选"弹窗（前面步骤的弹窗可能 DOM 仍存在）
      if (text.includes('全局筛选')) {
        console.log('[快捷导航] findDownloadModal: modal[' + i + '] 是全局筛选弹窗，跳过');
        continue;
      }

      // 匹配条件：包含下载相关关键字
      const hasDownloadKeyword = text.includes('下载配置') ||
                                  text.includes('下载到本地') ||
                                  text.includes('导出配置') ||
                                  text.includes('文件类型');
      const hasFileTypeKeyword = text.includes('EXCEL') ||
                                  text.includes('Excel') ||
                                  text.includes('excel') ||
                                  text.includes('CSV') ||
                                  text.includes('csv');

      // 也可以通过检测 radio 按钮来确认是下载弹窗
      const hasRadio = modal.querySelector('input[type="radio"]') !== null ||
                       modal.querySelector('.ant-radio-wrapper') !== null;

      console.log('[快捷导航] findDownloadModal: modal[' + i + ']',
        'hasDownloadKeyword=' + hasDownloadKeyword,
        'hasFileTypeKeyword=' + hasFileTypeKeyword,
        'hasRadio=' + hasRadio,
        'textPreview=' + text.substring(0, 100).replace(/\s+/g, ' '));

      if (hasDownloadKeyword || hasFileTypeKeyword || (hasRadio && text.includes('下载'))) {
        console.log('[快捷导航] 找到下载配置弹窗');
        return modal;
      }
    }

    return null;
  }

  /**
   * 在下载弹窗中选择 Excel 单选框
   * 目标：input[type="radio"][value="excel"]
   */
  function selectExcelRadio(container) {
    const searchRoot = container || document;

    // 精确匹配：value="excel" 的 radio
    const excelRadio = searchRoot.querySelector('input[type="radio"][value="excel"]');
    if (excelRadio) {
      if (!excelRadio.checked) {
        excelRadio.click();
        console.log('[快捷导航] 已点击选中 Excel radio');

        // Ant Design 的 Radio 可能需要点击外层 label/span
        const label = excelRadio.closest('label') || excelRadio.parentElement;
        if (label && label !== excelRadio) {
          label.click();
          console.log('[快捷导航] 补充点击了 radio 的 label');
        }
      } else {
        console.log('[快捷导航] Excel radio 已经是选中状态');
      }
      return;
    }

    // 备选：找包含 "EXCEL" 文字的 radio label 并点击
    const labels = searchRoot.querySelectorAll('.ant-radio-wrapper, label');
    for (const label of labels) {
      if (label.textContent.includes('EXCEL')) {
        label.click();
        console.log('[快捷导航] 通过 label 文字选中了 EXCEL');
        return;
      }
    }

    console.warn('[快捷导航] 未找到 Excel 选项');
  }

  /**
   * 在下载弹窗中查找"下载到本地"按钮
   * 用户确认：button.ant-btn.ant-btn-primary，文本"下载到本地"
   */
  function findDownloadLocalButton(container) {
    const searchRoot = container || document;

    // 在弹窗内查找所有 primary 按钮
    const primaryBtns = searchRoot.querySelectorAll('button.ant-btn-primary');
    for (const btn of primaryBtns) {
      if (btn.textContent.replace(/\s/g, '').includes('下载到本地') && btn.offsetParent !== null) {
        console.log('[快捷导航] 找到"下载到本地"按钮');
        return btn;
      }
    }

    // 备选：在所有可见按钮中找
    const allBtns = searchRoot.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent.replace(/\s/g, '').includes('下载到本地') && btn.offsetParent !== null) {
        console.log('[快捷导航] 备选找到"下载到本地"按钮');
        return btn;
      }
    }

    return null;
  }

  // ===================== 通用辅助 =====================

  /**
   * 等待页面完全加载就绪（针对 SPA / 慢加载页面）
   * 策略：等待 document.readyState === 'complete' + 额外延迟等待 Vue/React 渲染
   */
  function waitForPageReady() {
    return new Promise((resolve) => {
      const doWait = () => {
        if (document.readyState === 'complete') {
          // 页面基础加载完毕后，再额外等待 5 秒让 Vue 异步组件渲染
          console.log('[快捷导航] document.readyState = complete，额外等待 5 秒...');
          setTimeout(resolve, 5000);
        } else {
          window.addEventListener('load', () => {
            console.log('[快捷导航] window.load 触发，额外等待 5 秒...');
            setTimeout(resolve, 5000);
          }, { once: true });
        }
      };
      doWait();
    });
  }

  /**
   * 等待元素出现
   * @param {Function} finder - 返回元素或 null 的函数
   * @param {number} timeout - 超时时间(ms)
   * @param {number} interval - 轮询间隔(ms)
   * @returns {Promise<Element>}
   */
  function waitForElement(finder, timeout = 10000, interval = 500) {
    const finderName = finder.name || '匿名查找函数';
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        const el = finder();
        if (el) {
          resolve(el);
          return;
        }
        const elapsed = Date.now() - startTime;
        if (elapsed > timeout) {
          reject(new Error('等待元素超时 (' + finderName + ', 已等待 ' + Math.round(elapsed / 1000) + '秒)'));
          return;
        }
        setTimeout(check, interval);
      };
      check();
    });
  }

  /**
   * 显示右下角 Toast 提示
   */
  function showToast(msg, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed',
      right: '24px',
      bottom: '90px',
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'opacity 0.3s',
      maxWidth: '320px',
      wordBreak: 'break-all',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
})();
