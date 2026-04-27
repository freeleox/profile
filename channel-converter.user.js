// ==UserScript==
// @name         一键转换 - 频道ID/频道号互转
// @namespace    http://tampermonkey.net/
// @version      5.1.0
// @description  在所有页面显示"一键转换"按钮，自动读取剪贴板内容，识别频道ID或频道号并进行互转查询，查询结果自动复制到剪贴板。
// @author       leomxiao
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ===================== 常量配置 =====================
  const ADMIN_URL = 'https://admin.qqchannel.woa.com/xy/app/prod/qq_channel/search_guild';
  const STORAGE_KEY_TASK = 'channel_converter_task';
  const STORAGE_KEY_RESULTS = 'channel_converter_results';

  // 判断当前是否在管理后台页面
  const isAdminPage = window.location.href.includes('admin.qqchannel.woa.com');

  // ===================== 样式注入 =====================
  GM_addStyle(`
    /* ===== 悬浮按钮 ===== */
    #channel-converter-btn {
      position: fixed;
      right: 24px;
      bottom: 80px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #4a6cf7 0%, #6c8cff 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(74, 108, 247, 0.4);
      transition: all 0.25s ease;
      user-select: none;
      white-space: nowrap;
      line-height: 1;
    }

    #channel-converter-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(74, 108, 247, 0.55);
      background: linear-gradient(135deg, #3b5de7 0%, #5a7aee 100%);
    }

    #channel-converter-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(74, 108, 247, 0.3);
    }

    #channel-converter-btn .btn-icon {
      font-size: 16px;
      line-height: 1;
    }

    #channel-converter-btn.dragging {
      cursor: grabbing;
      opacity: 0.85;
      transition: none;
    }

    /* ===== Toast 提示框 ===== */
    #channel-converter-toast {
      position: fixed;
      top: 32px;
      left: 50%;
      transform: translateX(-50%) translateY(-80px);
      z-index: 2147483647;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #fff;
      pointer-events: none;
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      white-space: pre-line;
      text-align: center;
      line-height: 1.5;
      max-width: 500px;
    }

    #channel-converter-toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    #channel-converter-toast.toast-info {
      background: linear-gradient(135deg, #4a6cf7 0%, #6c8cff 100%);
    }

    #channel-converter-toast.toast-success {
      background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    }

    #channel-converter-toast.toast-error {
      background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    }

    #channel-converter-toast.toast-warning {
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    }
  `);

  // ===================== DOM 创建 =====================

  // 创建悬浮按钮
  const btn = document.createElement('button');
  btn.id = 'channel-converter-btn';
  btn.innerHTML = '<span class="btn-icon">🔄</span> 一键转换';
  document.body.appendChild(btn);

  // 创建 Toast
  const toast = document.createElement('div');
  toast.id = 'channel-converter-toast';
  document.body.appendChild(toast);

  // ===================== Toast 工具函数 =====================
  let toastTimer = null;

  function showToast(message, type = 'info', duration = 2000) {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.className = '';
    toast.textContent = message;
    void toast.offsetWidth;
    toast.classList.add('show', `toast-${type}`);
    if (duration > 0) {
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toastTimer = null;
      }, duration);
    }
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.classList.remove('show');
  }

  // ===================== 工具函数 =====================

  /**
   * 判断是否所有行都是纯数字（频道ID）
   * 频道ID 为15-20位纯数字（实际常见16-19位）
   */
  function isAllChannelIds(text) {
    const lines = text.trim().split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return false;
    const result = lines.every(line => /^\d{15,20}$/.test(line));
    console.log('[一键转换] isAllChannelIds:', result, '输入行数:', lines.length, '示例:', lines[0], '长度:', lines[0]?.length);
    return result;
  }

  /**
   * 解析剪贴板中的频道ID列表
   */
  function parseChannelIds(text) {
    return text.trim().split(/[\n\r]+/).map(l => l.trim()).filter(l => /^\d{15,20}$/.test(l));
  }

  /**
   * 降级复制方法
   */
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  /**
   * 复制文本到剪贴板
   */
  function copyToClipboard(text) {
    try {
      GM_setClipboard(text, 'text');
    } catch (e) {
      try {
        navigator.clipboard.writeText(text);
      } catch (e2) {
        fallbackCopy(text);
      }
    }
  }

  /**
   * 等待指定毫秒
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 模拟 Vue 兼容的 textarea 输入事件
   * 该页面使用 Vue（data-v-xxx 属性），需要正确触发 Vue 的响应式更新
   */
  function simulateTextareaInput(textareaEl, value) {
    // 先聚焦
    textareaEl.focus();
    textareaEl.click();

    // 使用原生 setter 绕过框架的 controlled input
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(textareaEl, value);
    } else {
      textareaEl.value = value;
    }

    // Vue 2 主要监听 input 事件来更新 v-model
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
    textareaEl.dispatchEvent(new Event('change', { bubbles: true }));

    // 额外触发组合事件，确保 Vue compositionend 场景也能感知
    textareaEl.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    textareaEl.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }));
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ===================== 管理后台 DOM 操作函数（精确匹配真实结构）=====================

  /**
   * 切换到"频道ID"标签页
   * 真实结构: <span class="tag-select_label">频道ID</span>
   */
  async function switchToChannelIdTab() {
    console.log('[一键转换] 尝试切换到"频道ID"标签页...');

    // 策略1（精确）: 通过 class="tag-select_label" 查找
    const tagLabels = document.querySelectorAll('.tag-select_label, [class*="tag-select"] [class*="label"], [class*="tag-select"]');
    for (const el of tagLabels) {
      if (el.textContent.trim() === '频道ID') {
        console.log('[一键转换] 策略1命中: tag-select_label');
        // 点击该 span 本身或其父级（可能父级才是可点击的）
        el.click();
        await sleep(500);
        // 也尝试点击父元素
        if (el.parentElement) {
          el.parentElement.click();
        }
        await sleep(1000);
        return true;
      }
    }

    // 策略2: 查找所有 span 中文本为 "频道ID" 且 class 含 tag/select/label 的
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      if (span.textContent.trim() === '频道ID') {
        const cls = (span.className || '') + ' ' + (span.parentElement?.className || '');
        if (cls.includes('tag') || cls.includes('select') || cls.includes('label') || cls.includes('tab') || cls.includes('nav')) {
          console.log('[一键转换] 策略2命中: span with tag/select/label class');
          span.click();
          await sleep(500);
          if (span.parentElement) span.parentElement.click();
          await sleep(1000);
          return true;
        }
      }
    }

    // 策略3: 暴力查找所有包含"频道ID"文本的可点击元素
    const clickables = document.querySelectorAll('span, button, a, div, li, label');
    for (const el of clickables) {
      // 只匹配叶子节点或文本直接子元素
      if (el.textContent.trim() === '频道ID' && el.children.length === 0) {
        console.log('[一键转换] 策略3命中: 叶子节点文本匹配');
        el.click();
        await sleep(500);
        if (el.parentElement) el.parentElement.click();
        await sleep(1000);
        return true;
      }
    }

    console.warn('[一键转换] 未找到"频道ID"标签页');
    return false;
  }

  /**
   * 查找内容输入框（textarea）
   * 频道ID标签页下的textarea，用于批量输入频道ID
   */
  function findContentTextarea() {
    // 策略1: 直接找所有可见的 textarea
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      // 排除我们自己创建的和隐藏的
      if (ta.offsetParent !== null && !ta.id?.includes('channel-converter')) {
        const ph = ta.placeholder || '';
        console.log('[一键转换] 找到textarea, placeholder:', ph);
        return ta;
      }
    }

    // 策略2: 检查所有 textarea（包括可能暂时不可见的）
    if (textareas.length > 0) {
      // 过滤掉脚本自己的
      for (const ta of textareas) {
        if (!ta.id?.includes('channel-converter')) {
          return ta;
        }
      }
    }

    return null;
  }

  /**
   * 查找"搜索"按钮
   * 真实结构: <button class="ant-btn ant-btn-primary"><i class="anticon anticon-search">...</i><span>搜索</span></button>
   */
  function findSearchButton() {
    // 策略1（精确）: ant-btn-primary 按钮中包含"搜索"文字
    const primaryBtns = document.querySelectorAll('button.ant-btn-primary, button.ant-btn.ant-btn-primary');
    for (const btn of primaryBtns) {
      const text = btn.textContent.trim();
      if (text.includes('搜索')) {
        console.log('[一键转换] 策略1命中: ant-btn-primary 搜索按钮');
        return btn;
      }
    }

    // 策略2: 带 anticon-search 图标的按钮
    const searchIcon = document.querySelector('.anticon-search');
    if (searchIcon) {
      const btn = searchIcon.closest('button');
      if (btn) {
        console.log('[一键转换] 策略2命中: anticon-search 父级按钮');
        return btn;
      }
    }

    // 策略3: 所有 button 中包含"搜索"文本的
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent.trim().includes('搜索')) {
        console.log('[一键转换] 策略3命中: 包含搜索文本的按钮');
        return btn;
      }
    }

    return null;
  }

  /**
   * 【全局 DOM 诊断】无论提取是否成功，都打印页面关键结构用于调试
   */
  function printPageDiagnostics() {
    console.log('[一键转换] ========== 页面 DOM 诊断 ==========');

    // 1. 打印 w-arrayList 相关的所有 class
    const allWArrayEls = document.querySelectorAll('[class*="w-arrayList"]');
    console.log('[一键转换] 诊断: [class*="w-arrayList"] 元素总数:', allWArrayEls.length);
    const classSet = new Set();
    allWArrayEls.forEach(el => {
      (el.className?.toString() || '').split(/\s+/).forEach(c => {
        if (c.includes('w-arrayList') || c.includes('arrayList')) classSet.add(c);
      });
    });
    console.log('[一键转换] 诊断: w-arrayList 相关 class 列表:', JSON.stringify([...classSet]));

    // 2. 打印所有 class 含 "title" 的元素（可能是表头）
    const allTitleEls = document.querySelectorAll('[class*="title"]');
    const titleInfo = [];
    allTitleEls.forEach(el => {
      const text = el.textContent.trim().substring(0, 30);
      if (text && (el.className?.toString() || '').includes('arrayList')) {
        titleInfo.push({ cls: el.className?.toString().substring(0, 60), text });
      }
    });
    console.log('[一键转换] 诊断: arrayList 中含 title 的元素:', JSON.stringify(titleInfo.slice(0, 30)));

    // 3. 查找含"频道号"文本的所有叶子节点
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const channelTextNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim() === '频道号') {
        const parent = node.parentElement;
        channelTextNodes.push({
          parentTag: parent?.tagName,
          parentClass: parent?.className?.toString().substring(0, 80),
          grandParentTag: parent?.parentElement?.tagName,
          grandParentClass: parent?.parentElement?.className?.toString().substring(0, 80),
        });
      }
    }
    console.log('[一键转换] 诊断: 含"频道号"文本的节点:', JSON.stringify(channelTextNodes));

    // 4. 查找含"频道号"文本的元素，向上打印完整的 10 层 DOM 链
    if (channelTextNodes.length > 0) {
      const firstChannelNode = document.evaluate(
        "//text()[normalize-space()='频道号']",
        document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;

      if (firstChannelNode) {
        let el = firstChannelNode.parentElement;
        const chain = [];
        for (let i = 0; i < 10 && el; i++) {
          chain.push({
            level: i,
            tag: el.tagName,
            cls: el.className?.toString().substring(0, 100),
            childCount: el.children?.length,
            id: el.id || ''
          });
          el = el.parentElement;
        }
        console.log('[一键转换] 诊断: "频道号"向上10层DOM链:', JSON.stringify(chain, null, 2));

        // 从"频道号"表头出发，打印关键层级的 children 详情
        el = firstChannelNode.parentElement;
        for (let level = 0; level < 5 && el; level++) {
          const parent = el.parentElement;
          if (parent) {
            console.log('[一键转换] 诊断: level ' + level + ' 父元素 (' +
              parent.tagName + '.' + (parent.className?.toString().substring(0, 50)) +
              ') 的children (' + parent.children.length + '个):');
            for (let c = 0; c < Math.min(parent.children.length, 8); c++) {
              const child = parent.children[c];
              console.log('  [' + c + '] ' + child.tagName +
                ' class="' + (child.className?.toString().substring(0, 80)) + '"' +
                ' children=' + child.children.length +
                ' text="' + child.textContent.substring(0, 60).replace(/\n/g, '\\n') + '"');
            }
          }
          el = parent;
        }
      }
    }

    // 5. 打印 ant-spin 相关状态
    const spinNested = document.querySelectorAll('.ant-spin-nested-loading');
    const spinSpinning = document.querySelectorAll('.ant-spin-spinning');
    const antEmpty = document.querySelectorAll('.ant-empty');
    console.log('[一键转换] 诊断: ant-spin-nested-loading:', spinNested.length,
      'ant-spin-spinning:', spinSpinning.length,
      'ant-empty:', antEmpty.length);

    // 6. 查找"共 X 项"等分页信息
    const bodyText = document.body.innerText;
    const pageMatch = bodyText.match(/共\s*(\d+)\s*项/);
    const totalMatch = bodyText.match(/Total\s*(\d+)/i);
    console.log('[一键转换] 诊断: 分页信息 "共X项":', pageMatch?.[0] || '未找到',
      '"Total X":', totalMatch?.[0] || '未找到');

    // 7. 打印 table 标签情况
    const tables = document.querySelectorAll('table');
    console.log('[一键转换] 诊断: <table> 标签数:', tables.length);
    tables.forEach((t, i) => {
      const rows = t.querySelectorAll('tr');
      const ths = t.querySelectorAll('th');
      console.log('[一键转换] 诊断: table[' + i + '] rows:', rows.length, 'ths:', ths.length,
        'class:', t.className?.toString().substring(0, 80));
      // 打印表头文字
      if (ths.length > 0) {
        const thTexts = [...ths].map(th => th.textContent.trim().substring(0, 20));
        console.log('[一键转换] 诊断: table[' + i + '] 表头:', JSON.stringify(thTexts));
      }
    });

    console.log('[一键转换] ========== 诊断结束 ==========');
  }

  /**
   * 从查询结果中提取"频道号"列的数据
   *
   * 页面使用 w-arrayList 自定义组件，非标准 table
   * 多层策略自适应提取
   */
  function extractChannelNumbers() {
    const results = [];

    console.log('[一键转换] ===== 开始提取频道号 =====');

    // 【始终执行】全局 DOM 诊断
    printPageDiagnostics();

    // 第一步：找到"频道号"表头元素及其列索引
    // 尝试多种可能的表头选择器
    const titleSelectors = [
      '.w-arrayList-cell-left-title',
      '[class*="arrayList"][class*="title"]',
      '[class*="array-list"][class*="title"]',
    ];

    let allTitleDivs = null;
    let usedSelector = '';
    for (const sel of titleSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        allTitleDivs = els;
        usedSelector = sel;
        break;
      }
    }

    // 如果常规选择器没命中，尝试用 XPath 查找含"频道号"文本的元素
    let channelNumTitleEl = null;
    let colIdx = -1;
    let totalCols = 0;

    if (allTitleDivs && allTitleDivs.length > 0) {
      totalCols = allTitleDivs.length;
      allTitleDivs.forEach((div, i) => {
        if (div.textContent.trim() === '频道号') {
          colIdx = i;
          channelNumTitleEl = div;
        }
      });
      console.log('[一键转换] 通过选择器 "' + usedSelector + '" 找到表头, 总列数:', totalCols, ', 频道号列索引:', colIdx);
    }

    // 如果选择器没找到，用文本搜索兜底
    if (!channelNumTitleEl) {
      console.log('[一键转换] 选择器未命中表头，尝试文本搜索...');
      const xpathResult = document.evaluate(
        "//text()[normalize-space()='频道号']",
        document.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
      );
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        const textNode = xpathResult.snapshotItem(i);
        const parent = textNode.parentElement;
        if (parent && parent.offsetParent !== null) {
          // 找到可见的"频道号"文本，判断是否是表头
          const cls = parent.className?.toString() || '';
          console.log('[一键转换] 文本搜索命中 "频道号", parent:', parent.tagName,
            'class:', cls.substring(0, 80));

          // 如果 class 含有 title/header/th 相关词汇，大概率是表头
          if (cls.includes('title') || cls.includes('header') || cls.includes('th') ||
              parent.tagName === 'TH' || parent.tagName === 'DT') {
            channelNumTitleEl = parent;

            // 确定列索引：找同级兄弟元素中"频道号"的位置
            const siblings = parent.parentElement?.children;
            if (siblings) {
              totalCols = siblings.length;
              for (let s = 0; s < siblings.length; s++) {
                if (siblings[s] === parent || siblings[s].textContent.trim() === '频道号') {
                  colIdx = s;
                  break;
                }
              }
            }
            console.log('[一键转换] 文本搜索确定表头, 总列数:', totalCols, ', 列索引:', colIdx);
            break;
          }
        }
      }
    }

    if (!channelNumTitleEl || colIdx < 0) {
      console.warn('[一键转换] 未找到"频道号"表头元素! 所有策略均无法执行');
      return results;
    }

    // 第二步：从表头元素出发，打印 DOM 层级
    let debugEl = channelNumTitleEl;
    const parentChain = [];
    for (let i = 0; i < 10 && debugEl; i++) {
      parentChain.push({
        tag: debugEl.tagName,
        cls: debugEl.className?.toString().substring(0, 100),
        childCount: debugEl.children?.length,
        id: debugEl.id || ''
      });
      debugEl = debugEl.parentElement;
    }
    console.log('[一键转换] 频道号表头 DOM 层级(10层):', JSON.stringify(parentChain, null, 2));

    // ===== 策略A: 表头 → 父cell → 父row → listContainer → 遍历数据行 =====
    const titleCell = channelNumTitleEl.parentElement;
    if (titleCell) {
      const headerRow = titleCell.parentElement;
      if (headerRow) {
        const listContainer = headerRow.parentElement;
        if (listContainer) {
          console.log('[一键转换] 策略A: listContainer', listContainer.tagName,
            'class:', listContainer.className?.toString().substring(0, 80),
            'children:', listContainer.children.length);

          const rows = listContainer.children;
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (row === headerRow) continue;

            const cells = row.children;
            console.log('[一键转换] 策略A: row[' + r + '] tag:', row.tagName,
              'class:', row.className?.toString().substring(0, 60),
              'children:', cells.length);

            if (cells.length > colIdx) {
              const targetCell = cells[colIdx];
              const val = targetCell.textContent.trim();
              console.log('[一键转换] 策略A: row[' + r + '][' + colIdx + '] = ' + JSON.stringify(val),
                'cellTag:', targetCell.tagName, 'cellClass:', targetCell.className?.toString().substring(0, 60));
              if (val && val !== '-' && val !== '—' && val !== 'N/A' && val !== '' && val !== '频道号') {
                results.push(val);
              }
            }
          }

          // 如果 listContainer 只有1个child（只有headerRow），向上再找一层
          if (results.length === 0 && rows.length <= 1) {
            console.log('[一键转换] 策略A: listContainer 只有header，向上一层找数据...');
            const outerContainer = listContainer.parentElement;
            if (outerContainer) {
              console.log('[一键转换] 策略A+: outerContainer', outerContainer.tagName,
                'class:', outerContainer.className?.toString().substring(0, 80),
                'children:', outerContainer.children.length);
              for (let c = 0; c < outerContainer.children.length; c++) {
                const section = outerContainer.children[c];
                if (section === listContainer) continue;
                console.log('[一键转换] 策略A+: section[' + c + ']', section.tagName,
                  'class:', section.className?.toString().substring(0, 80),
                  'children:', section.children.length,
                  'innerHTML前300:', section.innerHTML.substring(0, 300));

                // 这个 section 可能包含数据行
                const sectionRows = section.children;
                for (let r = 0; r < sectionRows.length; r++) {
                  const row = sectionRows[r];
                  if (row.children.length >= totalCols && row.children.length > colIdx) {
                    const val = row.children[colIdx].textContent.trim();
                    console.log('[一键转换] 策略A+: section[' + c + '].row[' + r + '][' + colIdx + '] = ' + JSON.stringify(val));
                    if (val && val !== '-' && val !== '—' && val !== '' && val !== '频道号') {
                      results.push(val);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ===== 策略B: 根据表头 class 推测数据 cell class =====
    if (results.length === 0) {
      console.log('[一键转换] 策略A 未提取到数据，尝试策略B...');

      const titleCellEl = channelNumTitleEl.closest('[class*="cell"]') || channelNumTitleEl.parentElement;
      if (titleCellEl) {
        const titleCellClass = titleCellEl.className?.toString() || '';
        console.log('[一键转换] 策略B: 表头 cell class:', titleCellClass);

        // 尝试各种替换模式
        const replacements = [
          ['title', 'value'], ['title', 'content'], ['title', 'data'], ['title', 'text'],
          ['title', 'body'], ['left-title', 'left-value'], ['left-title', 'left-content'],
          ['header', 'body'], ['header', 'row'], ['header', 'data'],
        ];

        for (const [from, to] of replacements) {
          if (!titleCellClass.includes(from)) continue;
          const newClass = titleCellClass.replace(from, to);
          if (newClass === titleCellClass) continue;
          const selector = '.' + newClass.trim().split(/\s+/).join('.');
          try {
            const dataCells = document.querySelectorAll(selector);
            console.log('[一键转换] 策略B: 选择器', selector, '匹配:', dataCells.length);
            if (dataCells.length > 0 && totalCols > 0) {
              for (let i = colIdx; i < dataCells.length; i += totalCols) {
                const val = dataCells[i].textContent.trim();
                if (val && val !== '-' && val !== '—' && val !== '' && val !== 'N/A') {
                  results.push(val);
                }
              }
              if (results.length > 0) {
                console.log('[一键转换] 策略B 命中! 选择器:', selector);
                break;
              }
            }
          } catch (e) { /* 无效选择器 */ }
        }
      }
    }

    // ===== 策略C: 在更大范围内搜索数据 cell =====
    if (results.length === 0) {
      console.log('[一键转换] 策略B 未提取到数据，尝试策略C...');

      // 查找所有含 w-arrayList 或 arrayList 的容器
      const containers = document.querySelectorAll('[class*="arrayList"], [class*="array-list"]');
      console.log('[一键转换] 策略C: arrayList 容器数:', containers.length);

      for (const container of containers) {
        // 收集容器内所有不含 "title" 的 cell-like 元素
        const allEls = container.querySelectorAll('[class*="cell"], [class*="col"], [class*="item"]');
        const dataCellLike = [];
        allEls.forEach(el => {
          const cls = el.className?.toString() || '';
          if (!cls.includes('title') && !cls.includes('header') && !cls.includes('select')) {
            dataCellLike.push(el);
          }
        });

        console.log('[一键转换] 策略C: 容器', container.className?.toString().substring(0, 60),
          '中 data-cell-like 元素:', dataCellLike.length);

        // 尝试按列数对齐
        if (dataCellLike.length > 0 && totalCols > 0 && dataCellLike.length >= totalCols) {
          for (let i = colIdx; i < dataCellLike.length; i += totalCols) {
            const val = dataCellLike[i].textContent.trim();
            if (val && val !== '-' && val !== '—' && val !== '' && val !== 'N/A') {
              results.push(val);
            }
          }
          if (results.length > 0) {
            console.log('[一键转换] 策略C 命中!');
            break;
          }
        }
      }
    }

    // ===== 策略D: 使用 table 标签（如果存在） =====
    if (results.length === 0) {
      console.log('[一键转换] 策略C 未提取到数据，尝试策略D (table)...');

      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const ths = table.querySelectorAll('th');
        let tableColIdx = -1;
        ths.forEach((th, i) => {
          if (th.textContent.trim() === '频道号') tableColIdx = i;
        });

        if (tableColIdx >= 0) {
          const trs = table.querySelectorAll('tbody tr');
          trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length > tableColIdx) {
              const val = tds[tableColIdx].textContent.trim();
              if (val && val !== '-' && val !== '—' && val !== '') {
                results.push(val);
              }
            }
          });
          if (results.length > 0) {
            console.log('[一键转换] 策略D (table) 命中!');
          }
        }
      }
    }

    // ===== 策略E: 终极兜底 - 搜索含频道号值特征的元素 =====
    if (results.length === 0) {
      console.log('[一键转换] 所有策略均未提取到频道号，打印更详细的DOM...');

      // 从"频道号"表头出发，遍历所有同级/父级容器的 innerHTML
      let el = channelNumTitleEl;
      for (let lvl = 0; lvl < 6 && el; lvl++) {
        const parent = el.parentElement;
        if (parent) {
          console.log('[一键转换] 策略E调试: level' + lvl, parent.tagName + '.' +
            (parent.className?.toString().substring(0, 60)),
            'children:', parent.children.length,
            'innerHTML长度:', parent.innerHTML.length);
          // 只在 children 数量合理时打印
          if (parent.innerHTML.length < 3000) {
            console.log('[一键转换] 策略E调试: level' + lvl + ' innerHTML:', parent.innerHTML);
          } else {
            console.log('[一键转换] 策略E调试: level' + lvl + ' innerHTML前1500:', parent.innerHTML.substring(0, 1500));
            console.log('[一键转换] 策略E调试: level' + lvl + ' innerHTML后1500:', parent.innerHTML.substring(parent.innerHTML.length - 1500));
          }
        }
        el = parent;
      }
    }

    console.log('[一键转换] ===== 最终提取到频道号:', results, '=====');
    return results;
  }

  /**
   * 等待查询结果数据加载完成
   *
   * 多种检测机制并行：
   * 1. ant-spin-spinning 消失
   * 2. DOM 内容变化（MutationObserver）
   * 3. 表头出现且有数据行
   * 4. 分页信息出现
   * 5. 空状态出现
   */
  async function waitForDataLoaded(timeout = 15000) {
    const startTime = Date.now();

    // 记录初始页面内容快照
    const initialBodyLen = document.body.innerHTML.length;
    console.log('[一键转换] waitForDataLoaded: 开始等待, 初始页面大小:', initialBodyLen);

    // 先等待网络请求发出（搜索按钮点击后）
    await sleep(1500);

    // 阶段1: 等待 loading spinner 出现然后消失（最多等5秒出现）
    let spinnerAppeared = false;
    const spinnerWaitStart = Date.now();
    while (Date.now() - spinnerWaitStart < 5000) {
      const spinner = document.querySelector('.ant-spin-spinning');
      if (spinner) {
        spinnerAppeared = true;
        console.log('[一键转换] waitForDataLoaded: 检测到 spinner 出现');
        break;
      }
      await sleep(200);
    }

    if (spinnerAppeared) {
      // 等待 spinner 消失
      while (Date.now() - startTime < timeout) {
        const spinner = document.querySelector('.ant-spin-spinning');
        if (!spinner) {
          console.log('[一键转换] waitForDataLoaded: spinner 已消失');
          await sleep(800); // 等渲染完成
          return true;
        }
        await sleep(300);
      }
    } else {
      console.log('[一键转换] waitForDataLoaded: 5秒内未检测到 spinner，改用其他检测方式');
    }

    // 阶段2: 不依赖 spinner，检测页面内容变化
    while (Date.now() - startTime < timeout) {
      const currentBodyLen = document.body.innerHTML.length;

      // 检查1: 页面大小变化超过阈值（说明有新内容加载）
      if (currentBodyLen - initialBodyLen > 500) {
        console.log('[一键转换] waitForDataLoaded: 页面内容增长',
          (currentBodyLen - initialBodyLen), '字符');
        await sleep(800);
        return true;
      }

      // 检查2: 表头出现
      const titleDivs = document.querySelectorAll('.w-arrayList-cell-left-title, [class*="arrayList"][class*="title"]');
      if (titleDivs.length > 0) {
        console.log('[一键转换] waitForDataLoaded: 检测到表头元素', titleDivs.length, '个');
        await sleep(800);
        return true;
      }

      // 检查3: table 出现
      const tables = document.querySelectorAll('table');
      for (const t of tables) {
        if (t.querySelectorAll('tbody tr').length > 0) {
          console.log('[一键转换] waitForDataLoaded: 检测到 table 有数据行');
          await sleep(500);
          return true;
        }
      }

      // 检查4: 分页信息
      const pageInfo = document.body.innerText.match(/共\s*(\d+)\s*项/);
      if (pageInfo && parseInt(pageInfo[1]) > 0) {
        console.log('[一键转换] waitForDataLoaded: 检测到分页:', pageInfo[0]);
        await sleep(500);
        return true;
      }

      // 检查5: 空状态
      const emptyState = document.querySelector('.ant-empty, .ant-table-empty, [class*="empty"]');
      if (emptyState && emptyState.offsetParent !== null) {
        console.log('[一键转换] waitForDataLoaded: 检测到空状态');
        return true;
      }

      await sleep(300);
    }

    // 超时后打印当前状态
    console.warn('[一键转换] waitForDataLoaded: 超时 (' + timeout + 'ms)');
    console.log('[一键转换] waitForDataLoaded: 超时时页面大小:', document.body.innerHTML.length,
      '增长:', (document.body.innerHTML.length - initialBodyLen));
    const titleDivs = document.querySelectorAll('.w-arrayList-cell-left-title');
    console.log('[一键转换] waitForDataLoaded: 超时时 .w-arrayList-cell-left-title 数量:', titleDivs.length);
    return false;
  }

  // ===================== 管理后台自动化逻辑 =====================

  /**
   * 在管理后台页面自动执行查询
   * 流程：切换标签页 → 填入ID → 点击搜索 → 提取频道号 → 复制
   */
  async function executeAdminAutoQuery() {
    let task;
    try {
      task = GM_getValue(STORAGE_KEY_TASK, null);
    } catch (e) {
      showToast('查询失败：无法读取任务数据', 'error', 3000);
      return;
    }

    if (!task || !task.ids || task.ids.length === 0) {
      showToast('查询失败：没有待查询的频道ID', 'error', 3000);
      return;
    }

    console.log('[一键转换] 检测到待查询任务:', task);

    // 等待页面基本加载
    await sleep(1500);

    // 显示查询中提示（持续显示，不自动消失）
    showToast('查询中...', 'info', 0);

    try {
      // ===== 第1步：切换到"频道ID"标签页 =====
      const tabSwitched = await switchToChannelIdTab();
      if (!tabSwitched) {
        GM_deleteValue(STORAGE_KEY_TASK);
        showToast('查询失败：未找到"频道ID"标签页', 'error', 3000);
        return;
      }

      console.log('[一键转换] 已切换到"频道ID"标签页');
      await sleep(800);

      // ===== 第2步：找到内容输入框（textarea）=====
      let textareaEl = findContentTextarea();

      if (!textareaEl) {
        await sleep(2000);
        textareaEl = findContentTextarea();
      }

      if (!textareaEl) {
        GM_deleteValue(STORAGE_KEY_TASK);
        showToast('查询失败：找不到内容输入框', 'error', 3000);
        return;
      }

      console.log('[一键转换] 找到内容输入框, tagName:', textareaEl.tagName, ', placeholder:', textareaEl.placeholder);

      // ===== 第3步：将所有ID以换行分隔填入 textarea =====
      const idsText = task.ids.join('\n');

      // 清空输入框
      simulateTextareaInput(textareaEl, '');
      await sleep(300);

      // 填入ID
      simulateTextareaInput(textareaEl, idsText);
      await sleep(800);

      // 验证输入是否成功
      if (textareaEl.value !== idsText) {
        console.warn('[一键转换] textarea value 不匹配, 尝试直接赋值');
        textareaEl.value = idsText;
        textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
        textareaEl.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);
      }

      console.log(`[一键转换] 已填入 ${task.ids.length} 个频道ID, textarea.value长度:`, textareaEl.value.length);

      // ===== 第4步：找到并点击"搜索"按钮 =====
      const searchBtn = findSearchButton();
      if (!searchBtn) {
        GM_deleteValue(STORAGE_KEY_TASK);
        showToast('查询失败：找不到搜索按钮', 'error', 3000);
        return;
      }

      console.log('[一键转换] 找到搜索按钮, textContent:', searchBtn.textContent.trim());
      searchBtn.click();
      console.log('[一键转换] 已点击搜索按钮');

      // ===== 第5步：等待数据加载完成 =====
      const loaded = await waitForDataLoaded(10000);
      if (!loaded) {
        // 超时了但还是尝试读取
        console.warn('[一键转换] 等待数据超时，尝试读取当前页面数据');
      }

      // ===== 第6步：提取频道号 =====
      const channelNumbers = extractChannelNumbers();
      console.log('[一键转换] 提取到的频道号:', channelNumbers);

      // ===== 第7步：清除任务 =====
      GM_deleteValue(STORAGE_KEY_TASK);

      // ===== 第8步：复制结果并提示 =====
      if (channelNumbers.length > 0) {
        const resultText = channelNumbers.join('\n');
        copyToClipboard(resultText);

        GM_setValue(STORAGE_KEY_RESULTS, {
          results: channelNumbers,
          timestamp: Date.now()
        });

        showToast('查询成功！', 'success', 2000);
      } else {
        showToast('查询失败：未提取到频道号数据，请检查频道ID是否正确', 'error', 3000);
      }
    } catch (err) {
      console.error('[一键转换] 查询过程发生错误:', err);
      GM_deleteValue(STORAGE_KEY_TASK);
      showToast('查询失败：' + (err.message || '未知错误'), 'error', 3000);
    }
  }

  // ===================== 按钮点击主流程 =====================

  async function handleConvert() {
    try {
      // 1. 读取剪贴板文本
      let clipboardText = '';
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (err) {
        showToast('查询失败：无法读取剪贴板，请授予权限', 'error', 2000);
        return;
      }

      if (!clipboardText || !clipboardText.trim()) {
        showToast('查询失败：剪贴板为空，请先复制内容', 'error', 2000);
        return;
      }

      const text = clipboardText.trim();
      console.log('[一键转换] 剪贴板内容:', JSON.stringify(text), '长度:', text.length);

      // 2. 判断转换方向
      if (isAllChannelIds(text)) {
        // ===== 频道ID → 频道号 =====
        const ids = parseChannelIds(text);
        console.log('[一键转换] 解析到频道ID:', ids);

        // 显示"查询中"提示
        showToast('查询中...', 'info', 0);

        // 保存任务
        GM_setValue(STORAGE_KEY_TASK, { ids: ids, timestamp: Date.now() });

        if (isAdminPage) {
          // 已经在管理后台页面，直接执行查询
          console.log('[一键转换] 当前已在管理后台，直接执行查询');
          await sleep(500);
          await executeAdminAutoQuery();
        } else {
          // 不在管理后台，新标签页打开管理后台
          console.log('[一键转换] 当前不在管理后台，打开新标签页:', ADMIN_URL);
          window.open(ADMIN_URL, '_blank');
        }
      } else {
        // ===== 频道号 → 频道ID =====
        // 判断是否像频道号（1-10位数字或字母+数字组合）
        const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
        const isChannelNumbers = lines.every(line => /^[\w]{1,14}$/.test(line) && line.length < 15);

        if (isChannelNumbers) {
          // TODO: 频道号转ID功能
          showToast('频道号转ID功能开发中...', 'warning', 2000);
        } else {
          showToast('查询失败：剪贴板内容无法识别为频道ID或频道号\n内容: ' + text.substring(0, 50), 'error', 3000);
        }
      }
    } catch (err) {
      console.error('[一键转换] 发生错误:', err);
      showToast('查询失败：' + (err.message || '未知错误'), 'error', 2000);
    }
  }

  // ===================== 按钮拖拽功能 =====================
  let isDragging = false;
  let hasMoved = false;
  let startX, startY, startRight, startBottom;

  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    btn.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
    let newRight = startRight - dx;
    let newBottom = startBottom - dy;
    const btnRect = btn.getBoundingClientRect();
    newRight = Math.max(0, Math.min(newRight, window.innerWidth - btnRect.width));
    newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - btnRect.height));
    btn.style.right = newRight + 'px';
    btn.style.bottom = newBottom + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    btn.classList.remove('dragging');
  });

  // ===================== 绑定点击事件 =====================
  btn.addEventListener('click', (e) => {
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    handleConvert();
  });

  // ===================== 管理后台自动执行 =====================
  if (isAdminPage) {
    const task = GM_getValue(STORAGE_KEY_TASK, null);
    if (task && task.ids && task.ids.length > 0) {
      const age = Date.now() - (task.timestamp || 0);
      if (age < 5 * 60 * 1000) {
        console.log('[一键转换] 管理后台页面加载完成，准备自动执行查询...');
        if (document.readyState === 'complete') {
          setTimeout(() => executeAdminAutoQuery(), 2500);
        } else {
          window.addEventListener('load', () => {
            setTimeout(() => executeAdminAutoQuery(), 2500);
          });
        }
      } else {
        GM_deleteValue(STORAGE_KEY_TASK);
      }
    }
  }

})();
